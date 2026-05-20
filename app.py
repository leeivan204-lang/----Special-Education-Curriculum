import os as _os
# 生產環境（Render 等）需在最頂端 monkey patch，讓 gevent/eventlet 能接管 socket I/O
# 預設使用 gevent（對新版 Python 支援較好），設 ASYNC_MODE=eventlet 可切換
_ASYNC_MODE = _os.environ.get('ASYNC_MODE', 'gevent').lower()
if _os.environ.get('RENDER') or _os.environ.get('GEVENT_MONKEY_PATCH') == '1' or _os.environ.get('EVENTLET_MONKEY_PATCH') == '1':
    if _ASYNC_MODE == 'eventlet':
        import eventlet
        eventlet.monkey_patch()
    else:
        from gevent import monkey
        monkey.patch_all()

import os
import re
import json
import sys
import tempfile
import logging
import threading
import urllib.request
import urllib.parse
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room

def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)

# Determine the folder where the executable (or script) is located
# This is where we will store the 'data' folder
if getattr(sys, 'frozen', False):
    # If the application is run as a bundle (PyInstaller)
    BASE_DIR = os.path.dirname(sys.executable)
    # Static assets are inside the MEIPASS folder
    STATIC_FOLDER = resource_path('.')
else:
    # If run from Python script
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    STATIC_FOLDER = '.'

# --- 後端日誌設定 ---
LOG_FILE = os.path.join(BASE_DIR, 'app.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler()   # 同時輸出至 console
    ]
)
logger = logging.getLogger(__name__)

# --- CORS 允許來源 ---
# 允許任意來源（支援跨網域、跨裝置、公網代理等多裝置同步）
# 安全性：CSRF 仍由自訂 header (X-Requested-With) 防護，瀏覽器同源政策保證跨站無法設定此 header
ALLOWED_ORIGINS = '*'
logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")

app = Flask(__name__, static_url_path='', static_folder=STATIC_FOLDER)
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 限制請求大小 5MB
CORS(app, origins=ALLOWED_ORIGINS)
socketio = SocketIO(
    app,
    cors_allowed_origins=ALLOWED_ORIGINS,
    async_mode=_ASYNC_MODE if _os.environ.get('RENDER') else None,
    # Render 環境優化
    ping_timeout=60,           # 增加 ping 超時
    ping_interval=25,          # 定期 ping 保持連線
    connect_timeout=30,        # WebSocket 連線超時
    # 傳輸方式：優先 WebSocket，降級到輪詢
    transports=['websocket', 'polling'],
    upgrade_package='polling'   # 輪詢作為升級包
)
logger.info(f"Socket.IO configured with transports: websocket, polling")

# --- 安全性 HTTP 標頭 ---
@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    # Content-Security-Policy：限制資源來源
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com https://accounts.google.com https://cdn.socket.io; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "connect-src 'self' ws: wss: https://script.google.com https://script.googleusercontent.com https://accounts.google.com; "
        "frame-src https://accounts.google.com; "
        "img-src 'self' data:; "
    )
    response.headers['Content-Security-Policy'] = csp
    return response

# --- CSRF 防護（自訂 Header 驗證） ---
# 瀏覽器的同源政策保證跨站請求無法設定自訂 header
# 因此只要驗證 X-Requested-With header 存在，即可防禦 CSRF
CSRF_HEADER = 'X-Requested-With'
CSRF_EXPECTED = 'XMLHttpRequest'

@app.before_request
def csrf_protect():
    """對所有 POST/PUT/DELETE 請求驗證 CSRF header"""
    if request.method in ('POST', 'PUT', 'DELETE'):
        # 排除靜態檔案請求
        if request.path.startswith('/api/'):
            token = request.headers.get(CSRF_HEADER)
            if token != CSRF_EXPECTED:
                logger.warning(f"CSRF check failed for {request.method} {request.path} from {request.remote_addr}")
                return jsonify({'success': False, 'message': 'CSRF validation failed'}), 403

# Configuration
PORT = int(os.environ.get('PORT', 3000))  # Render 等平台透過 $PORT 指定
DATA_DIR = os.path.join(BASE_DIR, 'data')

