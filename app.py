import os
import re
import json
import sys
import tempfile
import logging
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
# 僅允許本地端存取；若需開放其他主機，在此陣列中新增
ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]

app = Flask(__name__, static_url_path='', static_folder=STATIC_FOLDER)
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 限制請求大小 5MB
CORS(app, origins=ALLOWED_ORIGINS)
socketio = SocketIO(app, cors_allowed_origins=ALLOWED_ORIGINS)

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
        "script-src 'self' 'unsafe-inline' https://unpkg.com https://accounts.google.com https://cdn.socket.io; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "connect-src 'self' ws: wss: https://script.google.com https://accounts.google.com; "
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
PORT = 3000
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
        
        # If multiple users are present, warn everyone
        if count > 1:
            emit('presence_warning', {
                'message': '目前已有其他用戶修改內容，避免資料無法同步，請稍等',
                'count': count
            }, room=user_id)

@socketio.on('disconnect')
def on_disconnect():
    sid = request.sid
    user_id = socket_to_user.get(sid)
    
    if user_id:
        if user_id in user_sockets:
            user_sockets[user_id].discard(sid)
            if len(user_sockets[user_id]) == 0:
                del user_sockets[user_id]
        
        if sid in socket_to_user:
            del socket_to_user[sid]
            
        logger.info(f"Client {sid} disconnected from {user_id}. Remaining: {len(user_sockets.get(user_id, []))}")

# --- 簡易速率限制（記憶體內，適用於單機部署） ---
from collections import defaultdict
import time as _time

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
_VALID_USER_ID_RE = re.compile(r'^[\w\u4e00-\u9fff.\-]{1,64}$')

def is_valid_user_id(user_id: str) -> bool:
    """防止路徑穿越攻擊：確保 user_id 只含安全字元。"""
    return bool(user_id and _VALID_USER_ID_RE.match(user_id))

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
    file_path = os.path.join(DATA_DIR, f"{user_id}.json")

    try:
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            data = migrate_data(data)
            return jsonify({'success': True, 'data': data})
        else:
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

    file_path = os.path.join(DATA_DIR, f"{user_id}.json")
    
    try:
        # Check for conflicts if not forcing
        if not force_save and os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_file_content = json.load(f)
            
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

        return jsonify({'success': True, 'message': 'Data saved successfully'})
    except Exception as e:
        logger.error(f"Error writing data: {e}")
        return jsonify({'success': False, 'message': 'Internal Server Error'}), 500


if __name__ == '__main__':
    logger.info(f"Server is running at http://localhost:{PORT}")
    logger.info(f"To share with other computers, use your IP address, e.g., http://192.168.x.x:{PORT}")
    is_debug = os.environ.get('FLASK_DEBUG', '0') == '1'
    socketio.run(app, host='0.0.0.0', port=PORT, debug=is_debug, allow_unsafe_werkzeug=is_debug)