# Ensure data directory exists
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)
    logger.info(f"Created data directory: {DATA_DIR}")

# Presence Tracking
socket_to_user = {} # sid -> user_id
user_sockets = {} # user_id -> set(sids)

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# WebSocket Events
@socketio.on('join')
def on_join(data):
    user_id = data.get('userId')
    sid = request.sid

    # 驗證 user_id 格式
    if not user_id or not is_valid_user_id(user_id):
        emit('error', {'message': 'Invalid user ID'})
        return

    if user_id:
        join_room(user_id)
        
        # Update mappings
        socket_to_user[sid] = user_id
        if user_id not in user_sockets:
            user_sockets[user_id] = set()
        user_sockets[user_id].add(sid)
        
        count = len(user_sockets[user_id])
        logger.info(f"Client {sid} joined room {user_id}. Total count: {count}")
        
        emit('status', {'msg': f'Joined room {user_id}'}, room=user_id)
        
        # 若房間已有其他人，只通知「新加入者」（不廣播給整個房間）
        # 原有的編輯者不應因為有人加入而收到警告，避免混淆其角色狀態
        if count > 1:
            emit('presence_warning', {
                'message': '目前已有其他用戶修改內容，避免資料無法同步，請稍等',
                'count': count
            })  # 不加 room= → 僅送給剛加入的 sid（即 request.sid）

@socketio.on('disconnect')
def on_disconnect():
    sid = request.sid
    user_id = socket_to_user.get(sid)

    # 若該 sid 持有編輯鎖，自動釋放
    affected = _release_lock_by_sid(sid)
    for uid in affected:
        _broadcast_editor_state(uid)
        logger.info(f"[EditorLock] Auto-released on disconnect for {uid} (sid={sid})")

    if user_id:
        if user_id in user_sockets:
            user_sockets[user_id].discard(sid)
            if len(user_sockets[user_id]) == 0:
                del user_sockets[user_id]

        if sid in socket_to_user:
            del socket_to_user[sid]

        logger.info(f"Client {sid} disconnected from {user_id}. Remaining: {len(user_sockets.get(user_id, []))}")

# --- 編輯者鎖機制（只有一個裝置/分頁能編輯，其餘為檢視者） ---
import time as _time

# user_id -> {'sid': str, 'since': float, 'last_activity': float}
editor_locks = {}
# user_id -> list of {'sid': str, 'requested_at': float}
pending_edit_requests = {}

EDITOR_IDLE_TIMEOUT = 300  # 5 分鐘無活動自動釋放鎖

# 管理員密碼（透過環境變數 ADMIN_PASSWORD 設定）
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')

def _get_editor_info(user_id):
    """回傳 {editorSid, since, hasEditor} 用於前端展示。"""
    lock = editor_locks.get(user_id)
    if lock:
        return {
            'hasEditor': True,
            'editorSid': lock['sid'],
            'since': lock['since']
        }
    return {'hasEditor': False, 'editorSid': None, 'since': None}

def _broadcast_editor_state(user_id):
    """通知房間內所有人目前編輯者狀態。"""
    state = _get_editor_info(user_id)
    try:
        socketio.emit('editor_changed', state, room=user_id)
    except Exception as e:
        logger.warning(f"Failed to broadcast editor_changed: {e}")

def _release_lock_by_sid(sid):
    """當 sid 離線或失去編輯權時，清除對應的鎖與等待佇列。回傳受影響的 user_id 清單。"""
    affected = []
    for uid, lock in list(editor_locks.items()):
        if lock['sid'] == sid:
            del editor_locks[uid]
            affected.append(uid)
    # 同時從等待佇列移除
    for uid, queue in list(pending_edit_requests.items()):
        new_queue = [r for r in queue if r['sid'] != sid]
        if new_queue:
            pending_edit_requests[uid] = new_queue
        else:
            pending_edit_requests.pop(uid, None)
    return affected

def _idle_lock_sweeper():
    """背景執行緒：定時釋放閒置超時的編輯者鎖。"""
    while True:
        try:
            now = _time.time()
            expired = []
            for uid, lock in list(editor_locks.items()):
                if now - lock.get('last_activity', lock['since']) > EDITOR_IDLE_TIMEOUT:
                    expired.append(uid)
            for uid in expired:
                lock = editor_locks.pop(uid, None)
                logger.info(f"[EditorLock] Auto-released stale lock for {uid} (sid={lock['sid'] if lock else '?'})")
                _broadcast_editor_state(uid)
        except Exception as e:
            logger.warning(f"Idle lock sweeper error: {e}")
        _time.sleep(30)

threading.Thread(target=_idle_lock_sweeper, daemon=True, name='editor-lock-sweeper').start()

# --- Socket.IO 事件：編輯權管理 ---
@socketio.on('editor_acquire')
def on_editor_acquire(data):
    """客戶端嘗試取得編輯權。成功→自己變編輯者；失敗→自己是檢視者。"""
    sid = request.sid
    user_id = (data or {}).get('userId')
    if not user_id or not is_valid_user_id(user_id):
        emit('editor_acquire_result', {'success': False, 'message': 'Invalid userId'})
        return

    existing = editor_locks.get(user_id)
    if existing and existing['sid'] != sid:
        # 檢查持有者是否仍在線上；若已斷線（幽靈鎖），直接釋放並授予新 sid
        if existing['sid'] not in socket_to_user:
            logger.info(f"[EditorLock] Ghost lock detected for {user_id} (sid={existing['sid']} disconnected), releasing")
            del editor_locks[user_id]
            # 也清除等待佇列中該幽靈 sid，清空後移除鍵值避免記憶體洩漏
            if user_id in pending_edit_requests:
                cleaned = [r for r in pending_edit_requests[user_id] if r['sid'] in socket_to_user]
                if cleaned:
                    pending_edit_requests[user_id] = cleaned
                else:
                    del pending_edit_requests[user_id]
        else:
            # 真的有其他線上編輯者 → 本人成為檢視者
            emit('editor_acquire_result', {
                'success': False,
                'role': 'viewer',
                'currentEditorSid': existing['sid'],
                'since': existing['since']
            })
            return

    # 取得鎖（或更新自己的 last_activity）
    now = _time.time()
    editor_locks[user_id] = {'sid': sid, 'since': now, 'last_activity': now}
    emit('editor_acquire_result', {'success': True, 'role': 'editor', 'since': now})
    _broadcast_editor_state(user_id)
    logger.info(f"[EditorLock] {sid} acquired editor for {user_id}")

@socketio.on('editor_release')
def on_editor_release(data):
    """主動釋放編輯權。"""
    sid = request.sid
    user_id = (data or {}).get('userId')
    lock = editor_locks.get(user_id)
    if lock and lock['sid'] == sid:
        del editor_locks[user_id]
        _broadcast_editor_state(user_id)
        logger.info(f"[EditorLock] {sid} released editor for {user_id}")
        # 若有等待者，通知他們現在可以申請了
        queue = pending_edit_requests.get(user_id, [])
        for waiter in queue:
            try:
                socketio.emit('editor_slot_available', {'userId': user_id}, to=waiter['sid'])
            except Exception:
                pass
        pending_edit_requests.pop(user_id, None)
    emit('editor_release_result', {'success': True})

@socketio.on('editor_heartbeat')
def on_editor_heartbeat(data):
    """編輯者持續活動（每次存檔或互動時呼叫），避免閒置逾時。"""
    sid = request.sid
    user_id = (data or {}).get('userId')
    lock = editor_locks.get(user_id)
    if lock and lock['sid'] == sid:
        lock['last_activity'] = _time.time()

@socketio.on('editor_request')
def on_editor_request(data):
    """檢視者申請編輯權，通知目前編輯者。"""
    sid = request.sid
    user_id = (data or {}).get('userId')
    requester_name = (data or {}).get('name', '某位檢視者')
    lock = editor_locks.get(user_id)
    if not lock:
        # 沒人在編輯 → 直接讓申請者取得
        now = _time.time()
        editor_locks[user_id] = {'sid': sid, 'since': now, 'last_activity': now}
        emit('editor_request_granted', {'userId': user_id, 'role': 'editor'})
        _broadcast_editor_state(user_id)
        return
    if lock['sid'] == sid:
        emit('editor_request_granted', {'userId': user_id, 'role': 'editor'})
        return
    # 加入等待佇列（避免重複）
    queue = pending_edit_requests.setdefault(user_id, [])
    if not any(r['sid'] == sid for r in queue):
        queue.append({'sid': sid, 'requested_at': _time.time()})
    # 通知目前編輯者
    try:
        socketio.emit('editor_request_incoming', {
            'userId': user_id,
            'requesterSid': sid,
            'requesterName': requester_name
        }, to=lock['sid'])
    except Exception as e:
        logger.warning(f"Notify editor failed: {e}")
    emit('editor_request_pending', {'userId': user_id})

@socketio.on('editor_yield')
def on_editor_yield(data):
    """目前編輯者回應申請：grant=True 讓出；grant=False 拒絕。"""
    sid = request.sid
    user_id = (data or {}).get('userId')
    grant = bool((data or {}).get('grant'))
    target_sid = (data or {}).get('targetSid')
    lock = editor_locks.get(user_id)
    if not lock or lock['sid'] != sid:
        emit('editor_yield_result', {'success': False, 'message': '您已非編輯者'})
        return
    # 從等待佇列移除該 target
    queue = pending_edit_requests.get(user_id, [])
    queue = [r for r in queue if r['sid'] != target_sid]
    if queue:
        pending_edit_requests[user_id] = queue
    else:
        pending_edit_requests.pop(user_id, None)
    if grant:
        # 將編輯權交給 target
        now = _time.time()
        editor_locks[user_id] = {'sid': target_sid, 'since': now, 'last_activity': now}
        try:
            socketio.emit('editor_request_granted', {'userId': user_id, 'role': 'editor'}, to=target_sid)
        except Exception:
            pass
        _broadcast_editor_state(user_id)
        logger.info(f"[EditorLock] {sid} yielded editor for {user_id} to {target_sid}")
    else:
        try:
            socketio.emit('editor_request_denied', {'userId': user_id}, to=target_sid)
        except Exception:
            pass
    emit('editor_yield_result', {'success': True, 'granted': grant})

@socketio.on('editor_takeover')
def on_editor_takeover(data):
    """管理員強制接管（需要正確密碼）。"""
    sid = request.sid
    user_id = (data or {}).get('userId')
    password = (data or {}).get('adminPassword', '')
    if not ADMIN_PASSWORD:
        emit('editor_takeover_result', {'success': False, 'message': '伺服器未設定管理員密碼'})
        return
    if password != ADMIN_PASSWORD:
        emit('editor_takeover_result', {'success': False, 'message': '密碼錯誤'})
        return
    # 強制接管
    prev = editor_locks.get(user_id)
    now = _time.time()
    editor_locks[user_id] = {'sid': sid, 'since': now, 'last_activity': now}
    if prev and prev['sid'] != sid:
        try:
            socketio.emit('editor_kicked', {
                'userId': user_id,
                'message': '管理員已接管編輯權，您已切換為檢視者'
            }, to=prev['sid'])
        except Exception:
            pass
    emit('editor_takeover_result', {'success': True})
    _broadcast_editor_state(user_id)
    logger.info(f"[EditorLock] ADMIN takeover: {sid} forced editor for {user_id}")

# API: 查詢目前編輯者
@app.route('/api/editor/status/<user_id>', methods=['GET'])
def editor_status(user_id):
    if not is_valid_user_id(user_id):
        return jsonify({'success': False, 'message': 'Invalid user ID'}), 400
    return jsonify({'success': True, **_get_editor_info(user_id)})

@app.route('/api/editor/debug', methods=['GET'])
def editor_debug():
    """開發/除錯用：回傳目前所有編輯鎖和連線狀態"""
    return jsonify({
        'editor_locks': {
            uid: {'sid': lock['sid'], 'since': lock['since'], 'last_activity': lock['last_activity']}
            for uid, lock in editor_locks.items()
        },
        'user_sockets': {uid: list(sids) for uid, sids in user_sockets.items()},
        'socket_to_user': dict(socket_to_user),
        'pending_requests': {
            uid: [{'sid': r['sid'], 'requested_at': r['requested_at']} for r in reqs]
            for uid, reqs in pending_edit_requests.items()
        }
    })

@app.route('/api/editor/acquire', methods=['POST'])
def editor_acquire_http():
    """HTTP-based editor acquire，用於 WebSocket 不穩時的備援。"""
    data = request.json or {}
    user_id = data.get('userId')
    caller_sid = data.get('socketId')

    if not user_id or not is_valid_user_id(user_id):
        return jsonify({'success': False, 'message': 'Invalid userId'}), 400

    existing = editor_locks.get(user_id)

    # 檢查幽靈鎖
    if existing and existing['sid'] and existing['sid'] not in socket_to_user:
        logger.info(f"[EditorLock/HTTP] Ghost lock for {user_id}, releasing")
        del editor_locks[user_id]
        existing = None

    if existing and caller_sid and existing['sid'] != caller_sid:
        return jsonify({
            'success': False,
            'role': 'viewer',
            'currentEditorSid': existing['sid'],
            'since': existing['since']
        })

    # 授予編輯權
    now = _time.time()
    sid_to_use = caller_sid or f"http-{user_id}-{now}"
    editor_locks[user_id] = {'sid': sid_to_use, 'since': now, 'last_activity': now}
    logger.info(f"[EditorLock/HTTP] {sid_to_use} acquired editor for {user_id}")
    return jsonify({'success': True, 'role': 'editor', 'since': now})

@app.route('/api/editor/takeover', methods=['POST'])
def editor_takeover_http():
    """HTTP-based admin takeover，用於 WebSocket 不穩時的備援。"""
    data = request.json or {}
    user_id = data.get('userId')
    password = data.get('adminPassword', '')
    caller_sid = data.get('socketId')

    if not user_id or not is_valid_user_id(user_id):
        return jsonify({'success': False, 'message': 'Invalid userId'}), 400

    if not ADMIN_PASSWORD:
        return jsonify({'success': False, 'message': '伺服器未設定管理員密碼'}), 403

    if password != ADMIN_PASSWORD:
        return jsonify({'success': False, 'message': '密碼錯誤'}), 403

    prev = editor_locks.get(user_id)
    now = _time.time()
    sid_to_use = caller_sid or f"http-admin-{user_id}-{now}"
    editor_locks[user_id] = {'sid': sid_to_use, 'since': now, 'last_activity': now}

    # 透過 WebSocket 通知被踢出的舊編輯者（若在線）
    if prev and prev['sid'] != sid_to_use:
        try:
            socketio.emit('editor_kicked', {
                'userId': user_id,
                'message': '管理員已接管編輯權，您已切換為檢視者'
            }, to=prev['sid'])
        except Exception:
            pass
        try:
            socketio.emit('editor_changed', _get_editor_info(user_id), room=user_id)
        except Exception:
            pass

    logger.info(f"[EditorLock/HTTP] Admin takeover for {user_id} by {sid_to_use}")
    return jsonify({'success': True, 'role': 'editor', 'since': now})

# --- 健康檢查 / 預熱端點 ---
@app.route('/api/ping', methods=['GET'])
def api_ping():
    """輕量健康檢查。"""
    return jsonify({'status': 'ok', 'ts': _time.time()})

# --- 簡易速率限制（記憶體內，適用於單機部署） ---
from collections import defaultdict

_rate_limit_store = defaultdict(list)  # ip -> [timestamps]
RATE_LIMIT_WINDOW = 60   # 秒
RATE_LIMIT_MAX = 30       # 每 IP 每分鐘最多 30 次請求

def _check_rate_limit():
    """回傳 True 表示超過限制"""
    ip = request.remote_addr or 'unknown'
    now = _time.time()
    # 清理過期記錄
    _rate_limit_store[ip] = [t for t in _rate_limit_store[ip] if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limit_store[ip]) >= RATE_LIMIT_MAX:
        return True
    _rate_limit_store[ip].append(now)
    return False

# ===== 記憶體快取（減少磁碟 I/O，加速讀取）=====
# user_id -> {'data': dict, 'ts': float}
_data_cache = {}
_data_cache_lock = threading.Lock()
DATA_CACHE_TTL = 120  # 快取有效秒數

def _cache_get(user_id):
    """讀取記憶體快取；過期或不存在回傳 None。"""
    with _data_cache_lock:
        entry = _data_cache.get(user_id)
        if entry and (_time.time() - entry['ts']) < DATA_CACHE_TTL:
            return entry['data']
    return None

def _cache_set(user_id, data):
    """寫入記憶體快取。"""
    with _data_cache_lock:
        _data_cache[user_id] = {'data': data, 'ts': _time.time()}

def _cache_invalidate(user_id):
    """清除指定 user_id 的快取。"""
    with _data_cache_lock:
        _data_cache.pop(user_id, None)

# API: Login
@app.route('/api/login', methods=['POST'])
def login():
    if _check_rate_limit():
        return jsonify({'success': False, 'message': 'Too many requests'}), 429

    data = request.json
    if not data:
        return jsonify({'success': False, 'message': 'Invalid request'}), 400

    user_id = data.get('userId')

    if not user_id:
        return jsonify({'success': False, 'message': 'User ID is required'}), 400

    if not is_valid_user_id(user_id):
        return jsonify({'success': False, 'message': 'Invalid user ID format'}), 400

    return jsonify({'success': True, 'message': 'Login successful'})

CURRENT_SCHEMA_VERSION = 1

# 允許的 user_id 字元：英數字、中文、底線、連字號、點（最長 64 字元）
# 允許：英數字、中文、底線、連字號、點、空格（最長 64 字元）
# 禁止：/ \ .. 等路徑穿越字元
_VALID_USER_ID_RE = re.compile(r'^[\w\u4e00-\u9fff.\- ]{1,64}$')

def is_valid_user_id(user_id: str) -> bool:
    """防止路徑穿越攻擊：確保 user_id 只含安全字元（含空格）。"""
    if not user_id:
        return False
    # 額外防護：禁止含 .. / \ 的路徑穿越嘗試
    if '..' in user_id or '/' in user_id or '\\' in user_id:
        return False
    return bool(_VALID_USER_ID_RE.match(user_id))

def migrate_data(data):
    """將舊版 JSON 結構升級至最新版本，保持向後相容。"""
    version = data.get('schemaVersion', 0)

    # v0 → v1：補上 schemaVersion 欄位（首次遷移，無結構變動）
    if version < 1:
        data['schemaVersion'] = 1
        logger.info("Migrated data schema: v0 → v1")

    # 未來版本在此新增 if version < N 區塊

    return data

# API: Get Data
@app.route('/api/data/<user_id>', methods=['GET'])
def get_data(user_id):
    if not is_valid_user_id(user_id):
        return jsonify({'success': False, 'message': 'Invalid user ID'}), 400
    file_path = os.path.join(DATA_DIR, f"{user_id.strip()}.json")

    try:
        # 優先讀取記憶體快取（減少磁碟 I/O）
        cached = _cache_get(user_id)
        if cached is not None:
            return jsonify({'success': True, 'data': cached, 'fromCache': True})

        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            data = migrate_data(data)
            _cache_set(user_id, data)  # 寫入快取
            return jsonify({'success': True, 'data': data})
        else:
            # 本機無資料 → 回傳 null
            return jsonify({'success': True, 'data': None})
    except Exception as e:
        logger.error(f"Error reading data: {e}")
        return jsonify({'success': False, 'message': 'Internal Server Error'}), 500

# API: Save Data
@app.route('/api/data/<user_id>', methods=['POST'])
def save_data(user_id):
    if _check_rate_limit():
        return jsonify({'success': False, 'message': 'Too many requests'}), 429
    if not is_valid_user_id(user_id):
        return jsonify({'success': False, 'message': 'Invalid user ID'}), 400
    req_data = request.json
    if not req_data or not isinstance(req_data, dict):
        return jsonify({'success': False, 'message': 'Invalid request body'}), 400
    
    # 編輯者鎖檢查：若該 userId 已有編輯者，僅該編輯者可存檔
    caller_sid = req_data.get('socketId')
    lock = editor_locks.get(user_id)
    if lock and caller_sid and lock['sid'] != caller_sid:
        return jsonify({
            'success': False,
            'message': '目前您是檢視者，無法儲存。請點「申請編輯權」取得編輯權。',
            'role': 'viewer',
            'currentEditorSid': lock['sid']
        }), 403
    # 若尚無編輯者，視此存檔為自動取得編輯權（向下相容）
    if not lock and caller_sid:
        now = _time.time()
        editor_locks[user_id] = {'sid': caller_sid, 'since': now, 'last_activity': now}
        try:
            socketio.emit('editor_changed', _get_editor_info(user_id), room=user_id)
        except Exception:
            pass
    elif lock and caller_sid and lock['sid'] == caller_sid:
        lock['last_activity'] = _time.time()

    # Check if this is a legacy request (direct data) or enveloped request ({data: ..., lastSyncedTimestamp: ...})
    if 'data' in req_data and 'lastSyncedTimestamp' in req_data:
        new_data = req_data['data']
        client_timestamp = req_data['lastSyncedTimestamp']
        force_save = req_data.get('force', False)
    else:
        # Backward compatibility or simple save
        new_data = req_data
        client_timestamp = None
        force_save = True # Assume force for legacy calls to avoid breaking changes immediately

    file_path = os.path.join(DATA_DIR, f"{user_id.strip()}.json")
    
    try:
        # Apply schema migration to new data
        new_data = migrate_data(new_data)

        # Check for conflicts if not forcing
        if not force_save and os.path.exists(file_path):
            # 優先從快取讀取現有資料（減少磁碟 I/O）
            existing_file_content = _cache_get(user_id)
            if existing_file_content is None:
                with open(file_path, 'r', encoding='utf-8') as f:
                    existing_file_content = json.load(f)
            existing_file_content = migrate_data(existing_file_content)  # Apply migration to existing data

            # Extract timestamp from existing data
            existing_timestamp = existing_file_content.get('timestamp')

            # 統一轉為整數（毫秒）比對，避免格式差異造成誤判
            try:
                ts_server = int(existing_timestamp)
                ts_client = int(client_timestamp)
            except (TypeError, ValueError):
                ts_server = str(existing_timestamp)
                ts_client = str(client_timestamp)

            if ts_server != ts_client:
                logger.warning(f"Conflict detected for {user_id}. Server: {existing_timestamp}, Client saw: {client_timestamp}")
                return jsonify({
                    'success': False,
                    'message': 'Data conflict detected. Please reload.',
                    'serverData': existing_file_content
                }), 409

        # 原子寫入：先寫暫存檔，再用 os.replace 一次性替換，防止寫到一半當機時 JSON 損毀
        tmp_fd, tmp_path = tempfile.mkstemp(dir=DATA_DIR, suffix='.tmp')
        try:
            with os.fdopen(tmp_fd, 'w', encoding='utf-8') as f:
                json.dump(new_data, f, ensure_ascii=False, indent=2)
            os.replace(tmp_path, file_path)
        except Exception:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise

        # 更新記憶體快取（讓下一次 GET 可直接命中快取）
        _cache_set(user_id, new_data)

        # Broadcast update to room
        try:
            # We broadcast the new timestamp so clients know there is a new version
            # We don't broadcast full data (efficiency), just notification
            socket_id = req_data.get('socketId') # Get sender's socket ID
            socketio.emit('data_updated', {
                'timestamp': new_data.get('timestamp'),
                'sourceSocketId': socket_id, # Echo back the sender's socket ID
                'updater': request.remote_addr  # Optional: who updated?
            }, room=user_id)
            logger.info(f"Broadcasted update for room {user_id}")
        except Exception as e:
            logger.warning(f"Socket emit failed: {e}")

        return jsonify({'success': True, 'message': 'Data saved successfully', 'data': new_data})
    except Exception as e:
        logger.error(f"Error writing data: {e}")
        return jsonify({'success': False, 'message': 'Internal Server Error'}), 500


if __name__ == '__main__':
    logger.info(f"Server is running at http://localhost:{PORT}")
    logger.info(f"To share with other computers, use your IP address, e.g., http://192.168.x.x:{PORT}")
    is_debug = os.environ.get('FLASK_DEBUG', '0') == '1'
    # allow_unsafe_werkzeug=True：此應用設計為本地/區網使用，Werkzeug 即可勝任
    socketio.run(app, host='0.0.0.0', port=PORT, debug=is_debug, allow_unsafe_werkzeug=True)
