/**
 * 特教課表管理系統 — 前端核心 (script.js)
 *
 * ┌─────────────────────────────────────────────────────┐
 * │  TABLE OF CONTENTS                                  │
 * ├─────────────────────────────────────────────────────┤
 * │  §1   Google OAuth 設定 & 狀態          (~L20)      │
 * │  §2   通用工具 (debounce, store, snackbar) (~L102)  │
 * │  §3   Login & State Management          (~L177)     │
 * │  §4   DOM Elements & Constants          (~L783)     │
 * │  §5   Event Listeners & Init            (~L842)     │
 * │  §6   Data Backup & Restore             (~L1048)    │
 * │  §7   Course Functions (CRUD, render)   (~L1354)    │
 * │  §8   Student Functions (CRUD, render)  (~L1745)    │
 * │  §9   Teacher Functions (CRUD, render)  (~L1898)    │
 * │  §10  Grouping Functions                (~L2045)    │
 * │  §11  Schedule Drag & Drop              (~L2559)    │
 * │  §12  Touch Drag & Drop                 (~L2700)    │
 * │  §13  Master Schedule Functions         (~L2995)    │
 * │  §14  Schedule Generation (Student)     (~L3404)    │
 * │  §15  Print / PDF Schedule              (~L4590)    │
 * │  §16  Word Export Bindings              (~L4699)    │
 * │  §17  Test Exports                      (~L5427)    │
 * └─────────────────────────────────────────────────────┘
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('[SCRIPT] script.js loaded - renderRoleBar should be undefined');
    // Check if running in test environment
    const isTestEnvironment = typeof global !== 'undefined' && global.__IS_TEST__;

    // --- Declare state variables early (before test object creation) ---
    let courses = [];
    let students = [];
    let teachers = [];
    let assignments = {};
    let scheduleData = {};
    let teacherPartTimeMarks = {};
    let scheduleTitle = {};
    let timeSlotOverrides = {};

    // Note: window.__TEST__ is defined later at the end of the callback
    // when all functions are fully defined (around line 6331)

    // Only initialize DOM in production/browser environment
    if (!isTestEnvironment) {
        // --- 版本資訊 ---
        const VERSION_NUMBER = '2026.07.18a';
        const VERSION_DATE = 'May 20, 2026';  // 自動更新日期

        // 初始化版本號顯示
        function initializeVersionDisplay() {
            const sidebarVersionEl = document.getElementById('sidebar-version');
            if (sidebarVersionEl) {
                sidebarVersionEl.textContent = `v${VERSION_NUMBER}`;
                sidebarVersionEl.title = `更新日期: ${VERSION_DATE}`;  // 懸停顯示更新日期
            }
        }

        // 初始化版本號顯示
        initializeVersionDisplay();

        // 初始化簡易課表視圖結構：確保有 course-blocks-pool 和 schedule-container
        const scheduleView = document.getElementById('schedule-view');
        const courseBlocksPool = scheduleView.querySelector('.course-blocks-pool');
        const scheduleContainer = scheduleView.querySelector('.schedule-container');

        if (courseBlocksPool && scheduleContainer) {
            // 創建一個包裝容器
            const wrapper = document.createElement('div');
            wrapper.className = 'schedule-with-pool';

            // 將 scheduleContainer 插入到包裝容器中
            scheduleContainer.parentNode.insertBefore(wrapper, scheduleContainer);

            // 將 courseBlocksPool 移動到包裝容器中（左側）
            wrapper.appendChild(courseBlocksPool);
            wrapper.appendChild(scheduleContainer);
        }
    }

    // --- Expose for Testing (outside isTestEnvironment block) ---
    if (typeof window !== 'undefined') {
        window.__TEST__ = {
            // Utility functions via getters (will be defined later)
            get sanitizeScheduleData() { return typeof sanitizeScheduleData !== 'undefined' ? sanitizeScheduleData : null; },
            get parseTimestamp() { return typeof parseTimestamp !== 'undefined' ? parseTimestamp : null; },
            get syncLocalStorage() { return typeof syncLocalStorage !== 'undefined' ? syncLocalStorage : null; },
            get restoreData() { return typeof restoreData !== 'undefined' ? restoreData : null; },
            get loadDataAndSync() { return typeof loadDataAndSync !== 'undefined' ? loadDataAndSync : null; },
            get saveAllDataToServer() { return typeof saveAllDataToServer !== 'undefined' ? saveAllDataToServer : null; },
            get saveToCustomServer() { return typeof saveToCustomServer !== 'undefined' ? saveToCustomServer : null; },
            get importDataToMemory() { return typeof importDataToMemory !== 'undefined' ? importDataToMemory : null; },
            // Expose state variables via direct references and getters/setters
            get scheduleData() { return scheduleData; },
            get courses() { return courses; },
            set courses(val) { courses = val; },
            get students() { return students; },
            set students(val) { students = val; },
            get CURRENT_USER() { return typeof CURRENT_USER !== 'undefined' ? CURRENT_USER : null; },
            set CURRENT_USER(val) { if (typeof CURRENT_USER !== 'undefined') CURRENT_USER = val; },
            get LAST_SYNCED_TIMESTAMP() { return typeof LAST_SYNCED_TIMESTAMP !== 'undefined' ? LAST_SYNCED_TIMESTAMP : 0; },
            set LAST_SYNCED_TIMESTAMP(val) { if (typeof LAST_SYNCED_TIMESTAMP !== 'undefined') LAST_SYNCED_TIMESTAMP = val; },
            get teachers() { return teachers; },
            set teachers(val) { teachers = val; },
            get assignments() { return assignments; },
            set assignments(val) { assignments = val; },
            // Exposed Functions for Testing via getters
            get handleSaveCourse() { return typeof handleSaveCourse !== 'undefined' ? handleSaveCourse : null; },
            get handleSaveStudent() { return typeof handleSaveStudent !== 'undefined' ? handleSaveStudent : null; },
            get handleSaveTeacher() { return typeof handleSaveTeacher !== 'undefined' ? handleSaveTeacher : null; },
            get openAddCourseModal() { return typeof openAddCourseModal !== 'undefined' ? openAddCourseModal : null; },
            get openAddStudentModal() { return typeof openAddStudentModal !== 'undefined' ? openAddStudentModal : null; },
            get openAddTeacherModal() { return typeof openAddTeacherModal !== 'undefined' ? openAddTeacherModal : null; },
            get renderCourseList() { return typeof renderCourseList !== 'undefined' ? renderCourseList : null; },
            get renderStudentList() { return typeof renderStudentList !== 'undefined' ? renderStudentList : null; },
            get renderTeacherList() { return typeof renderTeacherList !== 'undefined' ? renderTeacherList : null; },
            get renderGroupingWorkspace() { return typeof renderGroupingWorkspace !== 'undefined' ? renderGroupingWorkspace : null; },
            get renderAllGroupsOverview() { return typeof renderAllGroupsOverview !== 'undefined' ? renderAllGroupsOverview : null; },
            get handleZoneDrop() { return typeof handleZoneDrop !== 'undefined' ? handleZoneDrop : null; },
            get renderMasterSchedule() { return typeof renderMasterSchedule !== 'undefined' ? renderMasterSchedule : null; },
            get renderCourseBlocks() { return typeof renderCourseBlocks !== 'undefined' ? renderCourseBlocks : null; },
            get handleScheduleDrop() { return typeof handleScheduleDrop !== 'undefined' ? handleScheduleDrop : null; },
            get deleteCourse() { return typeof window.deleteCourse !== 'undefined' ? window.deleteCourse : null; },
            get deleteStudent() { return typeof window.deleteStudent !== 'undefined' ? window.deleteStudent : null; },
            get deleteTeacher() { return typeof window.deleteTeacher !== 'undefined' ? window.deleteTeacher : null; },
            get removeFromSchedule() { return typeof removeFromSchedule !== 'undefined' ? removeFromSchedule : null; }
        };
    }

    // --- Google OAuth 設定 ---
    // 格式範例：'123456789-abcdefg.apps.googleusercontent.com'
    // 若留空或保持預設值，Google OAuth 功能將被停用（本機 Flask 模式可正常使用）
    const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';

    // --- Google OAuth 狀態 ---
    let googleIdToken = null;
    let googleTokenExp = 0; // Unix timestamp (秒)

    function isGoogleTokenValid() {
        // 檢查 token 是否存在且距離過期還有 60 秒以上
        return !!(googleIdToken && (Date.now() / 1000) < (googleTokenExp - 60));
    }

    function isGoogleOAuthEnabled() {
        return GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID');
    }

    // Google GSI callback（必須掛在 window 上）
    window.handleGoogleCredential = function(response) {
        googleIdToken = response.credential;
        try {
            const b64 = response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(atob(b64));
            googleTokenExp = payload.exp;
            const email = payload.email || '';
            const statusEl = document.getElementById('google-signin-status');
            if (statusEl) {
                statusEl.textContent = `✓ 已驗證：${email}`;
                statusEl.style.color = '#4ade80';
            }
            const btnDiv = document.getElementById('google-signin-btn');
            if (btnDiv) btnDiv.style.display = 'none';
        } catch(e) {
            console.warn('Failed to parse Google credential payload:', e);
        }
    };

    function initGoogleSignIn() {
        if (!isGoogleOAuthEnabled()) return;
        if (typeof google === 'undefined' || !google.accounts) return;

        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: window.handleGoogleCredential,
            auto_select: false,
            context: 'signin'
        });

        const btnDiv = document.getElementById('google-signin-btn');
        if (btnDiv) {
            google.accounts.id.renderButton(btnDiv, {
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                locale: 'zh-TW',
                width: 280
            });
        }

        // 顯示 Google 驗證區塊（設定 User ID 輸入為步驟一）
        const authSection = document.getElementById('google-auth-section');
        if (authSection) {
            authSection.style.display = 'block';
            // 同時更新 subtitle 提示
            const subtitle = document.querySelector('.login-subtitle');
            if (subtitle) subtitle.textContent = '步驟一：輸入您的 ID';
        }
    }

    // GSI 庫載入完成後的 callback
    window.onGoogleLibraryLoad = function() {
        initGoogleSignIn();
    };
    // 也嘗試在 DOMContentLoaded 後初始化（GSI 可能已快取載入）
    setTimeout(() => initGoogleSignIn(), 500);

    // ===== 全域 UI 工具函式 =====

    // --- Snackbar（可復原通知）---
    // --- 通用工具 ---
    function debounce(fn, ms) {
        let id;
        return function (...args) { clearTimeout(id); id = setTimeout(() => fn.apply(this, args), ms); };
    }

    // --- Centralized Data Store ---
    const store = {
        get(key, fallback = null) {
            try {
                const raw = localStorage.getItem(key);
                return raw !== null ? JSON.parse(raw) : fallback;
            } catch { return fallback; }
        },
        set(key, value) {
            localStorage.setItem(key, JSON.stringify(value));
        },
        remove(key) {
            localStorage.removeItem(key);
        },
        getRaw(key) {
            return localStorage.getItem(key);
        },
        setRaw(key, value) {
            localStorage.setItem(key, String(value));
        }
    };

    let _snackbarTimer = null;
    function showSnackbar(message, undoCallback = null, duration = 5000) {
        let sb = document.getElementById('snackbar');
        if (!sb) {
            sb = document.createElement('div');
            sb.id = 'snackbar';
            document.body.appendChild(sb);
        }
        clearTimeout(_snackbarTimer);
        sb.innerHTML = '';
        const msgSpan = document.createElement('span');
        msgSpan.textContent = message;
        sb.appendChild(msgSpan);
        if (undoCallback) {
            const undoBtn = document.createElement('button');
            undoBtn.textContent = '復原';
            undoBtn.className = 'snackbar-undo';
            undoBtn.onclick = () => { undoCallback(); hideSnackbar(); };
            sb.appendChild(undoBtn);
        }
        sb.classList.add('show');
        _snackbarTimer = setTimeout(hideSnackbar, duration);
    }
    function hideSnackbar() {
        const sb = document.getElementById('snackbar');
        if (sb) sb.classList.remove('show');
    }

    // --- Modal 行內錯誤訊息 ---
    function showModalError(message) {
        let el = document.getElementById('modal-error-msg');
        if (!el) {
            el = document.createElement('div');
            el.id = 'modal-error-msg';
            el.className = 'modal-error-msg';
            const body = document.getElementById('modal-body');
            if (body) body.prepend(el);
        }
        el.textContent = message;
        el.style.display = 'block';
        el.scrollIntoView({ block: 'nearest' });
    }
    function clearModalError() {
        const el = document.getElementById('modal-error-msg');
        if (el) el.style.display = 'none';
    }

    // --- Login & State ---
    let CURRENT_USER = null;
    let LAST_SYNCED_TIMESTAMP = null; // Track the base version for optimistic locking
    let PENDING_SAVE_TIMESTAMP = null; // Track our own pending save to ignore self-notifications
    let _isDataStale = false;   // true = 其他裝置已儲存但使用者選擇「忽略」
    let _isSaving = false;      // 防止並行儲存
    let _pendingSave = false;   // 儲存進行中有新儲存需求時，待完成後補執行
    let _pendingSaveForce = false; // 待補執行的儲存是否為 force
    let _baseSnapshot = null;   // 上次同步時的完整快照（用於 field-level merge）
    const SCHEMA_VERSION = 1;   // Schema 版本號（提前宣告供衝突合併使用）

    // --- 編輯者鎖狀態 ---
    let MY_ROLE = null;              // null (尚未確認) | 'editor' | 'viewer'
    let CURRENT_EDITOR_SID = null;   // 目前持有編輯權的 sid（null 表示無人）
    let _editorHeartbeatTimer = null;
    let _incomingRequestModal = null;
    // 動態偵測 API Base URL，自動適配本地開發、GitHub Pages、及任意部署環境
    const API_BASE = (window.location.protocol === 'file:' || window.location.hostname === '')
        ? 'http://localhost:3000/api'          // 以 file:// 開啟的靜態模式，回退到本地伺服器
        : `${window.location.origin}/api`;     // 相對路徑，自動跟隨當前 host

    // 共用 HTTP headers（含 CSRF 防護）
    const API_HEADERS = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    };

    /**
     * 帶逾時的 fetch：超過 timeoutMs 毫秒自動 abort，回傳 null 而不拋例外。
     * 預設 8 秒，適合 Render 免費方案冷啟動場景。
     */
    async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
        // 注：默認超時時間改為 15 秒，適應 Render 冷啟動延遲
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const resp = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(tid);
            return resp;
        } catch (err) {
            clearTimeout(tid);
            if (err.name === 'AbortError') {
                console.warn(`[fetchWithTimeout] 請求逾時 (${timeoutMs}ms): ${url}`);
                return null;
            }
            throw err;
        }
    }

    // Initialize Socket.IO（連線 URL 跟隨 API_BASE 的 origin）
    const SOCKET_URL = (window.location.protocol === 'file:' || window.location.hostname === '')
        ? 'http://localhost:3000'
        : window.location.origin;

    // Socket.IO 配置：增強重連機制，適應 Render 冷啟動延遲
    const socket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionDelay: 1000,           // 首次重連延遲（ms）
        reconnectionDelayMax: 5000,        // 最大重連延遲（ms）
        reconnectionAttempts: 10,          // 最多嘗試 10 次重連
        transports: ['websocket', 'polling'],  // 優先 WebSocket，降級到 polling
        timeout: 20000,                    // 連接超時時間（ms）
        upgrade: true,                     // 允許協議升級
    });

    socket.on('connect', () => {
        console.log('[Socket.IO] ✅ 連接成功');
        if (CURRENT_USER) {
            socket.emit('join', { userId: CURRENT_USER });
        }
    });

    socket.on('disconnect', (reason) => {
        console.warn(`[Socket.IO] ⚠️ 連接中斷：${reason}`);
    });

    socket.on('connect_error', (error) => {
        console.error('[Socket.IO] ❌ 連接錯誤：', error);
    });

    socket.on('reconnect_attempt', () => {
        console.log('[Socket.IO] 🔄 正在重新連接...');
    });

    socket.on('reconnect', () => {
        console.log('[Socket.IO] ✅ 重新連接成功');
        if (CURRENT_USER) {
            socket.emit('join', { userId: CURRENT_USER });
        }
    });

    socket.on('data_updated', (data) => {
        // 自我通知過濾 #1：Socket ID 比對
        if (socket.id && data.sourceSocketId && socket.id === data.sourceSocketId) {
            return;
        }
        // 自我通知過濾 #2：正在儲存的 timestamp 比對（防競態）
        if (PENDING_SAVE_TIMESTAMP && data.timestamp &&
            String(PENDING_SAVE_TIMESTAMP) === String(data.timestamp)) {
            return;
        }
        // 其他裝置已儲存 → 通知使用者
        if (data.timestamp && String(data.timestamp) !== String(LAST_SYNCED_TIMESTAMP)) {
            showDataUpdatedBar();
        }
    });

    socket.on('presence_warning', (data) => {
        // 僅作通知用，角色已由登入時的身分別選擇決定，不在此更動
        showPresenceToast(data.message);
    });


    // --- 編輯權相關事件 (已禁用) ---
    socket.on('editor_acquire_result', (data) => {
        // 編輯權競爭已移除，此事件監聽保留以支持舊版本相容性，但不處理
    });

    socket.on('editor_changed', (state) => {
        CURRENT_EDITOR_SID = state.editorSid;

        if (!state.hasEditor) {
            // 目前無人持有編輯權
            // 若使用者明確選擇「檢視者」，不自動搶位
            if (MY_ROLE === 'viewer') return;
            // 我本來是編輯者（鎖被清了）或尚未取鎖 → 重新 acquire
            socket.emit('editor_acquire', { userId: CURRENT_USER });
            return; // 等 editor_acquire_result 再更新 UI
        }

        if (state.editorSid === socket.id) {
            // 若使用者明確選擇「檢視者」，即使 socket 被識別為 editor 也不升級
            if (MY_ROLE === 'viewer') return;
            MY_ROLE = 'editor';
        } else {
            if (MY_ROLE === 'editor') {
                // 我失去了編輯權（被搶或被接管）
                stopEditorHeartbeat();
            }
            MY_ROLE = 'viewer';
        }
    });

    socket.on('editor_request_incoming', (data) => {
        // 我是目前編輯者，有人申請編輯權
        showIncomingRequestModal(data.requesterSid, data.requesterName);
    });

    socket.on('editor_request_granted', (data) => {
        MY_ROLE = 'editor';
        CURRENT_EDITOR_SID = socket.id;
        startEditorHeartbeat();
        showSnackbar('✏️ 已取得編輯權', null, 2500);
    });

    socket.on('editor_request_denied', () => {
        showSnackbar('對方拒絕讓出編輯權', null, 3000);
    });

    socket.on('editor_request_pending', () => {
        showSnackbar('已送出編輯權申請，等待對方回應...', null, 3000);
    });

    socket.on('editor_slot_available', () => {
        showSnackbar('編輯權已釋放，可再次申請', null, 3000);
    });

    socket.on('editor_kicked', (data) => {
        MY_ROLE = 'viewer';
        stopEditorHeartbeat();
        alert(data.message || '管理員已接管編輯權');
    });

    socket.on('editor_takeover_result', (data) => {
        if (data.success) {
            MY_ROLE = 'editor';
            CURRENT_EDITOR_SID = socket.id;
            startEditorHeartbeat();
            showSnackbar('✏️ 已強制接管編輯權', null, 2500);
        } else {
            alert('接管失敗：' + (data.message || '未知錯誤'));
        }
    });

    /**
     * HTTP-based editor acquire：不依賴 WebSocket，透過 HTTP 確認角色。
     * 若 WebSocket 也有回應，editor_acquire_result 會覆蓋此結果（取較新的）。
     */
    async function acquireEditorViaHttp(userId) {
        try {
            const raw = await fetchWithTimeout(`${API_BASE}/editor/acquire`, {
                method: 'POST',
                headers: API_HEADERS,
                body: JSON.stringify({ userId, socketId: socket.id || null })
            }, 8000);
            const result = raw ? await raw.json() : null;
            if (!result) {
                // 逾時：無法確認鎖狀態，預設保持目前角色（若未設定則為 editor）
                if (MY_ROLE === null) {
                    MY_ROLE = 'editor';
                    CURRENT_EDITOR_SID = socket.id;
                    startEditorHeartbeat();
                }
                return;
            }
            if (result.success) {
                if (MY_ROLE !== 'editor') {
                    MY_ROLE = 'editor';
                    CURRENT_EDITOR_SID = socket.id;
                    startEditorHeartbeat();
                }
            } else {
                if (MY_ROLE !== 'editor') {
                    MY_ROLE = 'viewer';
                    CURRENT_EDITOR_SID = result.currentEditorSid || null;
                }
            }
        } catch (e) {
            console.warn('[EditorLock] HTTP acquire failed, defaulting to editor:', e);
            // 網路錯誤 → 預設為 editor（單人使用不被阻塞）
            if (MY_ROLE === null) {
                MY_ROLE = 'editor';
                CURRENT_EDITOR_SID = socket.id;
                startEditorHeartbeat();
            }
        }
    }

    function startEditorHeartbeat() {
        stopEditorHeartbeat();
        _editorHeartbeatTimer = setInterval(() => {
            if (MY_ROLE === 'editor' && CURRENT_USER) {
                socket.emit('editor_heartbeat', { userId: CURRENT_USER });
            }
        }, 60000); // 每分鐘
    }
    function stopEditorHeartbeat() {
        if (_editorHeartbeatTimer) {
            clearInterval(_editorHeartbeatTimer);
            _editorHeartbeatTimer = null;
        }
    }

    function applyRoleUI() {
        // 編輯權競爭已移除，此函數已空化
    }


    function showIncomingRequestModal(requesterSid, requesterName) {
        if (_incomingRequestModal) _incomingRequestModal.remove();
        const overlay = document.createElement('div');
        _incomingRequestModal = overlay;
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:100001;display:flex;justify-content:center;align-items:center;padding:1rem;';
        const card = document.createElement('div');
        card.style.cssText = 'background:#fff;border-radius:12px;padding:1.75rem 2rem;max-width:420px;box-shadow:0 6px 30px rgba(0,0,0,0.3);';
        card.innerHTML = `
            <h3 style="margin:0 0 0.5rem;color:#1e3a8a;">🔔 有裝置申請編輯權</h3>
            <p style="color:#475569;margin:0 0 1.25rem;">裝置「${escHtml(requesterName)}」(sid: ${escHtml(requesterSid.slice(0,6))}) 想要取得編輯權，是否讓出？</p>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button id="btn-req-keep" style="padding:7px 16px;border-radius:5px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;">保持編輯</button>
                <button id="btn-req-grant" style="padding:7px 16px;border-radius:5px;border:none;background:#059669;color:#fff;font-weight:bold;cursor:pointer;">讓出編輯權</button>
            </div>
        `;
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        card.querySelector('#btn-req-keep').onclick = () => {
            socket.emit('editor_yield', { userId: CURRENT_USER, grant: false, targetSid: requesterSid });
            overlay.remove(); _incomingRequestModal = null;
        };
        card.querySelector('#btn-req-grant').onclick = () => {
            socket.emit('editor_yield', { userId: CURRENT_USER, grant: true, targetSid: requesterSid });
            overlay.remove(); _incomingRequestModal = null;
        };
    }

    function showDataUpdatedBar() {
        let bar = document.getElementById('data-updated-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'data-updated-bar';
            bar.style.cssText = 'position:relative;width:100%;background:linear-gradient(90deg,#1e3a8a 0%,#4338ca 100%);color:#fff;padding:12px 16px;box-shadow:0 2px 8px rgba(0,0,0,0.25);z-index:10001;display:flex;justify-content:center;align-items:center;gap:14px;box-sizing:border-box;font-weight:bold;font-size:1.02em;letter-spacing:0.02em;border-bottom:2px solid #fbbf24;';

            const msg = document.createElement('span');
            msg.innerHTML = '<span style="display:inline-block;animation:dataBarPulse 1.2s ease-in-out infinite;margin-right:4px;">⚠️</span> 其他裝置已更新資料';
            // 注入 keyframes（只注入一次）
            if (!document.getElementById('data-updated-bar-kf')) {
                const style = document.createElement('style');
                style.id = 'data-updated-bar-kf';
                style.textContent = '@keyframes dataBarPulse{0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.25);opacity:0.75;}}';
                document.head.appendChild(style);
            }

            const btnReload = document.createElement('button');
            btnReload.textContent = '🔄 重新載入';
            btnReload.style.cssText = 'background:#fbbf24;color:#1e3a8a;border:none;padding:7px 16px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:0.92em;box-shadow:0 1px 3px rgba(0,0,0,0.2);';
            btnReload.onclick = async () => {
                bar.style.display = 'none';
                _isDataStale = false;
                await loadDataAndSync();
                showSnackbar('已載入最新資料', null, 2000);
            };

            const btnIgnore = document.createElement('button');
            btnIgnore.textContent = '忽略';
            btnIgnore.style.cssText = 'background:transparent;color:#fff;border:1px solid #fff;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:0.9em;';
            btnIgnore.onclick = () => {
                bar.style.display = 'none';
                _isDataStale = true;
            };

            bar.appendChild(msg);
            bar.appendChild(btnReload);
            bar.appendChild(btnIgnore);
            document.body.insertBefore(bar, document.body.firstChild);
        }
        bar.style.display = 'flex';
    }

    function showPresenceToast(message) {
        let toast = document.getElementById('presence-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'presence-toast';
            toast.style.position = 'relative'; // Changed from fixed to relative to push content down
            toast.style.width = '100%';
            toast.style.backgroundColor = '#ff9800'; // Orange warning
            toast.style.color = '#fff';
            toast.style.padding = '10px';
            toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            toast.style.zIndex = '10000';
            toast.style.display = 'flex';
            toast.style.justifyContent = 'center';
            toast.style.alignItems = 'center';
            toast.style.gap = '20px';
            toast.style.boxSizing = 'border-box';

            const msg = document.createElement('span');
            msg.id = 'presence-toast-msg';
            msg.style.fontSize = '1.1em';
            msg.style.fontWeight = 'bold';

            const close = document.createElement('span');
            close.innerHTML = '&times;';
            close.style.cursor = 'pointer';
            close.style.fontSize = '1.5em';
            close.style.opacity = '0.8';
            close.onmouseover = () => close.style.opacity = '1';
            close.onmouseout = () => close.style.opacity = '0.8';
            close.onclick = () => {
                toast.style.display = 'none';
            };

            toast.appendChild(msg);
            toast.appendChild(close);

            // Insert at the very top of body
            document.body.insertBefore(toast, document.body.firstChild);
        }

        toast.querySelector('#presence-toast-msg').textContent = message;
        toast.style.display = 'flex';
    }

    // UI Elements for Login
    const loginSection = document.getElementById('login-section');
    const mainAppSection = document.getElementById('main-app-section');
    const loginBtn = document.getElementById('btn-login');
    const registerBtn = document.getElementById('btn-register');
    const loginInput = document.getElementById('login-id');
    const loginMessage = document.getElementById('login-message');
    const serverStatusEl = document.getElementById('server-status');

    // Render 免費方案冷啟動需 15-30 秒，頁面一打開就先 ping
    // 最多等 50 秒；若超時，仍啟用登入按鈕讓使用者嘗試
    (async function warmUpOnLoad() {
        if (serverStatusEl) serverStatusEl.innerHTML = '🔄 連線伺服器中...';
        if (loginBtn) loginBtn.disabled = true;

        // 設定絕對超時：無論如何，50 秒後啟用登入按鈕
        const absoluteTimeout = setTimeout(() => {
            if (serverStatusEl) serverStatusEl.innerHTML = '⚠️ 伺服器連線較慢，仍可嘗試登入';
            if (loginBtn) loginBtn.disabled = false;
        }, 50000);

        try {
            // 最多等 45 秒（Render 冷啟動最壞情況約 30 秒）
            const resp = await fetchWithTimeout(`${API_BASE}/ping`, {}, 45000);
            clearTimeout(absoluteTimeout);

            if (resp) {
                if (serverStatusEl) serverStatusEl.innerHTML = '✅ 伺服器已連線';
                if (loginBtn) loginBtn.disabled = false;
                // 淡出狀態文字
                setTimeout(() => {
                    if (serverStatusEl) serverStatusEl.style.opacity = '0';
                }, 3000);
            } else {
                if (serverStatusEl) serverStatusEl.innerHTML = '⚠️ 伺服器連線逾時，仍可嘗試登入';
                if (loginBtn) loginBtn.disabled = false;
            }
        } catch (e) {
            clearTimeout(absoluteTimeout);
            if (serverStatusEl) serverStatusEl.innerHTML = '⚠️ 無法連線伺服器，可能為離線模式';
            if (loginBtn) loginBtn.disabled = false;
        }
    })();

    // Login Event Listeners
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
    }
    if (loginInput) {
        loginInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }

    async function handleRegister() {
        const userId = loginInput.value.trim();
        if (!userId) {
            showLoginError('請輸入 User ID 以建立新帳號');
            return;
        }

        if (confirm(`確定要建立新 ID "${userId}" 嗎？\n這將會開啟一個全新的空白課表。\n(請注意：這不會刪除其他 ID 的資料，但會切換到新環境)`)) {
            resetState();
            await handleLogin();
        }
    }

    // 安全工具：將使用者輸入的字串轉義 HTML 特殊字元，防止 XSS 攻擊
    function escHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function resetState() {
        courses = [];
        students = [];
        teachers = [];
        assignments = {};
        scheduleData = {};
        teacherPartTimeMarks = {};
        scheduleTitle = { prefix: '', year: '', semester: '', suffix: '' };
        implementationDates = { startDate: '', endDate: '' };
        studentManualEntries = {};
        slotOverrides = {};
        // 只清除本應用的 key，避免影響同源其他應用的資料
        const APP_STORAGE_KEYS = [
            'courses', 'students', 'teachers', 'assignments', 'scheduleData',
            'teacherPartTimeMarks', 'scheduleTitle', 'implementationDates',
            'studentManualEntries', 'slotOverrides',
            'lastSavedTimestamp', 'lastCloudBackupTimestamp',
            'lastSyncedTimestamp'  // 必須清除，避免新用戶登入時誤判為「本機比伺服器新」
        ];
        APP_STORAGE_KEYS.forEach(k => store.remove(k));

        // 重置暫態存檔狀態（防止上一個登入 session 的 save 狀態殘留）
        PENDING_SAVE_TIMESTAMP = null;
        _isSaving = false;
        _pendingSave = false;
        _pendingSaveForce = false;
        _isDataStale = false;
        _baseSnapshot = null;
        LAST_SYNCED_TIMESTAMP = null;
    }

    // ── 登入流程：驗證 User ID 後直接進入系統 ──
    async function handleLogin() {
        const userId = loginInput.value.trim();
        if (!userId) {
            showLoginError('請輸入 User ID');
            return;
        }

        // 若 Google OAuth 已啟用，則必須先完成 Google 驗證
        if (isGoogleOAuthEnabled() && !isGoogleTokenValid()) {
            showLoginError('請先完成步驟二：點擊上方「以 Google 帳號登入」按鈕');
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = '驗證中...';
        showLoginError('');

        try {
            // 驗證 User ID（第一次嘗試 8 秒；若逾時自動再試 35 秒）
            let loginRaw = await fetchWithTimeout(`${API_BASE}/login`, {
                method: 'POST',
                headers: API_HEADERS,
                body: JSON.stringify({ userId })
            }, 8000);

            if (!loginRaw) {
                loginBtn.textContent = '啟動中...';
                showLoginError('⏳ 伺服器啟動中，請稍候（約 15-30 秒）...');
                loginRaw = await fetchWithTimeout(`${API_BASE}/login`, {
                    method: 'POST',
                    headers: API_HEADERS,
                    body: JSON.stringify({ userId })
                }, 35000);
            }

            const loginResult = loginRaw
                ? await loginRaw.json().catch(() => ({ success: false }))
                : null;

            showLoginError('');

            if (!loginResult) {
                showLoginError('⚠️ 伺服器無回應，以離線模式進入');
                CURRENT_USER = userId;
                await enterApp(null, true);
                return;
            }

            if (!loginResult.success) {
                showLoginError(loginResult.message || '登入失敗，請確認 ID');
                return;
            }

            // 加入 WebSocket 房間
            CURRENT_USER = userId;
            socket.emit('join', { userId });

            // 直接進入系統（無需身份選擇）
            await enterApp();

        } catch (err) {
            console.error(err);
            showLoginError('登入發生錯誤：' + err.message);
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = '登入';
        }
    }


    // ── 進入主 App（載入資料 + 切換畫面）──
    async function enterApp(offlineMode = false) {
        // 清空所有舊資料，進入空白系統
        resetState();

        // 切換畫面：隱藏登入，顯示主應用
        loginSection.style.display = 'none';
        loginSection.classList.add('hidden');
        mainAppSection.style.display = 'flex';

        // 初始化空白系統
        refreshAllViews();

        if (offlineMode) {
            showSnackbar('離線模式：無法連線至伺服器', null, 4000);
        }
    }

    function showLoginError(msg) {
        if (loginMessage) loginMessage.textContent = msg;
    }

    // Helper: Robust Timestamp Parser
    function parseTimestamp(ts) {
        if (!ts) return 0;
        try {
            let date = new Date(ts);
            if (!isNaN(date.getTime())) return date.getTime();
            let cleanTs = ts.replace(/上午|下午|AM|PM/g, ' ').trim();
            const parts = cleanTs.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+):(\d+)/);
            if (parts) {
                let [_, y, m, d, h, min, s] = parts;
                h = parseInt(h);
                if (ts.includes('下午') || ts.includes('PM')) {
                    if (h < 12) h += 12;
                } else if (ts.includes('上午') || ts.includes('AM')) {
                    if (h === 12) h = 0;
                }
                return new Date(y, m - 1, d, h, min, s).getTime();
            }
            return 0;
        } catch (e) {
            console.warn('Date parsing failed for:', ts, e);
            return 0;
        }
    }

    async function loadDataAndSync() {
        let _gasRestoreWasInProgress = false; // 宣告在 try 外，確保 catch 後仍可存取
        try {

            // 從伺服器取得資料（逾時 10 秒，冷啟動時不無限等待）
            const _dataRaw = await fetchWithTimeout(
                `${API_BASE}/data/${encodeURIComponent(CURRENT_USER)}?_t=${Date.now()}`,
                {}, 10000
            );
            const serverResult = _dataRaw
                ? await _dataRaw.json().catch(err => ({ success: false, error: err }))
                : { success: false, error: 'timeout' };

            let bestRemoteData = null;

            // → 顯示還原橫幅讓用戶知道仍在等待，並在 30 秒後自動重試
            if (serverResult && serverResult.error === 'timeout') {
                console.warn('[loadDataAndSync] 伺服器回應逾時，顯示還原橫幅等待重試');
                return {};
            }
            const serverHasData = serverResult && serverResult.success && serverResult.data;

            if (serverHasData) {
                bestRemoteData = serverResult.data;
                // 若本機上次成功儲存的 timestamp 比伺服器更新，表示有儲存未同步至伺服器
                // （例如：儲存進行中被 _isSaving guard 跳過、或儲存請求失敗）
                // 此時以本機 localStorage 資料為主，並補推一次到伺服器
                const lastSyncedTs = parseInt(store.getRaw('lastSyncedTimestamp') || '0');
                const serverTs = parseInt(bestRemoteData.timestamp || '0');
                if (lastSyncedTs > serverTs + 2000) {
                    console.warn(`[loadDataAndSync] 本機已確認同步時間(${lastSyncedTs}) > 伺服器(${serverTs})，以本機 localStorage 為準，補推伺服器`);
                    const localData = getFullDataSnapshot();
                    // 保留本機資料，並在稍後補推（此時 CURRENT_USER 已設定）
                    bestRemoteData = localData;
                    setTimeout(() => saveAllDataToServer(true), 500);
                }

                _gasRestoreWasInProgress = true;
            }

            // --- B. 使用遠端資料 ---
            if (bestRemoteData) {
                importDataToMemory(bestRemoteData);
                LAST_SYNCED_TIMESTAMP = bestRemoteData.timestamp;
                _baseSnapshot = JSON.parse(JSON.stringify(bestRemoteData));
                _isDataStale = false;
            } else if (!_gasRestoreWasInProgress) {
                // 不自動儲存空資料，讓使用者開始輸入後再存
            } else {
            }

        } catch (err) {
            console.warn('Critical error during loadDataAndSync:', err);
        }

        return {};
    }

    async function saveToCustomServer(data) {
        try {
            await fetch(`${API_BASE}/data/${encodeURIComponent(CURRENT_USER)}`, {
                method: 'POST',
                headers: API_HEADERS,
                body: JSON.stringify(data)
            });
        } catch (e) { console.error('Error saving to custom server:', e); }
    }

    let _saveStatusTimer = null;
    function setSaveStatus(state) {
        const el = document.getElementById('save-status-indicator');
        if (!el) return;
        clearTimeout(_saveStatusTimer);
        if (state === 'saving') {
            el.textContent = '儲存中...';
            el.style.color = '#f59e0b';
        } else if (state === 'saved') {
            el.textContent = '✓ 已儲存';
            el.style.color = '#4ade80';
            _saveStatusTimer = setTimeout(() => { el.textContent = ''; }, 3000);
        } else if (state === 'error') {
            el.textContent = '⚠ 儲存失敗';
            el.style.color = '#f87171';
        }
    }

    async function saveAllDataToServer(forceOverride = false) {
        if (!CURRENT_USER) return;

        // 防止並行儲存：若正在儲存中，標記 pending，待本次完成後補執行
        if (_isSaving) {
            _pendingSave = true;
            if (forceOverride) _pendingSaveForce = true;
            return;
        }

        // 資料已過期警告
        if (_isDataStale && !forceOverride) {
            showSnackbar('資料已過期，請先重新載入再儲存', null, 4000);
            return;
        }

        _isSaving = true;
        const data = getFullDataSnapshot();

        // Set pending timestamp BEFORE fetch to catch race-condition events
        PENDING_SAVE_TIMESTAMP = data.timestamp;
        setSaveStatus('saving');

        try {
            const payload = {
                data: data,
                lastSyncedTimestamp: LAST_SYNCED_TIMESTAMP,
                socketId: socket.id,
                force: forceOverride  // 僅在使用者明確選擇「強制覆蓋」或自動合併後才為 true
            };

            const response = await fetchWithTimeout(`${API_BASE}/data/${encodeURIComponent(CURRENT_USER)}`, {
                method: 'POST',
                headers: API_HEADERS,
                body: JSON.stringify(payload)
            }, 15000); // 儲存允許較長（資料量可能較大），但最多 15 秒

            if (!response) {
                setSaveStatus('error');
                showSnackbar('⚠️ 儲存逾時，請確認網路後重試', null, 4000);
                return;
            }

            // --- 409 衝突處理 ---
            if (response.status === 409) {
                const result = await response.json();
                setSaveStatus('error');
                handleConflict(result.serverData);
                return;
            }

            // --- 403 檢視者模式：無編輯權 ---
            if (response.status === 403) {
                const result = await response.json().catch(() => ({}));
                setSaveStatus('error');
                showSnackbar(result.message || '您目前是檢視者，無法儲存', null, 4000);
                // 更新本地角色狀態
                MY_ROLE = 'viewer';
                CURRENT_EDITOR_SID = result.currentEditorSid || null;
                stopEditorHeartbeat();
                return;
            }

            if (!response.ok) {
                throw new Error(`Server returned ${response.status} ${response.statusText}`);
            }

            setSaveStatus('saved');

            // 儲存成功：更新同步狀態
            LAST_SYNCED_TIMESTAMP = data.timestamp;
            store.setRaw('lastSyncedTimestamp', String(data.timestamp)); // 持久化，跨重載可用
            _baseSnapshot = JSON.parse(JSON.stringify(data));
            _isDataStale = false;

            // 隱藏通知條（如果有）
            const bar = document.getElementById('data-updated-bar');
            if (bar) bar.style.display = 'none';

        } catch (err) {
            console.error('Failed to save to server:', err);
            setSaveStatus('error');
        } finally {
            PENDING_SAVE_TIMESTAMP = null;
            _isSaving = false;
            // 若儲存過程中有新的儲存需求，補執行一次
            if (_pendingSave) {
                const wasForce = _pendingSaveForce;
                _pendingSave = false;
                _pendingSaveForce = false;
                setTimeout(() => saveAllDataToServer(wasForce), 200);
            }
        }
    }

    // ===== 多裝置衝突處理 =====

    const MERGEABLE_FIELDS = [
        'courses', 'students', 'teachers', 'assignments',
        'scheduleData', 'teacherPartTimeMarks', 'scheduleTitle',
        'implementationDates', 'studentManualEntries', 'slotOverrides'
    ];
    const FIELD_LABELS = {
        courses: '課程', students: '學生', teachers: '教師',
        assignments: '分組指派', scheduleData: '課表安排',
        teacherPartTimeMarks: '教師兼課標記', scheduleTitle: '課表標題',
        implementationDates: '實施日期', studentManualEntries: '學生手動備註',
        slotOverrides: '時段覆蓋設定'
    };

    /**
     * 欄位層級合併：比對 base、local、server 三方資料
     * @returns {{ merged: Object, conflicts: Array }}
     */
    function fieldLevelMerge(base, local, server) {
        const merged = {};
        const conflicts = [];

        for (const field of MERGEABLE_FIELDS) {
            const baseVal = JSON.stringify(base[field] ?? null);
            const localVal = JSON.stringify(local[field] ?? null);
            const serverVal = JSON.stringify(server[field] ?? null);

            if (localVal === baseVal && serverVal === baseVal) {
                merged[field] = base[field];          // 雙方都沒改
            } else if (localVal === baseVal) {
                merged[field] = server[field];         // 只有伺服器改了 → 自動採用
            } else if (serverVal === baseVal) {
                merged[field] = local[field];          // 只有本機改了 → 自動採用
            } else if (localVal === serverVal) {
                merged[field] = local[field];          // 雙方改成一樣 → 都可以
            } else {
                conflicts.push({ field, local: local[field], server: server[field] });
                merged[field] = server[field];         // 預設用伺服器版，使用者可覆蓋
            }
        }
        return { merged, conflicts };
    }

    /**
     * 衝突入口：先嘗試自動合併，失敗才顯示衝突 UI
     */
    function handleConflict(serverData) {
        if (_baseSnapshot) {
            const localData = getFullDataSnapshot();
            const { merged, conflicts } = fieldLevelMerge(_baseSnapshot, localData, serverData);

            if (conflicts.length === 0) {
                // 自動合併成功！
                merged.timestamp = Date.now();
                merged.schemaVersion = SCHEMA_VERSION;
                importDataToMemory(merged);
                _baseSnapshot = JSON.parse(JSON.stringify(merged));
                LAST_SYNCED_TIMESTAMP = merged.timestamp; // 應用 merged.timestamp，不是 serverData.timestamp
                _isDataStale = false;
                saveAllDataToServer(true); // force 儲存合併結果
                showSnackbar('✅ 已自動合併其他裝置的變更', null, 3000);
                return;
            }

            // 有衝突欄位 → 顯示欄位選擇 UI
            showFieldConflictModal(merged, conflicts, serverData);
            return;
        }

        // 沒有 baseSnapshot → 顯示完整衝突 UI（3 選項）
        showConflictModal(serverData);
    }

    /**
     * 完整衝突 UI：3 個選項（載入伺服器 / 強制覆蓋 / 下載備份後載入）
     */
    function showConflictModal(serverData) {
        removeConflictModal();
        const overlay = document.createElement('div');
        overlay.id = 'conflict-modal';
        overlay.className = 'conflict-modal-overlay';

        overlay.innerHTML = `
            <div class="conflict-modal-card">
                <h3>⚠️ 資料衝突</h3>
                <p>伺服器上的資料已被其他裝置更新，您的本機修改無法直接儲存。</p>
                <div class="conflict-modal-btns">
                    <button class="conflict-btn conflict-btn-reload">🔄 載入伺服器版本</button>
                    <button class="conflict-btn conflict-btn-force">💾 強制覆蓋（以本機為準）</button>
                    <button class="conflict-btn conflict-btn-backup">📋 下載備份後重新載入</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('.conflict-btn-reload').onclick = () => {
            removeConflictModal();
            importDataToMemory(serverData);
            LAST_SYNCED_TIMESTAMP = serverData.timestamp;
            _baseSnapshot = JSON.parse(JSON.stringify(serverData));
            _isDataStale = false;
            renderCurrentView();
            showSnackbar('已載入伺服器版本', null, 2000);
        };

        overlay.querySelector('.conflict-btn-force').onclick = () => {
            removeConflictModal();
            saveAllDataToServer(true);
        };

        overlay.querySelector('.conflict-btn-backup').onclick = () => {
            // 先下載本機備份
            const backup = getFullDataSnapshot();
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `backup_${CURRENT_USER}_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(a.href);

            // 再載入伺服器版本
            removeConflictModal();
            importDataToMemory(serverData);
            LAST_SYNCED_TIMESTAMP = serverData.timestamp;
            _baseSnapshot = JSON.parse(JSON.stringify(serverData));
            _isDataStale = false;
            renderCurrentView();
            showSnackbar('備份已下載，已載入伺服器版本', null, 3000);
        };
    }

    /**
     * 欄位衝突 UI：列出衝突欄位，讓使用者逐一選擇
     */
    function showFieldConflictModal(merged, conflicts, serverData) {
        removeConflictModal();
        const overlay = document.createElement('div');
        overlay.id = 'conflict-modal';
        overlay.className = 'conflict-modal-overlay';

        let fieldsHtml = conflicts.map((c, i) => `
            <div class="conflict-field-row">
                <strong>${escHtml(FIELD_LABELS[c.field] || c.field)}</strong>
                <label><input type="radio" name="conflict_${i}" value="local"> 保留本機版本</label>
                <label><input type="radio" name="conflict_${i}" value="server" checked> 使用伺服器版本</label>
            </div>
        `).join('');

        overlay.innerHTML = `
            <div class="conflict-modal-card">
                <h3>⚠️ 部分欄位衝突</h3>
                <p>以下欄位在本機與伺服器上都有修改，其他欄位已自動合併。</p>
                <div class="conflict-fields">${fieldsHtml}</div>
                <div class="conflict-modal-btns">
                    <button class="conflict-btn conflict-btn-merge">✅ 套用選擇並儲存</button>
                    <button class="conflict-btn conflict-btn-backup">📋 下載備份後使用伺服器版本</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('.conflict-btn-merge').onclick = () => {
            // 根據使用者選擇更新 merged
            conflicts.forEach((c, i) => {
                const choice = overlay.querySelector(`input[name="conflict_${i}"]:checked`);
                if (choice && choice.value === 'local') {
                    merged[c.field] = c.local;
                }
                // server 是預設值，已在 merged 中
            });

            merged.timestamp = Date.now();
            merged.schemaVersion = SCHEMA_VERSION;
            removeConflictModal();
            importDataToMemory(merged);
            _baseSnapshot = JSON.parse(JSON.stringify(merged));
            LAST_SYNCED_TIMESTAMP = serverData.timestamp;
            _isDataStale = false;
            saveAllDataToServer(true);
            renderCurrentView();
            showSnackbar('✅ 衝突已解決，資料已合併儲存', null, 3000);
        };

        overlay.querySelector('.conflict-btn-backup').onclick = () => {
            const backup = getFullDataSnapshot();
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `backup_${CURRENT_USER}_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(a.href);

            removeConflictModal();
            importDataToMemory(serverData);
            LAST_SYNCED_TIMESTAMP = serverData.timestamp;
            _baseSnapshot = JSON.parse(JSON.stringify(serverData));
            _isDataStale = false;
            renderCurrentView();
            showSnackbar('備份已下載，已載入伺服器版本', null, 3000);
        };
    }

    function removeConflictModal() {
        const el = document.getElementById('conflict-modal');
        if (el) el.remove();
    }

    /**
     * 重新渲染當前顯示的頁面
     */
    function renderCurrentView() {
        try {
            renderStudentList();
            renderCourseList();
            renderTeacherList();
            renderMasterSchedule();
        } catch (e) { console.warn('renderCurrentView error:', e); }
    }

    function syncLocalStorage(data, reload = false) {
        if (!data) return;
        store.set('courses', data.courses || []);
        store.set('students', data.students || []);
        store.set('teachers', data.teachers || []);
        store.set('assignments', data.assignments || {});
        store.set('scheduleData', data.scheduleData || {});
        store.set('teacherPartTimeMarks', data.teacherPartTimeMarks || {});
        store.set('scheduleTitle', data.scheduleTitle || { prefix: '', year: '', semester: '', suffix: '' });
        store.set('implementationDates', data.implementationDates || { startDate: '', endDate: '' });
        store.set('studentManualEntries', data.studentManualEntries || {});
        store.set('slotOverrides', data.slotOverrides || {});

        if (reload) {
            window.location.reload();
        }
    }

    function importDataToMemory(data) {
        if (!data) return;

        // Update Variables
        courses = data.courses || [];
        students = data.students || [];
        teachers = data.teachers || [];
        assignments = data.assignments || {};
        scheduleData = data.scheduleData || {};
        teacherPartTimeMarks = data.teacherPartTimeMarks || {};
        scheduleTitle = data.scheduleTitle || { prefix: '', year: '', semester: '', suffix: '' };
        implementationDates = data.implementationDates || { startDate: '', endDate: '' };
        studentManualEntries = data.studentManualEntries || {};
        slotOverrides = data.slotOverrides || {};

        // Update LocalStorage (as backup)
        syncLocalStorage(data, false); // false = do not reload page
        refreshAllViews(); // Force UI update
    }

    function refreshAllViews() {
        if (window.__TEST__ && window.__TEST__.skipRender) return;
        renderCourseList();
        renderStudentList();
        renderTeacherList();
        updateGroupingCourseSelect();
        initializeSchedule();
        renderCourseBlocks();
        renderSchedule();
        initializeScheduleTitle();
        renderMasterSchedule();
    }

    // --- State Management: Load from storage ---
    courses = store.get('courses', []);
    students = store.get('students', []);
    teachers = store.get('teachers', []);
    assignments = store.get('assignments', {}); // { courseId: { groupName: [studentId, ...] } }
    scheduleData = store.get('scheduleData', {}); // { 'monday-1': { courseId, groupName, blockIndex }, ... }
    teacherPartTimeMarks = store.get('teacherPartTimeMarks', {}); // { teacherName: { 'monday-1': true, ... } }
    scheduleTitle = store.get('scheduleTitle', {
        prefix: '',
        year: '',
        semester: '',
        suffix: ''
    });
    let implementationDates = store.get('implementationDates', {
        startDate: '',
        endDate: ''
    });
    let studentManualEntries = store.get('studentManualEntries', {}); // { studentId: { 'monday-1': 'text', ... } }
    let slotOverrides = store.get('slotOverrides', {}); // { slotKey: { courseId: { groupName: [studentId, ...] } } }

    // Sanitize schedule data to remove invalid entries
    sanitizeScheduleData();

    function sanitizeScheduleData() {
        let hasChanges = false;
        Object.keys(scheduleData).forEach(key => {
            let items = scheduleData[key];
            if (!Array.isArray(items)) {
                items = [items];
                hasChanges = true;
            }

            // Filter out invalid items (null, no courseId, or course not found)
            const validItems = items.filter(item => {
                return item && item.courseId && courses.find(c => c.id === item.courseId);
            });

            if (validItems.length !== items.length) {
                hasChanges = true;
                if (validItems.length === 0) {
                    delete scheduleData[key];
                } else {
                    scheduleData[key] = validItems;
                }
            }
        });

        if (hasChanges) {
            store.set('scheduleData', scheduleData);
            saveAllDataToServer();
        }
    }

    // --- DOM Elements ---
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view-container');
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalClose = document.getElementById('modal-close');
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');

    // Modal dirty-state tracking
    let modalDirty = false;
    if (modalBody) {
        modalBody.addEventListener('input', () => { modalDirty = true; });
        modalBody.addEventListener('change', () => { modalDirty = true; });
    }

    // Course Elements
    const btnAddCourse = document.getElementById('btn-add-course');
    const courseListContainer = document.getElementById('course-list');

    // Student Elements
    const btnAddStudent = document.getElementById('btn-add-student');
    const studentListContainer = document.getElementById('student-list');

    // Master Schedule Elements
    const masterScheduleContainer = document.getElementById('master-schedule-container');

    // Teacher Elements
    const btnAddTeacher = document.getElementById('btn-add-teacher');
    const teacherListContainer = document.getElementById('teacher-list');

    // Grouping Elements
    const groupingCourseSelect = document.getElementById('grouping-course-select');
    const groupingWorkspace = document.getElementById('grouping-workspace');
    const groupingEmptyState = document.getElementById('grouping-empty-state');
    const groupsColumnsContainer = document.getElementById('groups-columns');
    const studentPoolContainer = document.getElementById('student-pool');

    // Schedule Elements
    const courseBlocksContainer = document.getElementById('course-blocks-container');

    // --- Constants ---
    const SUBJECTS = [
        '國文', '英文', '數學', '社會', '自然', '藝術', '綜合活動',
        '科技', '健康', '體育', '職業教育', '生活管理', '動作訓練'
    ];

    // Initial Render
    renderCourseList();
    renderStudentList();
    renderTeacherList();
    updateGroupingCourseSelect();
    initializeSchedule();
    renderCourseBlocks();
    renderSchedule();
    initializeScheduleTitle();
    renderMasterSchedule();

    // --- 搜尋框 debounce 綁定 ---
    const _debouncedStudentSearch = debounce(renderStudentList, 200);
    const _debouncedCourseSearch = debounce(renderCourseList, 200);
    const _debouncedTeacherSearch = debounce(renderTeacherList, 200);
    document.getElementById('student-search')?.addEventListener('input', _debouncedStudentSearch);
    document.getElementById('course-search')?.addEventListener('input', _debouncedCourseSearch);
    document.getElementById('teacher-search')?.addEventListener('input', _debouncedTeacherSearch);

    // --- 螢幕旋轉修復：重新計算佈局確保可滾動 ---
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            window.scrollTo(0, 0);
            document.body.style.overflow = '';
            const mc = document.querySelector('.main-content');
            if (mc) mc.style.overflow = '';
        }, 300);
    });

    // --- Event Listeners ---

    // 初始化課表標題輸入監聽
    function initializeScheduleTitle() {
        const titleInputs = {
            'title-prefix': 'prefix',
            'title-year': 'year',
            'title-semester': 'semester',
            'title-suffix': 'suffix'
        };

        Object.keys(titleInputs).forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                const key = titleInputs[id];
                input.value = scheduleTitle[key];
                input.addEventListener('input', (e) => {
                    scheduleTitle[key] = e.target.value;
                    store.set('scheduleTitle', scheduleTitle);
                    saveAllDataToServer();
                });
            }
        });

        // 初始化實施日期輸入
        const startDateInput = document.getElementById('implementation-start-date');
        const endDateInput = document.getElementById('implementation-end-date');

        if (startDateInput) {
            startDateInput.value = implementationDates.startDate;
            startDateInput.addEventListener('input', (e) => {
                implementationDates.startDate = e.target.value;
                store.set('implementationDates', implementationDates);
                saveAllDataToServer();
            });
        }

        if (endDateInput) {
            endDateInput.value = implementationDates.endDate;
            endDateInput.addEventListener('input', (e) => {
                implementationDates.endDate = e.target.value;
                store.set('implementationDates', implementationDates);
                saveAllDataToServer();
            });
        }

        // 匯出 PDF / 列印按鈕
        const exportBtn = document.getElementById('btn-export-schedule');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportSchedulePDF);
        }
    }

    // 匯出 PDF / 列印功能
    function exportSchedulePDF() {
        window.print();
    }

    // Tab Switching
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));
            btn.classList.add('active');
            const viewId = btn.dataset.view + '-view';
            const targetView = document.getElementById(viewId);
            if (targetView) targetView.classList.add('active');

            // Refresh dropdown when entering Groups view
            if (btn.dataset.view === 'groups') {
                updateGroupingCourseSelect();
            }

            // Refresh schedule when entering Schedule view
            if (btn.dataset.view === 'schedule') {
                renderCourseBlocks();
                renderSchedule();
            }

            // Refresh master schedule when entering Master Schedule view
            if (btn.dataset.view === 'master-schedule') {
                renderMasterSchedule();
            }
        });
    });

    // Modal Actions
    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalCancel) modalCancel.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.style.display === 'block') closeModal();
    });

    // Add Course Button
    if (btnAddCourse) {
        btnAddCourse.addEventListener('click', () => {
            openAddCourseModal();
        });
    }

    // Add Student Button
    if (btnAddStudent) {
        btnAddStudent.addEventListener('click', () => {
            openAddStudentModal();
        });
    }

    const btnBatchAddStudent = document.getElementById('btn-batch-add-student');
    if (btnBatchAddStudent) {
        btnBatchAddStudent.addEventListener('click', openBatchAddStudentModal);
    }

    // Add Teacher Button
    if (btnAddTeacher) {
        btnAddTeacher.addEventListener('click', () => {
            openAddTeacherModal();
        });
    }

    // Grouping Course Select
    let currentGroupingCourseId = null; // Track currently selected course
    const btnClearAssignments = document.getElementById('btn-clear-assignments');

    if (groupingCourseSelect && groupingWorkspace) {
        groupingCourseSelect.addEventListener('change', (e) => {
            const courseId = e.target.value;
            currentGroupingCourseId = courseId ? parseInt(courseId) : null;

            if (courseId) {
                // Hide overview, show single course workspace
                document.getElementById('all-groups-overview').style.display = 'none';
                if (groupingEmptyState) groupingEmptyState.style.display = 'none';
                renderGroupingWorkspace(parseInt(courseId));

                // Show clear button
                if (btnClearAssignments) {
                    btnClearAssignments.style.display = 'flex';
                }
            } else {
                if (groupingWorkspace) groupingWorkspace.style.display = 'none';
                document.getElementById('all-groups-overview').style.display = 'none';
                groupingEmptyState.style.display = 'block';

                // Hide clear button
                if (btnClearAssignments) {
                    btnClearAssignments.style.display = 'none';
                }
            }
        });
    }

    // View All Groups Button
    const btnViewAllGroups = document.getElementById('btn-view-all-groups');
    if (btnViewAllGroups) {
        btnViewAllGroups.addEventListener('click', () => {
            // Clear course selection
            if (groupingCourseSelect) groupingCourseSelect.value = '';

            // Hide workspace and empty state, show overview
            groupingWorkspace.style.display = 'none';
            groupingEmptyState.style.display = 'none';

            renderAllGroupsOverview();
        });
    }

    // Export Groups CSV Button
    const btnExportGroupsCSV = document.getElementById('btn-export-groups-csv');
    if (btnExportGroupsCSV) {
        btnExportGroupsCSV.addEventListener('click', exportGroupsCSV);
    }

    // Clear Assignments Button
    if (btnClearAssignments) {
        btnClearAssignments.addEventListener('click', () => {
            if (!currentGroupingCourseId) return;

            const course = courses.find(c => c.id === currentGroupingCourseId);
            if (!course) return;

            if (confirm(`確定要清除「${course.name}」的所有分組嗎?\n所有學生將回到學生池。`)) {
                // Clear all assignments for this course
                if (assignments[currentGroupingCourseId]) {
                    course.groups.forEach(groupName => {
                        assignments[currentGroupingCourseId][groupName] = [];
                    });
                    store.set('assignments', assignments);
                }

                // Re-render the workspace
                renderGroupingWorkspace(currentGroupingCourseId);
            }
        });
    }

    // --- Data Backup & Restore ---
    const btnBackupData = document.getElementById('btn-backup-data');
    const btnRestoreData = document.getElementById('btn-restore-data');
    const btnExportPortable = document.getElementById('btn-export-portable');
    const fileRestoreData = document.getElementById('file-restore-data');

    // 1. Standard Backup (JSON Download)
    if (btnBackupData) {
        btnBackupData.addEventListener('click', () => {
            const data = getFullDataSnapshot();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const dateStr = getFormattedDate();
            a.download = `特教課表系統_${CURRENT_USER}_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    const btnLogout = document.getElementById('btn-logout');

    if (btnLogout) {
        btnLogout.addEventListener('click', handleLogout);
    }

    function doLogout() {
        // 清除 Google OAuth 狀態
        if (isGoogleOAuthEnabled() && typeof google !== 'undefined' && google.accounts) {
            google.accounts.id.disableAutoSelect();
        }
        googleIdToken = null;
        googleTokenExp = 0;
        location.reload();
    }

    // 2. Portable Export (data.js Download)
    if (btnExportPortable) {
        btnExportPortable.addEventListener('click', () => {
            const data = getFullDataSnapshot();
            const jsContent = `window.portableData = ${JSON.stringify(data, null, 2)};`;
            const blob = new Blob([jsContent], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'data.js';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showSnackbar('攜帶檔 (data.js) 已建立！請儲存在 index.html 同一資料夾內。');
        });
    }

    // 3. Restore from JSON File (Enhanced to support data.js)
    if (btnRestoreData && fileRestoreData) {
        // Update accept attribute to allow .js files
        fileRestoreData.setAttribute('accept', '.json,.js');

        btnRestoreData.addEventListener('click', () => fileRestoreData.click());

        fileRestoreData.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    let content = event.target.result;

                    // Pre-processing: If it's a data.js file, strip the assignment
                    if (content.trim().startsWith('window.portableData =')) {
                        content = content.replace('window.portableData =', '').trim();
                        // Remove trailing semicolon if present
                        if (content.endsWith(';')) {
                            content = content.slice(0, -1);
                        }
                    }

                    const data = JSON.parse(content);

                    if (confirm(`確定要還原 ${data.timestamp || '此備份檔案'} 嗎？\n這將會覆蓋現有的所有資料！`)) {
                        restoreData(data, false);
                    }
                } catch (err) {
                    showSnackbar('還原失敗：檔案格式錯誤，請確認為正確的備份檔。');
                    console.error(err);
                }
                fileRestoreData.value = ''; // Reset
            };
            reader.readAsText(file);
        });
    }

    // 4. Auto-Import from data.js (Portable Mode)
    if (window.portableData) {

        const localTimestampStr = store.getRaw('lastSavedTimestamp');
        const portableTimestampStr = window.portableData.timestamp;

        // Has local data?
        const hasLocalData = store.getRaw('courses') && store.get('courses', []).length > 0;

        if (!hasLocalData) {
            restoreData(window.portableData, false);
            // Reload to ensure all variables are initialized correctly with new data
            location.reload();
        } else {
            // Compare timestamps
            if (localTimestampStr === portableTimestampStr) {
            } else {
                const localTime = new Date(localTimestampStr).getTime();
                const portableTime = new Date(portableTimestampStr).getTime();
                let message = '';

                if (portableTime > localTime) {
                    message = `偵測到較新的攜帶檔資料 (data.js)！\n\n攜帶檔時間：${portableTimestampStr}\n您的資料時間：${localTimestampStr}\n\n是否要更新為攜帶檔的資料？`;
                } else {
                    message = `偵測到較舊的攜帶檔資料 (data.js)！\n\n攜帶檔時間：${portableTimestampStr}\n您的資料時間：${localTimestampStr}\n\n是否要還原為舊資料？`;
                }

                if (confirm(message)) {
                    restoreData(window.portableData);
                }
            }
        }
    }

    // Helper: Get Full Data Snapshot
    // 直接讀取記憶體中的全域變數，確保取得最新狀態
    // 不從 localStorage 讀取，避免「更新記憶體但 localStorage 尚未同步」時快照過舊的問題
    function getFullDataSnapshot() {
        return {
            schemaVersion: SCHEMA_VERSION,
            timestamp: Date.now(), // UTC 毫秒整數，避免時區格式差異造成比對錯誤
            courses: courses,
            teachers: teachers,
            students: students,
            scheduleData: scheduleData,
            assignments: assignments,
            implementationDates: implementationDates,
            teacherPartTimeMarks: teacherPartTimeMarks,
            studentManualEntries: studentManualEntries,
            slotOverrides: slotOverrides,
            scheduleTitle: scheduleTitle
        };
    }

    // Helper: Timestamp String
    function getTimestampStr() {
        return new Date().toISOString().slice(0, 10).replace(/-/g, '');
    }

    // Helper: Restore Data
    function restoreData(data, reload = true) {
        // Save to localStorage
        if (data.courses) store.set('courses', data.courses);
        if (data.teachers) store.set('teachers', data.teachers);
        if (data.students) store.set('students', data.students);
        if (data.scheduleData) store.set('scheduleData', data.scheduleData);
        if (data.assignments) store.set('assignments', data.assignments);
        if (data.implementationDates) store.set('implementationDates', data.implementationDates);
        if (data.teacherPartTimeMarks) store.set('teacherPartTimeMarks', data.teacherPartTimeMarks);
        if (data.studentManualEntries) store.set('studentManualEntries', data.studentManualEntries);
        if (data.slotOverrides) store.set('slotOverrides', data.slotOverrides);
        if (data.scheduleTitle) store.set('scheduleTitle', data.scheduleTitle);

        store.setRaw('lastSavedTimestamp', data.timestamp || Date.now());

        // Update in-memory variables to match restored data
        if (data.courses) courses = data.courses;
        if (data.teachers) teachers = data.teachers;
        if (data.students) students = data.students;
        if (data.scheduleData) scheduleData = data.scheduleData;
        if (data.assignments) assignments = data.assignments;
        if (data.implementationDates) implementationDates = data.implementationDates;
        if (data.teacherPartTimeMarks) teacherPartTimeMarks = data.teacherPartTimeMarks;
        if (data.studentManualEntries) studentManualEntries = data.studentManualEntries;
        if (data.slotOverrides) timeSlotOverrides = data.slotOverrides;
        if (data.scheduleTitle) scheduleTitle = data.scheduleTitle;

        // Refresh UI to display restored data
        refreshAllViews();

        // Sync restored data to server（使用者主動匯入，強制覆蓋）
        saveAllDataToServer(true);

        if (reload) {
            showSnackbar('資料載入成功！網頁將自動重新整理。');
            setTimeout(() => location.reload(), 1500);
        } else {
            showSnackbar('資料匯入成功！');
        }
    }

    // --- Course Functions ---

    let editingCourseId = null; // Track if we are editing a course

    function openAddCourseModal(courseToEdit = null) {
        editingCourseId = courseToEdit ? courseToEdit.id : null;
        modalTitle.textContent = courseToEdit ? '編輯課程' : '新增課程';

        // Generate teacher options
        const teacherOptions = teachers.map(t => `<option value="${escHtml(t.name)}">${escHtml(t.name)}</option>`).join('');

        modalBody.innerHTML = `
            <div class="form-group">
                <label>課程名稱</label>
                <select id="subject-select" class="form-control">
                    ${SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join('')}
                    <option value="自訂">自訂</option>
                </select>
            </div>
            <div class="form-group" id="custom-subject-group" style="display: none;">
                <label>自訂名稱</label>
                <input type="text" id="custom-subject-input" class="form-control" placeholder="請輸入課程名稱">
            </div>
            <div class="form-group">
                <label>分組數 (1-4)</label>
                <select id="group-count" class="form-control">
                    <option value="1">1 組</option>
                    <option value="2">2 組</option>
                    <option value="3">3 組</option>
                    <option value="4">4 組</option>
                </select>
            </div>
            <div class="form-group">
                <label>每週節數 (所有分組相同)</label>
                <select id="course-hours-input" class="form-control">
                    <option value="0">0 節</option>
                    <option value="1">1 節</option>
                    <option value="2">2 節</option>
                    <option value="3">3 節</option>
                    <option value="4">4 節</option>
                    <option value="5">5 節</option>
                    <option value="6">6 節</option>
                    <option value="7">7 節</option>
                    <option value="8">8 節</option>
                </select>
            </div>
            <div class="form-group">
                <label>分組詳細設定</label>
                <div id="group-preview" class="group-preview">
                    <!-- Dynamic inputs -->
                </div>
            </div>
        `;

        const subjectSelect = document.getElementById('subject-select');
        const customGroup = document.getElementById('custom-subject-group');
        const groupCount = document.getElementById('group-count');
        const courseHoursInput = document.getElementById('course-hours-input');
        const customInput = document.getElementById('custom-subject-input');

        // Populate data if editing
        if (courseToEdit) {
            if (SUBJECTS.includes(courseToEdit.name)) {
                subjectSelect.value = courseToEdit.name;
            } else {
                subjectSelect.value = '自訂';
                customGroup.style.display = 'block';
                customInput.value = courseToEdit.name;
            }
            groupCount.value = courseToEdit.groups.length;

            // Assuming hours are same for all groups, take from first group
            const firstGroup = courseToEdit.groups[0];
            if (courseToEdit.groupDetails && courseToEdit.groupDetails[firstGroup]) {
                courseHoursInput.value = courseToEdit.groupDetails[firstGroup].hours || '0';
            }
        }

        const updateHandler = () => updateGroupPreview(courseToEdit);

        subjectSelect.addEventListener('change', () => {
            if (subjectSelect.value === '自訂') {
                customGroup.style.display = 'block';
            } else {
                customGroup.style.display = 'none';
            }
            updateHandler();
        });

        document.getElementById('custom-subject-input').addEventListener('input', updateHandler);
        groupCount.addEventListener('change', updateHandler);

        // Pass teacher options to updateGroupPreview
        window.currentTeacherOptions = teacherOptions;
        updateHandler();
        modalConfirm.onclick = handleSaveCourse;
        modal.style.display = 'block'; modalDirty = false;
    }

    function updateGroupPreview(courseToEdit = null) {
        const subjectSelect = document.getElementById('subject-select');
        const customInput = document.getElementById('custom-subject-input');
        const groupCount = parseInt(document.getElementById('group-count').value);
        const previewContainer = document.getElementById('group-preview');

        let baseName = subjectSelect.value;
        if (baseName === '自訂') {
            baseName = customInput.value.trim() || '課程名稱';
        }

        let html = '';
        const suffixes = ['A', 'B', 'C', 'D'];

        for (let i = 0; i < groupCount; i++) {
            let groupName = baseName;
            if (groupCount > 1) {
                groupName += ' ' + suffixes[i];
            }

            // If editing, try to preserve existing group name, room, and teachers
            let existingRoom = '待訂';
            let existingTeacher1 = '';
            let existingTeacher2 = '';
            let existingGroupName = groupName; // Default to generated name
            let existingDisplayRoom = '';
            // Standard room options
            const standardRooms = ['待訂', '132教室', '133教室', '136教室', '137教室', '綜合球場'];
            let isCustomRoom = false;
            let customRoomValue = '';

            if (courseToEdit && courseToEdit.groups[i]) {
                const oldGroupName = courseToEdit.groups[i];
                existingGroupName = oldGroupName; // Use the saved group name
                if (courseToEdit.groupDetails && courseToEdit.groupDetails[oldGroupName]) {
                    existingRoom = courseToEdit.groupDetails[oldGroupName].room || '待訂';
                    existingDisplayRoom = courseToEdit.groupDetails[oldGroupName].displayRoom || '';
                    const teacherData = courseToEdit.groupDetails[oldGroupName].teacher;
                    // Handle both old format (string) and new format (array)
                    if (Array.isArray(teacherData)) {
                        existingTeacher1 = teacherData[0] || '';
                        existingTeacher2 = teacherData[1] || '';
                    } else {
                        existingTeacher1 = teacherData || '';
                    }
                }
            }

            // Check if existing room is custom (not in standard list)
            if (!standardRooms.includes(existingRoom)) {
                isCustomRoom = true;
                customRoomValue = existingRoom;
            }

            html += `
                <div class="group-preview-item" style="border: 1px solid #eee; padding: 15px; margin-bottom: 15px; border-radius: 8px; background: #f9f9f9;">
                    <div style="font-weight: bold; margin-bottom: 10px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
                        分組 ${suffixes[i]} 設定
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group" style="grid-column: 1 / -1;">
                            <label>分組名稱</label>
                            <input type="text" class="form-control group-name-input" value="${existingGroupName}">
                        </div>
                        
                        <div class="form-group">
                            <label>授課教師 1</label>
                            <select class="form-control group-teacher-input-1">
                                <option value="">請選擇教師</option>
                                <option value="未排">未排</option>
                                ${teachers.map(t => `<option value="${t.name}" ${t.name === existingTeacher1 ? 'selected' : ''}>${t.name}</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group">
                            <label>授課教師 2 (選填)</label>
                            <select class="form-control group-teacher-input-2">
                                <option value="">無</option>
                                ${teachers.map(t => `<option value="${t.name}" ${t.name === existingTeacher2 ? 'selected' : ''}>${t.name}</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group" style="grid-column: 1 / -1;">
                            <label>教室</label>
                            <select class="form-control group-room-input" data-group-index="${i}">
                                <option value="待訂" ${!isCustomRoom && existingRoom === '待訂' ? 'selected' : ''}>待訂 (請選擇)</option>
                                <option value="132教室" ${!isCustomRoom && existingRoom === '132教室' ? 'selected' : ''}>132教室</option>
                                <option value="133教室" ${!isCustomRoom && existingRoom === '133教室' ? 'selected' : ''}>133教室</option>
                                <option value="136教室" ${!isCustomRoom && existingRoom === '136教室' ? 'selected' : ''}>136教室</option>
                                <option value="137教室" ${!isCustomRoom && existingRoom === '137教室' ? 'selected' : ''}>137教室</option>
                                <option value="綜合球場" ${!isCustomRoom && existingRoom === '綜合球場' ? 'selected' : ''}>綜合球場</option>
                                <option value="自訂" ${isCustomRoom ? 'selected' : ''}>自訂</option>
                            </select>
                        </div>
                        
                        <div class="form-group custom-room-input-group" data-group-index="${i}" style="grid-column: 1 / -1; display: ${isCustomRoom ? 'block' : 'none'};">
                            <label>自訂教室名稱</label>
                            <input type="text" class="form-control custom-room-input" placeholder="請輸入教室名稱" value="${customRoomValue}">
                        </div>

                        <div class="form-group" style="grid-column: 1 / -1;">
                            <label>教室課表顯示教室 (選填)</label>
                            <div style="font-size: 0.8rem; color: #666; margin-bottom: 5px;">若填寫此欄位，在「教室課表 (個別)」中，此課程將顯示於指定教室，而非上方設定的原始教室。其他課表不受影響。</div>
                            <input type="text" class="form-control display-room-input" placeholder="請輸入教室名稱 (例如：七年級教室)" value="${existingDisplayRoom}">
                        </div>
                    </div>
                </div>
            `;
        }
        previewContainer.innerHTML = html;

        // Add event listeners for room select dropdowns to toggle custom input
        const roomSelects = previewContainer.querySelectorAll('.group-room-input');
        roomSelects.forEach(select => {
            select.addEventListener('change', (e) => {
                const groupIndex = e.target.dataset.groupIndex;
                const customInputGroup = previewContainer.querySelector(`.custom-room-input-group[data-group-index="${groupIndex}"]`);
                if (customInputGroup) {
                    customInputGroup.style.display = e.target.value === '自訂' ? 'block' : 'none';
                }
            });
        });
    }

    function handleSaveCourse() {
        clearModalError();
        const subjectSelect = document.getElementById('subject-select');
        const customInput = document.getElementById('custom-subject-input');

        let subjectName = subjectSelect.value;
        if (subjectName === '自訂') {
            subjectName = customInput.value.trim();
            if (!subjectName) {
                showModalError('請輸入課程名稱！');
                return;
            }
        }

        // Get shared settings
        const courseHours = document.getElementById('course-hours-input').value;

        const groupItems = document.querySelectorAll('.group-preview-item');
        const groupNames = [];
        const groupDetails = {};

        groupItems.forEach(item => {
            const nameInput = item.querySelector('.group-name-input');
            const roomInput = item.querySelector('.group-room-input');
            const customRoomInput = item.querySelector('.custom-room-input');
            const teacherInput1 = item.querySelector('.group-teacher-input-1');
            const teacherInput2 = item.querySelector('.group-teacher-input-2');

            const name = nameInput.value.trim();
            groupNames.push(name);

            // Collect teachers into array, filter out empty values
            const teachers = [teacherInput1.value, teacherInput2.value].filter(t => t && t !== '');

            // Get room value: if "自訂" is selected, use custom input; otherwise use dropdown
            let roomValue = roomInput.value;
            if (roomValue === '自訂' && customRoomInput) {
                roomValue = customRoomInput.value.trim() || '待訂';
            }

            const displayRoomInput = item.querySelector('.display-room-input');
            const displayRoomValue = displayRoomInput ? displayRoomInput.value.trim() : '';

            groupDetails[name] = {
                hours: courseHours,
                room: roomValue,
                teacher: teachers.length > 0 ? teachers : [],
                displayRoom: displayRoomValue
            };
        });

        // Validate group names: non-empty and unique within this course
        for (const gName of groupNames) {
            if (!gName) {
                showModalError('分組名稱不可為空，請填寫所有分組名稱。');
                return;
            }
        }
        if (new Set(groupNames).size !== groupNames.length) {
            showModalError('分組名稱不可重複，請修正後再儲存。');
            return;
        }

        if (editingCourseId) {
            // Update existing course
            const index = courses.findIndex(c => c.id === editingCourseId);
            if (index !== -1) {
                courses[index].name = subjectName;
                courses[index].groups = groupNames;
                courses[index].groupDetails = groupDetails;
            }
        } else {
            // Create new course
            const newCourse = {
                id: Date.now(),
                name: subjectName,
                groups: groupNames,
                groupDetails: groupDetails
            };
            courses.push(newCourse);
        }

        saveCourses();
        renderCourseList();
        updateGroupingCourseSelect();
        renderMasterSchedule();
        closeModal();
        editingCourseId = null;
    }

    function saveCourses() {
        store.set('courses', courses);
        saveAllDataToServer();
    }

    window.editCourse = function (courseId) {
        const course = courses.find(c => c.id === courseId);
        if (course) {
            openAddCourseModal(course);
        }
    };

    function renderCourseList() {
        if (!courseListContainer) return;

        const searchVal = (document.getElementById('course-search')?.value || '').trim().toLowerCase();

        if (courses.length === 0) {
            courseListContainer.innerHTML = '<div class="empty-state">尚未新增任何課程</div>';
            return;
        }

        const filteredCourses = searchVal ? courses.filter(c => c.name.toLowerCase().includes(searchVal)) : courses;

        if (filteredCourses.length === 0) {
            courseListContainer.innerHTML = '<div class="empty-state">無符合的課程</div>';
            return;
        }

        courseListContainer.innerHTML = filteredCourses.map(course => {
            // 防禦性檢查：確保 groups 是陣列
            if (!Array.isArray(course.groups) || course.groups.length === 0) {
                console.warn('Invalid course data (missing or invalid groups):', course);
                return ''; // 跳過此課程
            }

            // Get hours from first group (assuming shared)
            const firstGroup = course.groups[0];
            const hours = course.groupDetails && course.groupDetails[firstGroup] ? course.groupDetails[firstGroup].hours : '0';

            return `
            <div class="course-item-card">
                <div class="course-item-header">
                    <div class="course-item-title">${escHtml(course.name)} <span style="font-size: 0.8rem; color: #666; font-weight: normal;">(${hours} 節)</span></div>
                    <div class="course-actions">
                        <button class="btn-secondary btn-sm" onclick="editCourse(${course.id})">編輯</button>
                        <button class="btn-secondary btn-sm" onclick="deleteCourse(${course.id})">刪除</button>
                    </div>
                </div>
                <div class="course-item-groups">
                    ${course.groups.map(g => {
                const details = course.groupDetails && course.groupDetails[g] ? course.groupDetails[g] : {};
                const room = details.room || '待訂';
                const teacherData = details.teacher;
                // Handle both array and string formats
                let teacherDisplay = '未排';
                if (Array.isArray(teacherData)) {
                    teacherDisplay = teacherData.filter(t => t && t !== '').map(escHtml).join(', ') || '未排';
                } else if (teacherData) {
                    teacherDisplay = escHtml(teacherData);
                }
                return `
                            <div class="group-tag-container" style="display: flex; flex-direction: column; gap: 2px; align-items: flex-start;">
                                <span class="group-tag">${escHtml(g)}</span>
                                <div style="font-size: 0.8rem; color: #666; display: flex; gap: 5px;">
                                    <span>👨‍🏫 ${teacherDisplay}</span>
                                    <span>🏠 ${escHtml(room)}</span>
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>
            </div>
            `;
        }).filter(html => html).join('');
    }

    // --- Student Functions ---

    function openAddStudentModal() {
        modalTitle.textContent = '新增學生';
        modalBody.innerHTML = `
            <div class="form-group">
                <label>學生姓名</label>
                <input type="text" id="student-name" class="form-control" placeholder="請輸入姓名">
            </div>
            <div class="form-group">
                <label>年級</label>
                <select id="student-grade" class="form-control">
                    <option value="7">7 年級</option>
                    <option value="8">8 年級</option>
                    <option value="9">9 年級</option>
                </select>
            </div>
        `;

        modalConfirm.onclick = handleSaveStudent;
        modal.style.display = 'block'; modalDirty = false;
    }

    function openBatchAddStudentModal() {
        modalTitle.textContent = '批次新增學生';
        modalBody.innerHTML = `
            <div class="form-group">
                <label>年級</label>
                <select id="batch-student-grade" class="form-control">
                    <option value="7">7 年級</option>
                    <option value="8">8 年級</option>
                    <option value="9">9 年級</option>
                </select>
            </div>
            <div class="form-group">
                <label>學生姓名（每行一位）</label>
                <div class="batch-add-area">
                    <textarea id="batch-student-names" placeholder="例如：\n王小明\n李小華\n張志遠"></textarea>
                </div>
                <div class="batch-hint">每行輸入一個姓名，空白行將略過，已存在的姓名不會重複新增。</div>
            </div>
        `;
        modalConfirm.onclick = handleBatchSaveStudents;
        modal.style.display = 'block'; modalDirty = false;
        setTimeout(() => document.getElementById('batch-student-names')?.focus(), 100);
    }

    function handleBatchSaveStudents() {
        clearModalError();
        const grade = parseInt(document.getElementById('batch-student-grade').value);
        const raw = document.getElementById('batch-student-names').value;
        const names = raw.split('\n').map(n => n.trim()).filter(n => n.length > 0);

        if (names.length === 0) {
            showModalError('請輸入至少一個學生姓名。');
            return;
        }

        const existingNames = new Set(students.map(s => s.name));
        const added = [];
        const skipped = [];

        names.forEach(name => {
            if (existingNames.has(name)) {
                skipped.push(name);
            } else {
                students.push({ id: Date.now() + Math.random(), name, grade });
                existingNames.add(name);
                added.push(name);
            }
        });

        if (added.length > 0) {
            saveStudents();
            renderStudentList();
        }

        closeModal();

        if (skipped.length > 0) {
            showSnackbar(`已新增 ${added.length} 位學生，略過 ${skipped.length} 位（已存在）`);
        } else {
            showSnackbar(`已新增 ${added.length} 位學生`);
        }
    }

    function handleSaveStudent() {
        clearModalError();
        const nameInput = document.getElementById('student-name');
        const gradeInput = document.getElementById('student-grade');

        const name = nameInput.value.trim();
        if (!name) {
            showModalError('請輸入學生姓名！');
            return;
        }

        if (students.some(s => s.name === name)) {
            showModalError(`學生「${name}」已存在，請使用不同的姓名。`);
            return;
        }

        const newStudent = {
            id: Date.now(),
            name: name,
            grade: gradeInput.value
        };

        students.push(newStudent);
        saveStudents();
        renderStudentList();
        closeModal();
    }

    function saveStudents() {
        store.set('students', students);
        saveAllDataToServer();
    }

    function renderStudentList() {
        if (!studentListContainer) return;

        const searchVal = (document.getElementById('student-search')?.value || '').trim().toLowerCase();

        if (students.length === 0) {
            studentListContainer.innerHTML = '<div class="empty-state">尚未新增任何學生</div>';
            return;
        }

        // Sort by grade (9 -> 7) then name
        const sortedStudents = [...students]
            .filter(s => !searchVal || s.name.toLowerCase().includes(searchVal))
            .sort((a, b) => {
                if (b.grade !== a.grade) return b.grade - a.grade;
                return a.name.localeCompare(b.name);
            });

        if (sortedStudents.length === 0) {
            studentListContainer.innerHTML = '<div class="empty-state">無符合的學生</div>';
            return;
        }

        studentListContainer.innerHTML = sortedStudents.map(student => `
            <div class="student-card">
                <div class="student-info">
                    <span class="student-grade" onclick="toggleGrade(event, ${student.id})" style="cursor: pointer;" title="點擊切換年級">${escHtml(String(student.grade))}</span>
                    ${escHtml(student.name)}
                </div>
                <button class="btn-secondary" style="padding: 2px 8px; font-size: 0.8rem;" onclick="deleteStudent(${student.id})">刪除</button>
            </div>
        `).join('');
    }

    // --- Teacher Functions ---

    let editingTeacherId = null;

    function openAddTeacherModal(teacherToEdit = null) {
        editingTeacherId = teacherToEdit ? teacherToEdit.id : null;
        modalTitle.textContent = teacherToEdit ? '編輯教師' : '新增教師';
        modalBody.innerHTML = `
            <div class="form-group">
                <label>教師姓名</label>
                <input type="text" id="teacher-name" class="form-control" placeholder="請輸入姓名" value="${teacherToEdit ? escHtml(teacherToEdit.name) : ''}">
            </div>
            <div class="form-group">
                <label>基本鐘點</label>
                <input type="number" id="teacher-base-hours" class="form-control" placeholder="請輸入基本鐘點" min="0" value="${teacherToEdit ? teacherToEdit.baseHours || 0 : ''}">
            </div>
        `;

        modalConfirm.onclick = handleSaveTeacher;
        modal.style.display = 'block'; modalDirty = false;
    }

    function handleSaveTeacher() {
        clearModalError();
        const nameInput = document.getElementById('teacher-name');
        const name = nameInput.value.trim();

        if (!name) {
            showModalError('請輸入教師姓名！');
            return;
        }

        const baseHours = parseInt(document.getElementById('teacher-base-hours').value) || 0;

        if (editingTeacherId) {
            // Edit existing teacher
            const index = teachers.findIndex(t => t.id === editingTeacherId);
            if (index !== -1) {
                // Check duplicate name (excluding self)
                if (teachers.some(t => t.name === name && t.id !== editingTeacherId)) {
                    showModalError(`教師「${name}」已存在，請使用不同的姓名。`);
                    return;
                }
                teachers[index].name = name;
                teachers[index].baseHours = baseHours;
            }
        } else {
            // Add new teacher
            if (teachers.some(t => t.name === name)) {
                showModalError(`教師「${name}」已存在，請使用不同的姓名。`);
                return;
            }
            const newTeacher = {
                id: Date.now(),
                name: name,
                baseHours: baseHours
            };
            teachers.push(newTeacher);
        }

        saveTeachers();
        renderTeacherList();
        closeModal();
        editingTeacherId = null;
    }

    function saveTeachers() {
        store.set('teachers', teachers);
        saveAllDataToServer();
    }

    function renderTeacherList() {
        if (!teacherListContainer) return;

        const searchVal = (document.getElementById('teacher-search')?.value || '').trim().toLowerCase();

        if (teachers.length === 0) {
            teacherListContainer.innerHTML = '<div class="empty-state">尚未新增任何教師</div>';
            return;
        }

        const filteredTeachers = searchVal ? teachers.filter(t => t.name.toLowerCase().includes(searchVal)) : teachers;

        if (filteredTeachers.length === 0) {
            teacherListContainer.innerHTML = '<div class="empty-state">無符合的教師</div>';
            return;
        }

        teacherListContainer.innerHTML = filteredTeachers.map(teacher => `
            <div class="teacher-card">
                <div class="teacher-info">
                    <div class="teacher-icon">T</div>
                    ${escHtml(teacher.name)}
                </div>
                <div>
                    <button class="btn-edit" onclick="editTeacher(${teacher.id})" style="margin-right: 0.5rem;">
                        編輯
                    </button>
                    <button class="btn-delete" onclick="deleteTeacher(${teacher.id})">
                        刪除
                    </button>
                </div>
            </div>
        `).join('');
    }

    window.editTeacher = function (id) {
        const teacher = teachers.find(t => t.id === id);
        if (teacher) {
            openAddTeacherModal(teacher);
        }
    };

    window.deleteTeacher = function (id) {
        const teacher = teachers.find(t => t.id === id);
        if (!teacher) return;
        
        if (!confirm(`確定要刪除教師「${teacher.name}」嗎？此操作無法復原。`)) return;

        // Save snapshot for undo
        const deletedTeacher = JSON.parse(JSON.stringify(teacher));
        const prevCourses = JSON.parse(JSON.stringify(courses));

        // Perform delete
        teachers = teachers.filter(t => t.id !== id);
        const teacherName = teacher.name;
        courses.forEach(course => {
            if (!course.groupDetails) return;
            Object.values(course.groupDetails).forEach(details => {
                if (Array.isArray(details.teacher)) {
                    details.teacher = details.teacher.filter(t => t !== teacherName);
                } else if (details.teacher === teacherName) {
                    details.teacher = [];
                }
            });
        });
        saveTeachers();
        renderTeacherList();
        renderCourseList();

        showSnackbar(`已刪除教師「${teacherName}」`, function () {
            teachers.push(deletedTeacher);
            courses = prevCourses;
            saveTeachers();
            renderTeacherList();
            renderCourseList();
        });
    };

    // --- Grouping Functions ---

    function updateGroupingCourseSelect() {
        if (!groupingCourseSelect) return;

        if (courses.length === 0) {
            groupingCourseSelect.innerHTML = '<option value="">請先新增課程</option>';
            return;
        }

        const currentVal = groupingCourseSelect.value;
        groupingCourseSelect.innerHTML =
            '<option value="">請選擇要分組的課程</option>' +
            courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

        if (currentVal) groupingCourseSelect.value = currentVal;
    }

    function renderGroupingWorkspace(courseId) {
        const course = courses.find(c => c.id === courseId);
        if (!course) return;

        // Get DOM elements dynamically to support test environment
        const workspace = typeof groupingWorkspace !== 'undefined' ? groupingWorkspace : document.getElementById('grouping-workspace');
        const emptyState = typeof groupingEmptyState !== 'undefined' ? groupingEmptyState : document.getElementById('grouping-empty-state');

        if (workspace) workspace.style.display = 'flex';
        if (emptyState) emptyState.style.display = 'none';

        // Initialize assignments for this course if not exists OR if structure is invalid
        if (!assignments[courseId]) {
            assignments[courseId] = {};
            course.groups.forEach(g => assignments[courseId][g] = []);
            store.set('assignments', assignments);
        } else {
            // Validate existing structure and clean up if needed
            let needsCleanup = false;

            // 1. Check for missing or invalid groups from course definition
            course.groups.forEach(g => {
                if (!assignments[courseId][g]) {
                    assignments[courseId][g] = [];
                    needsCleanup = true;
                } else if (!Array.isArray(assignments[courseId][g])) {
                    console.warn('Invalid data type for group:', g, assignments[courseId][g]);
                    assignments[courseId][g] = [];
                    needsCleanup = true;
                }
            });

            // 2. Check for "ghost groups" - groups in assignments that no longer exist in course
            const assignedGroups = Object.keys(assignments[courseId]);
            assignedGroups.forEach(g => {
                if (!course.groups.includes(g)) {
                    console.warn('Found ghost group in assignments (removing):', g, assignments[courseId][g]);
                    delete assignments[courseId][g];
                    needsCleanup = true;
                }
            });

            if (needsCleanup) {
                store.set('assignments', assignments);
            }
        }
        // Render Group Columns
        groupsColumnsContainer.innerHTML = course.groups.map(groupName => `
            <div class="group-column">
                <div class="group-column-header">${escHtml(groupName)}</div>
                <div class="group-drop-zone" data-group="${escHtml(groupName)}">
                    ${renderAssignedStudents(courseId, groupName)}
                </div>
            </div>
        `).join('');

        // Render Student Pool (only unassigned students)
        renderStudentPool(courseId);

        // Attach Event Listeners
        attachGroupingDragEvents();
    }

    function renderAssignedStudents(courseId, groupName) {
        const assignedIds = assignments[courseId][groupName] || [];
        console.log(`[DEBUG] renderAssignedStudents for "${groupName}":`, {
            groupName,
            assignedIds,
            studentsCount: students.length,
            firstStudentId: students[0]?.id,
            firstStudentIdType: typeof students[0]?.id,
            assignedIdsTypes: assignedIds.map(id => typeof id)
        });
        const html = assignedIds.map(studentId => {
            const student = students.find(s => s.id === studentId);
            console.log(`[DEBUG] Looking for studentId=${studentId} (type: ${typeof studentId}), found:`, student ? student.name : 'NOT FOUND');
            if (!student) return '';
            return createDraggableStudentHTML(student);
        }).join('');
        console.log(`[DEBUG] renderAssignedStudents result for "${groupName}": ${html.length} chars`);
        return html;
    }

    function renderStudentPool(courseId) {
        console.log('=== renderStudentPool called ===');
        console.log('courseId:', courseId);
        console.log('studentPoolContainer:', studentPoolContainer);
        console.log('Total students in system:', students.length);
        console.log('Students:', students);

        // Defensive check: ensure container exists
        if (!studentPoolContainer) {
            console.error('Student pool container not found');
            return;
        }

        // Find all students assigned to ANY group in this course
        const assignedStudentIds = new Set();
        const courseAssignments = assignments[courseId] || {};
        console.log('Course assignments:', courseAssignments);

        Object.values(courseAssignments).forEach(ids => {
            ids.forEach(id => assignedStudentIds.add(id));
        });
        console.log('Assigned student IDs:', Array.from(assignedStudentIds));

        // Filter students who are NOT in the set
        const unassignedStudents = students.filter(s => !assignedStudentIds.has(s.id));
        console.log('Unassigned students:', unassignedStudents);

        // Sort by grade
        unassignedStudents.sort((a, b) => b.grade - a.grade);

        // Render students or show empty state
        if (unassignedStudents.length === 0) {
            console.log('No unassigned students, showing empty state');
            studentPoolContainer.innerHTML = '<div class="empty-state">所有學生已分配</div>';
        } else {
            console.log('Rendering', unassignedStudents.length, 'unassigned students');
            studentPoolContainer.innerHTML = unassignedStudents.map(student =>
                createDraggableStudentHTML(student)
            ).join('');
        }

        // Re-attach events for pool items
        attachGroupingDragEvents();

        console.log('=== renderStudentPool completed ===');
    }

    function createDraggableStudentHTML(student) {
        return `
            <div class="draggable-student" draggable="true" data-student-id="${student.id}">
                <span class="student-grade">${escHtml(String(student.grade))}</span>
                ${escHtml(student.name)}
            </div>
        `;
    }

    function renderAllGroupsOverview() {
        const overviewContainer = document.getElementById('all-groups-overview');
        if (!overviewContainer) return;

        if (courses.length === 0) {
            overviewContainer.innerHTML = '<div class="empty-state">尚未新增任何課程</div>';
            overviewContainer.style.display = 'block';
            return;
        }

        let html = '';
        courses.forEach(course => {
            const courseAssignments = assignments[course.id] || {};

            html += `
                <div class="overview-course-section">
                    <div class="overview-course-title">${escHtml(course.name)}</div>
                    <div class="overview-groups-grid">
            `;

            course.groups.forEach(groupName => {
                const studentIds = courseAssignments[groupName] || [];
                const groupStudents = studentIds.map(id => students.find(s => s.id === id)).filter(s => s);

                // Sort by grade
                groupStudents.sort((a, b) => b.grade - a.grade);

                html += `
                    <div class="overview-group-card">
                        <div class="overview-group-name">${escHtml(groupName)}</div>
                        <div class="overview-students-list">
                `;

                if (groupStudents.length === 0) {
                    html += '<div class="overview-empty-group">尚未分配學生</div>';
                } else {
                    groupStudents.forEach(student => {
                        html += `
                            <div class="overview-student-item">
                                <span class="student-grade">${escHtml(String(student.grade))}</span>
                                ${escHtml(student.name)}
                            </div>
                        `;
                    });
                }

                html += `
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        overviewContainer.innerHTML = html;
        overviewContainer.style.display = 'grid';
    }

    // 匯出分組資料為CSV
    function exportGroupsCSV() {
        if (courses.length === 0) {
            showSnackbar('目前沒有課程資料可匯出');
            return;
        }

        // CSV標題列
        let csvContent = '課程分組,學生(年級)\n';

        // 遍歷所有課程
        courses.forEach(course => {
            const courseAssignments = assignments[course.id] || {};

            // 遍歷每個分組
            course.groups.forEach(groupName => {
                const studentIds = courseAssignments[groupName] || [];

                // 取得該分組的學生資料
                const groupStudents = studentIds
                    .map(id => students.find(s => s.id === id))
                    .filter(s => s);

                // 按年級排序（高年級在前）
                groupStudents.sort((a, b) => b.grade - a.grade);

                // 組合學生列表：學生名(年級)、學生名(年級)...
                const studentList = groupStudents.length > 0
                    ? groupStudents.map(s => `${s.name}(${s.grade})`).join('、')
                    : '';

                // 組成CSV行：課程分組名,學生列表
                const groupDisplayName = `${course.name}${groupName}`;
                csvContent += `${groupDisplayName},${studentList}\n`;
            });
        });

        // 建立Blob並下載（使用UTF-8 BOM以確保Excel正確顯示中文）
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // 檔案名稱包含日期時間
        const dateStr = getFormattedDate();
        a.download = `分組資料_${CURRENT_USER}_${dateStr}.csv`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // --- Drag and Drop Handlers ---

    // --- Drag and Drop Handlers (Event Listeners) ---

    function attachGroupingDragEvents() {
        // 1. Draggable Students
        document.querySelectorAll('.draggable-student').forEach(el => {
            // Remove old listeners to avoid duplicates if re-attaching
            el.removeEventListener('dragstart', handleStudentDragStart);
            el.addEventListener('dragstart', handleStudentDragStart);

            // End drag event to clean up classes
            el.removeEventListener('dragend', handleStudentDragEnd);
            el.addEventListener('dragend', handleStudentDragEnd);
        });

        // 2. Group Drop Zones
        document.querySelectorAll('.group-drop-zone').forEach(el => {
            el.removeEventListener('dragover', handleZoneDragOver);
            el.removeEventListener('dragleave', handleZoneDragLeave);
            el.removeEventListener('drop', handleZoneDrop);

            el.addEventListener('dragover', handleZoneDragOver);
            el.addEventListener('dragleave', handleZoneDragLeave);
            el.addEventListener('drop', handleZoneDrop);
        });
    }

    function handleStudentDragStart(e) {
        const id = e.target.dataset.studentId || e.target.closest('.draggable-student').dataset.studentId;
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
        e.target.classList.add('dragging');
    }

    function handleStudentDragEnd(e) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.group-drop-zone').forEach(el => el.classList.remove('drag-over'));
    }

    function handleZoneDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
    }

    function handleZoneDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    function handleZoneDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');

        const studentId = Number(e.dataTransfer.getData('text/plain'));  // ✓ 改用 Number 保留小數部分
        const targetGroupName = e.currentTarget.dataset.group;
        const courseId = groupingCourseSelect ? parseInt(groupingCourseSelect.value) : null;

        if (!studentId || !courseId) return;

        // Update Data Model
        const courseAssignments = assignments[courseId];
        if (!courseAssignments) return;

        // 1. Remove from any existing group in this course
        Object.keys(courseAssignments).forEach(group => {
            courseAssignments[group] = courseAssignments[group].filter(id => id !== studentId);
        });

        // 2. Add to new group
        if (targetGroupName) {
            if (!courseAssignments[targetGroupName]) courseAssignments[targetGroupName] = [];
            courseAssignments[targetGroupName].push(studentId);
        }

        // Save and Re-render
        store.set('assignments', assignments);
        saveAllDataToServer();
        renderGroupingWorkspace(courseId);
        renderStudentPool(courseId);  // ✓ 重新渲染學生池，更新未分配學生列表
        renderMasterSchedule();
    }

    // Allow dropping back to pool
    studentPoolContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        studentPoolContainer.style.backgroundColor = '#f0f2f5';
    });

    studentPoolContainer.addEventListener('dragleave', () => {
        studentPoolContainer.style.backgroundColor = 'white';
    });

    studentPoolContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        studentPoolContainer.style.backgroundColor = 'white';
        const studentId = Number(e.dataTransfer.getData('text/plain'));  // ✓ 改用 Number 保留小數部分
        const courseId = parseInt(groupingCourseSelect.value);

        // Remove from groups
        const courseAssignments = assignments[courseId];
        Object.keys(courseAssignments).forEach(group => {
            courseAssignments[group] = courseAssignments[group].filter(id => id !== studentId);
        });

        store.set('assignments', assignments);
        saveAllDataToServer();
        renderGroupingWorkspace(courseId);
        renderStudentPool(courseId);  // ✓ 重新渲染學生池
        renderMasterSchedule();
    });

    function forceCloseModal() {
        modalDirty = false;
        modal.style.display = 'none';
        modalConfirm.onclick = null;
        const modalContent = modal.querySelector('.modal-content') || modal;
        const clearBtn = modalContent.querySelector('.btn-clear-override');
        if (clearBtn) clearBtn.remove();
    }

    function closeModal() {
        forceCloseModal();
    }

    // Global Helpers
    window.toggleGrade = function (event, id) {
        event.stopPropagation(); // Prevent drag start or other clicks

        // 檢視模式下不可修改
        if (MY_ROLE === 'viewer') return;

        // 檢查是否在學生管理頁面
        const studentsView = document.getElementById('students-view');
        if (!studentsView || !studentsView.classList.contains('active')) {
            // 不在學生管理頁面，不執行切換
            return;
        }

        const student = students.find(s => s.id === id);
        if (student) {
            // Cycle 7 -> 8 -> 9 -> 7
            let newGrade = parseInt(student.grade) + 1;
            if (newGrade > 9) newGrade = 7;
            student.grade = newGrade.toString();

            saveStudents();
            renderStudentList();

            // If in grouping view, refresh that too
            if (groupingCourseSelect && groupingCourseSelect.value) {
                renderGroupingWorkspace(parseInt(groupingCourseSelect.value));
            }
        }
    };

    window.deleteCourse = function (id) {
        const course = courses.find(c => c.id === id);
        if (!course) return;
        
        if (!confirm(`確定要刪除課程「${course.name}」嗎？此操作無法復原。`)) return;

        // Save snapshot for undo
        const deletedCourse = JSON.parse(JSON.stringify(course));
        const prevAssignments = JSON.parse(JSON.stringify(assignments));
        const prevScheduleData = JSON.parse(JSON.stringify(scheduleData));
        const prevSlotOverrides = JSON.parse(JSON.stringify(slotOverrides));

        // Perform delete
        courses = courses.filter(c => c.id !== id);
        delete assignments[id];
        Object.keys(scheduleData).forEach(slotKey => {
            scheduleData[slotKey] = scheduleData[slotKey].filter(item => item.courseId !== id);
            if (scheduleData[slotKey].length === 0) delete scheduleData[slotKey];
        });
        Object.keys(slotOverrides).forEach(slotKey => {
            delete slotOverrides[slotKey][id];
            if (Object.keys(slotOverrides[slotKey]).length === 0) delete slotOverrides[slotKey];
        });
        saveCourses(); // saveCourses() 內部已呼叫 saveAllDataToServer()，不需重複呼叫
        renderCourseList();
        updateGroupingCourseSelect();
        renderMasterSchedule();

        showSnackbar(`已刪除課程「${course.name}」`, function () {
            courses.push(deletedCourse);
            assignments = prevAssignments;
            scheduleData = prevScheduleData;
            slotOverrides = prevSlotOverrides;
            saveCourses(); // saveCourses() 內部已呼叫 saveAllDataToServer()
            renderCourseList();
            updateGroupingCourseSelect();
            renderMasterSchedule();
        });
    };

    window.deleteStudent = function (id) {
        const student = students.find(s => s.id === id);
        if (!student) return;
        
        if (!confirm(`確定要刪除學生「${student.name}」嗎？此操作無法復原。`)) return;

        // Save snapshot for undo（含原始位置，undo 後能插回原處）
        const deletedStudent = JSON.parse(JSON.stringify(student));
        const prevStudentIndex = students.findIndex(s => s.id === id);
        const prevAssignments = JSON.parse(JSON.stringify(assignments));
        const prevSlotOverrides = JSON.parse(JSON.stringify(slotOverrides));

        // Perform delete
        students = students.filter(s => s.id !== id);
        Object.keys(assignments).forEach(cId => {
            Object.keys(assignments[cId]).forEach(gName => {
                assignments[cId][gName] = assignments[cId][gName].filter(sId => sId !== id);
            });
        });
        Object.keys(slotOverrides).forEach(slotKey => {
            Object.keys(slotOverrides[slotKey]).forEach(cId => {
                Object.keys(slotOverrides[slotKey][cId]).forEach(gName => {
                    const val = slotOverrides[slotKey][cId][gName];
                    if (Array.isArray(val)) {
                        slotOverrides[slotKey][cId][gName] = val.filter(sId => sId !== id);
                    }
                });
            });
        });
        saveStudents(); // saveStudents() 內部已呼叫 saveAllDataToServer()，不需重複呼叫
        renderStudentList();
        if (groupingCourseSelect.value) {
            renderGroupingWorkspace(parseInt(groupingCourseSelect.value));
        }

        showSnackbar(`已刪除學生「${student.name}」`, function () {
            // undo：插回原位而非 push 到末尾，以維持排序
            if (prevStudentIndex >= 0 && prevStudentIndex <= students.length) {
                students.splice(prevStudentIndex, 0, deletedStudent);
            } else {
                students.push(deletedStudent);
            }
            assignments = prevAssignments;
            slotOverrides = prevSlotOverrides;
            saveStudents(); // saveStudents() 內部已呼叫 saveAllDataToServer()
            renderStudentList();
            if (groupingCourseSelect.value) {
                renderGroupingWorkspace(parseInt(groupingCourseSelect.value));
            }
        });
    };

    // --- Schedule Drag & Drop Functions ---

    // Initialize schedule slots with drag & drop event listeners
    function initializeSchedule() {
        const scheduleSlots = document.querySelectorAll('.course-group-container[data-day][data-period]');
        scheduleSlots.forEach(slot => {
            slot.addEventListener('dragover', handleScheduleDragOver);
            slot.addEventListener('dragleave', handleScheduleDragLeave);
            slot.addEventListener('drop', handleScheduleDrop);
        });
    }

    // Render course blocks in the pool
    function renderCourseBlocks() {
        if (!courseBlocksContainer) return;

        let html = '';

        courses.forEach(course => {
            // Calculate max hours among all groups
            let maxHours = 0;
            if (course.groups && course.groups.length > 0) {
                maxHours = Math.max(...course.groups.map(gName => {
                    const details = course.groupDetails[gName];
                    return parseInt(details.hours) || 0;
                }));
            }

            // Count how many blocks of this course are already placed in schedule
            let usedBlocks = 0;
            Object.values(scheduleData).forEach(slotItems => {
                if (Array.isArray(slotItems)) {
                    usedBlocks += slotItems.filter(item => item.courseId === course.id).length;
                } else if (slotItems && slotItems.courseId === course.id) {
                    usedBlocks++;
                }
            });

            // Show single generator block
            const isFull = usedBlocks >= maxHours;
            const opacity = isFull ? '0.5' : '1';

            html += `
                <div class="course-block"
                     draggable="${!isFull}"
                     data-course-id="${course.id}"
                     data-course-name="${escHtml(course.name)}"
                     style="opacity: ${opacity}">
                    <div class="course-block-header">${escHtml(course.name)}</div>
                    <div class="course-block-number">已排/總時數: ${usedBlocks} / ${maxHours}</div>
                </div>
            `;
        });

        if (html === '') {
            courseBlocksContainer.innerHTML = '<div class="empty-state">尚無可排課程<br>請先在「課程管理」中新增課程</div>';
            courseBlocksContainer.classList.add('empty');
        } else {
            courseBlocksContainer.innerHTML = html;
            courseBlocksContainer.classList.remove('empty');

            // Attach drag event listeners to blocks
            courseBlocksContainer.querySelectorAll('.course-block').forEach(block => {
                block.addEventListener('dragstart', handleBlockDragStart);
                block.addEventListener('dragend', handleBlockDragEnd);
                // Touch drag support
                attachTouchDrag(block, (el) => ({
                    courseId: parseInt(el.dataset.courseId),
                    courseName: el.dataset.courseName,
                    fromPool: true
                }));
            });
        }
    }

    // Render schedule from scheduleData
    function renderSchedule() {
        const scheduleSlots = document.querySelectorAll('.course-group-container[data-day][data-period]');

        scheduleSlots.forEach(slot => {
            const day = slot.dataset.day;
            const period = slot.dataset.period;
            const slotKey = `${day}-${period}`;
            let slotItems = scheduleData[slotKey];

            // Normalize to array
            if (slotItems && !Array.isArray(slotItems)) {
                slotItems = [slotItems];
            }

            if (slotItems && slotItems.length > 0) {
                const count = slotItems.length;
                const isFull = count >= 5;
                let slotHtml = `<span class="slot-count-badge${isFull ? ' full' : ''}">${count}/5</span>`;
                slotItems.forEach((item, index) => {
                    const course = courses.find(c => c.id === item.courseId);
                    if (course) {
                        slotHtml += `
                            <div class="course-card draggable"
                                 draggable="true"
                                 data-slot-key="${slotKey}"
                                 data-item-index="${index}">
                                <button class="btn-remove" onclick="removeFromSchedule('${slotKey}', ${index})">✖</button>
                                <div class="course-subject">${escHtml(course.name)}</div>
                            </div>
                        `;
                    }
                });
                slot.innerHTML = slotHtml;

                // Attach drag events to placed cards
                const cards = slot.querySelectorAll('.course-card');
                cards.forEach(card => {
                    card.addEventListener('dragstart', handlePlacedCardDragStart);
                    card.addEventListener('dragend', handleBlockDragEnd);
                    // Touch drag support
                    attachTouchDrag(card, (el) => {
                        const sk = el.dataset.slotKey;
                        const idx = parseInt(el.dataset.itemIndex);
                        let items = scheduleData[sk];
                        if (!Array.isArray(items)) items = [items];
                        return { ...(items[idx] || {}), fromPool: false, originalSlotKey: sk, originalIndex: idx };
                    });
                });
            } else {
                slot.innerHTML = '';
            }
        });
    }

    // Handle drag start from course block pool
    function handleBlockDragStart(e) {
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify({
            courseId: parseInt(e.target.dataset.courseId),
            courseName: e.target.dataset.courseName,
            fromPool: true
        }));
    }

    // Handle drag start from placed card in schedule
    function handlePlacedCardDragStart(e) {
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        const slotKey = e.target.dataset.slotKey;
        const index = parseInt(e.target.dataset.itemIndex);

        // Get item from array
        let slotItems = scheduleData[slotKey];
        if (!Array.isArray(slotItems)) slotItems = [slotItems];
        const item = slotItems[index];

        e.dataTransfer.setData('application/json', JSON.stringify({
            ...item,
            fromPool: false,
            originalSlotKey: slotKey,
            originalIndex: index
        }));
    }

    // Handle drag end
    function handleBlockDragEnd(e) {
        e.target.classList.remove('dragging');
    }

    // ===== Touch Drag-and-Drop Support =====
    let touchDragData = null;
    let touchGhost = null;

    function createTouchGhost(el) {
        const ghost = el.cloneNode(true);
        ghost.style.cssText = `
            position: fixed; z-index: 9999; pointer-events: none;
            opacity: 0.85; transform: scale(1.05);
            border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.25);
            width: ${el.offsetWidth}px; transition: none;
        `;
        document.body.appendChild(ghost);
        return ghost;
    }

    function getTouchSlot(x, y) {
        // Temporarily hide ghost to get element below
        if (touchGhost) touchGhost.style.display = 'none';
        const el = document.elementFromPoint(x, y);
        if (touchGhost) touchGhost.style.display = '';
        if (!el) return null;
        return el.closest('.course-group-container[data-day][data-period]');
    }

    function attachTouchDrag(el, getData) {
        let _touchStartX = 0, _touchStartY = 0;
        let _isDragging = false;
        const DRAG_THRESHOLD = 10; // px — 超過此距離才視為拖動，避免阻止正常滑動

        el.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            _touchStartX = touch.clientX;
            _touchStartY = touch.clientY;
            _isDragging = false;
            // 暫存拖放資料但不立即開始拖動
            touchDragData = getData(el);
        }, { passive: true }); // passive: 不阻止滑動

        el.addEventListener('touchmove', (e) => {
            if (!touchDragData) return;
            const touch = e.touches[0];
            const dx = touch.clientX - _touchStartX;
            const dy = touch.clientY - _touchStartY;

            // 未達拖動閾值 — 允許正常滑動
            if (!_isDragging && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;

            // 確認開始拖動
            if (!_isDragging) {
                _isDragging = true;
                touchGhost = createTouchGhost(el);
                const rect = el.getBoundingClientRect();
                touchGhost._offsetX = _touchStartX - rect.left;
                touchGhost._offsetY = _touchStartY - rect.top;
                el.classList.add('dragging');
            }

            touchGhost.style.left = (touch.clientX - touchGhost._offsetX) + 'px';
            touchGhost.style.top = (touch.clientY - touchGhost._offsetY) + 'px';

            // Highlight drop target
            document.querySelectorAll('.course-group-container.drop-target').forEach(s => s.classList.remove('drop-target'));
            const slot = getTouchSlot(touch.clientX, touch.clientY);
            if (slot) slot.classList.add('drop-target');
            e.preventDefault(); // 拖動開始後才阻止滑動
        }, { passive: false });

        el.addEventListener('touchend', (e) => {
            if (!touchDragData) return;
            if (_isDragging && touchGhost) {
                const touch = e.changedTouches[0];
                document.querySelectorAll('.course-group-container.drop-target').forEach(s => s.classList.remove('drop-target'));
                el.classList.remove('dragging');
                touchGhost.remove();
                touchGhost = null;

                const slot = getTouchSlot(touch.clientX, touch.clientY);
                if (slot) {
                    handleTouchDrop(slot, touchDragData);
                }
            }
            touchDragData = null;
            _isDragging = false;
        });
    }

    function handleTouchDrop(slotEl, blockData) {
        const day = slotEl.dataset.day;
        const period = slotEl.dataset.period;
        const slotKey = `${day}-${period}`;

        if (!scheduleData[slotKey]) {
            scheduleData[slotKey] = [];
        } else if (!Array.isArray(scheduleData[slotKey])) {
            scheduleData[slotKey] = [scheduleData[slotKey]];
        }

        const isReordering = !blockData.fromPool && blockData.originalSlotKey === slotKey;
        if (!isReordering && scheduleData[slotKey].length >= 5) {
            showSnackbar('該時段已滿，無法再加入課程！(上限 5 堂)');
            return;
        }

        if (!blockData.fromPool && blockData.originalSlotKey) {
            const originalItems = scheduleData[blockData.originalSlotKey];
            if (Array.isArray(originalItems)) {
                originalItems.splice(blockData.originalIndex, 1);
                if (originalItems.length === 0) delete scheduleData[blockData.originalSlotKey];
            } else {
                delete scheduleData[blockData.originalSlotKey];
            }
        }

        let newBlockIndex = 0;
        if (blockData.fromPool) {
            let usedBlocks = 0;
            Object.values(scheduleData).forEach(slotItems => {
                if (Array.isArray(slotItems)) usedBlocks += slotItems.filter(i => i.courseId === blockData.courseId).length;
                else if (slotItems && slotItems.courseId === blockData.courseId) usedBlocks++;
            });
            newBlockIndex = usedBlocks;
        }

        scheduleData[slotKey].push({ courseId: blockData.courseId, blockIndex: newBlockIndex });
        saveScheduleData();
        renderSchedule();
        renderCourseBlocks();
    }

    // Handle drag over schedule slot
    function handleScheduleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drop-target');
    }

    // Handle drag leave schedule slot
    function handleScheduleDragLeave(e) {
        e.currentTarget.classList.remove('drop-target');
    }

    // Handle drop on schedule slot
    function handleScheduleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drop-target');

        const day = e.currentTarget.dataset.day;
        const period = e.currentTarget.dataset.period;
        const slotKey = `${day}-${period}`;

        try {
            const blockData = JSON.parse(e.dataTransfer.getData('application/json'));

            // Initialize slot array if needed
            if (!scheduleData[slotKey]) {
                scheduleData[slotKey] = [];
            } else if (!Array.isArray(scheduleData[slotKey])) {
                scheduleData[slotKey] = [scheduleData[slotKey]];
            }

            // Check if slot is full (max 2)
            // Allow reordering within the same slot even if full
            const isReordering = !blockData.fromPool && blockData.originalSlotKey === slotKey;

            // Limit to 5 courses per slot (was 2)
            if (!isReordering && scheduleData[slotKey].length >= 5) {
                showSnackbar('該時段已滿，無法再加入課程！(上限 5 堂)');
                return;
            }

            // If moving from another slot, remove from original position
            if (!blockData.fromPool && blockData.originalSlotKey) {
                const originalItems = scheduleData[blockData.originalSlotKey];
                if (Array.isArray(originalItems)) {
                    originalItems.splice(blockData.originalIndex, 1);
                    if (originalItems.length === 0) delete scheduleData[blockData.originalSlotKey];
                } else {
                    delete scheduleData[blockData.originalSlotKey];
                }
            }

            // Determine block index
            let newBlockIndex = 0;
            if (blockData.fromPool) {
                // Calculate next available index
                let usedBlocks = 0;
                Object.values(scheduleData).forEach(slotItems => {
                    if (Array.isArray(slotItems)) {
                        usedBlocks += slotItems.filter(item => item.courseId === blockData.courseId).length;
                    } else if (slotItems && slotItems.courseId === blockData.courseId) {
                        usedBlocks++;
                    }
                });
                newBlockIndex = usedBlocks;
            } else {
                newBlockIndex = blockData.blockIndex;
            }

            // Add to new position
            scheduleData[slotKey].push({
                courseId: blockData.courseId,
                courseName: blockData.courseName,
                blockIndex: newBlockIndex
            });

            // Save and re-render
            store.set('scheduleData', scheduleData);
            saveAllDataToServer();
            renderSchedule();
            renderCourseBlocks();
        } catch (error) {
            console.error('Drop error:', error);
        }
    }

    // Remove course from schedule (called by button click)
    window.removeFromSchedule = function (slotKey, index) {
        if (confirm('確定要從課表中移除這個課程嗎？')) {
            const items = scheduleData[slotKey];
            if (Array.isArray(items)) {
                items.splice(index, 1);
                if (items.length === 0) delete scheduleData[slotKey];
            } else {
                delete scheduleData[slotKey];
            }

            store.set('scheduleData', scheduleData);
            saveAllDataToServer();
            renderSchedule();
            renderCourseBlocks();
        }
    };

    // Update renderCourseList to refresh schedule when courses change
    const originalRenderCourseList = renderCourseList;
    renderCourseList = function () {
        originalRenderCourseList();
        if (document.getElementById('schedule-view').classList.contains('active')) {
            renderCourseBlocks();
            renderSchedule();
        }
    };

    // Helper function to calculate teacher statistics
    function calculateTeacherStats() {
        const teacherStats = {};

        // Iterate through all schedule slots
        Object.keys(scheduleData).forEach(slotKey => {
            const blocks = scheduleData[slotKey];
            if (!blocks || !Array.isArray(blocks)) return;

            blocks.forEach(block => {
                const course = courses.find(c => c.id === block.courseId);
                if (!course) return;

                course.groups.forEach(groupName => {
                    const details = course.groupDetails[groupName];
                    if (!details) return;

                    // Handle teacher array or single teacher
                    let teacherList = [];
                    if (Array.isArray(details.teacher)) {
                        teacherList = details.teacher.filter(t => t && t !== '');
                    } else if (details.teacher) {
                        teacherList = [details.teacher];
                    }

                    teacherList.forEach(teacherName => {
                        if (!teacherStats[teacherName]) {
                            teacherStats[teacherName] = { courses: {}, total: 0 };
                        }
                        if (!teacherStats[teacherName].courses[course.name]) {
                            teacherStats[teacherName].courses[course.name] = 0;
                        }
                        teacherStats[teacherName].courses[course.name]++;
                        teacherStats[teacherName].total++;
                    });
                });
            });
        });

        return teacherStats;
    }

    // --- Master Schedule Functions ---

    function renderMasterSchedule(isClassroomIntegrated = false) {
        const tbody = document.getElementById('master-schedule-tbody');
        if (!tbody) return;

        // Update title for print
        const titleElement = document.querySelector('#master-schedule-content .master-schedule-container');
        const titleSuffix = isClassroomIntegrated ? '教室統整課表' : '總課表';

        if (titleElement && !document.getElementById('master-print-title')) {
            const prefix = document.getElementById('title-prefix')?.value || '';
            const year = document.getElementById('title-year')?.value || '';
            const semester = document.getElementById('title-semester')?.value || '';
            const titleText = `${prefix} ${year} 學年度第 ${semester} 學期 ${titleSuffix}`;
            const titleHTML = `<h2 id="master-print-title" class="schedule-title" style="text-align: center; margin-bottom: 1rem;">${titleText}</h2>`;
            titleElement.insertAdjacentHTML('afterbegin', titleHTML);
        } else if (document.getElementById('master-print-title')) {
            const prefix = document.getElementById('title-prefix')?.value || '';
            const year = document.getElementById('title-year')?.value || '';
            const semester = document.getElementById('title-semester')?.value || '';
            document.getElementById('master-print-title').textContent = `${prefix} ${year} 學年度第 ${semester} 學期 ${titleSuffix}`;
        }

        // 定義時段
        const timeSlots = [
            { period: 'morning', name: '早自習', time: '', isSpecial: true },
            { period: '1', name: '第一節', time: '08:30~09:15' },
            { period: '2', name: '第二節', time: '09:25~10:10' },
            { period: '3', name: '第三節', time: '10:20~11:05' },
            { period: '4', name: '第四節', time: '11:15~12:00' },
            { period: 'lunch', name: '中午', time: '12:30~13:10', isSpecial: true },
            { period: '5', name: '第五節', time: '13:20~14:05' },
            { period: '6', name: '第六節', time: '14:15~15:00' },
            { period: '7', name: '第七節', time: '15:20~16:05' }
        ];

        // Reverse weekday order for print: Friday to Monday
        const weekdays = [
            { key: 'monday', name: '星期一' },
            { key: 'tuesday', name: '星期二' },
            { key: 'wednesday', name: '星期三' },
            { key: 'thursday', name: '星期四' },
            { key: 'friday', name: '星期五' }
        ];

        let html = '';

        timeSlots.forEach(slot => {
            // 特殊時段（早自習、午休）
            if (slot.isSpecial) {
                html += `
                    <tr>
                        <td class="col-period">
                            <div class="period-cell">
                                <div class="period-name">${slot.name}</div>
                                ${slot.time ? `<div class="period-time">${slot.time}</div>` : ''}
                            </div>
                        </td>
                        <td colspan="5" style="background-color: #f8f9fa; text-align: center; vertical-align: middle;">
                            <span style="color: #999;">${slot.name}時段</span>
                        </td>
                    </tr>
                `;
                return;
            }

            // 一般時段
            html += `
                <tr>
                    <td class="col-period">
                        <div class="period-cell">
                            <div class="period-name">${slot.name}</div>
                            <div class="period-time">${slot.time}</div>
                        </div>
                    </td>
            `;

            // 遍歷每個星期
            weekdays.forEach(day => {
                const slotKey = `${day.key}-${slot.period}`;
                const blocks = scheduleData[slotKey];

                // Flatten and sort items for consistent layout
                let renderItems = [];
                if (blocks && Array.isArray(blocks)) {
                    blocks.forEach(block => {
                        const course = courses.find(c => c.id === block.courseId);
                        if (course && course.groups) {
                            course.groups.forEach(groupName => {
                                renderItems.push({ course, groupName });
                            });
                        }
                    });
                }

                // Sort by group name (A, B, C...) to ensure consistent order for layout
                renderItems.sort((a, b) => a.groupName.localeCompare(b.groupName, 'zh-TW'));

                // Calculate total items for layout
                const totalItems = renderItems.length;
                const layoutClass = totalItems === 3 ? 'layout-3' : totalItems === 2 ? 'layout-2' : '';

                // 使用 td 保持表格單元格行為，但在內部放一個 grid container
                html += `<td class="${layoutClass}"><div class="day-cell-grid ${layoutClass}">`;

                if (totalItems > 0) {
                    renderItems.forEach(item => {
                        const { course, groupName } = item;
                        const details = course.groupDetails[groupName];
                        if (!details) return;

                        // 處理教師資料
                        const teacherData = details.teacher;
                        let teacherDisplay = '未排';
                        if (Array.isArray(teacherData)) {
                            // Join with <br> to ensure one teacher per line
                            teacherDisplay = teacherData.filter(t => t && t !== '').map(escHtml).join('<br>') || '未排';
                        } else if (teacherData) {
                            teacherDisplay = escHtml(teacherData);
                        }

                        // 如果只有一個區塊，讓它跨兩欄
                        const isSingleBlock = totalItems === 1;
                        const spanClass = isSingleBlock ? 'span-2' : '';

                        // 整合模式：若群組名稱與課程名稱相同，則不顯示群組名稱
                        const displayGroupName = groupName === course.name ? '' : `<span style="font-size:0.8em">${escHtml(groupName)}</span>`;

                        if (isClassroomIntegrated) {
                            // Classroom Integrated Mode: Show only course, teacher, room
                            html += `
                                        <div class="master-group-block classroom-integrated ${spanClass}">
                                            <div class="master-group-header">${escHtml(course.name)} ${displayGroupName}</div>
                                            <div class="master-group-info-vertical">
                                                <div class="master-info-row">👨‍🏫 ${teacherDisplay}</div>
                                                <div class="master-info-row">🏠 ${escHtml(details.room || '待訂')}</div>
                                            </div>
                                        </div>
                                    `;
                        } else {
                            // Normal Master Schedule Mode: Show course, teacher, room, and students
                            // 取得該分組的學生，並在姓名前加上年級
                            // Check for overrides first
                            let groupStudents = assignments[course.id]?.[groupName] || [];
                            const override = slotOverrides[slotKey]?.[course.id]?.[groupName];

                            if (override) {
                                if (Array.isArray(override)) {
                                    // Legacy support: Absolute list
                                    groupStudents = override;
                                } else if (override.type === 'delta') {
                                    // New Delta support: Apply additions and removals
                                    // 1. Filter out removed
                                    groupStudents = groupStudents.filter(sid => !override.removed.includes(sid));
                                    // 2. Add added (avoid duplicates)
                                    override.added.forEach(sid => {
                                        if (!groupStudents.includes(sid)) groupStudents.push(sid);
                                    });
                                }
                            }

                            const studentNames = groupStudents.map(studentId => {
                                const student = students.find(s => s.id === studentId);
                                return student ? `${escHtml(String(student.grade))} ${escHtml(student.name)}` : '';
                            }).filter(name => name);

                            const isOverridden = !!override;
                            const blockId = `block-${slotKey}-${course.id}-${groupName}`;

                            // 若群組名稱與課程名稱相同，則不顯示群組名稱
                            const displayGroupName = groupName === course.name ? '' : `<span style="font-size:0.8em">${escHtml(groupName)}</span>`;

                            html += `
                                        <div class="master-group-block ${spanClass}" id="${blockId}">
                                            <div class="master-group-header">
                                                ${escHtml(course.name)} ${displayGroupName}
                                                <span class="btn-edit-override ${isOverridden ? 'active' : ''}"
                                                      onclick="openStudentOverrideModal('${slotKey}', ${course.id}, '${escHtml(groupName)}')"
                                                      title="編輯此時段學生名單">✎</span>
                                            </div>
                                            <div class="master-group-info-vertical">
                                                <div class="master-info-row">👨‍🏫 ${teacherDisplay}</div>
                                                <div class="master-info-row">🏠 ${escHtml(details.room || '待訂')}</div>
                                            </div>
                                            ${studentNames.length > 0 ? `
                                                <div class="master-student-list-vertical">
                                                    ${studentNames.map(name => `<div class="master-student-item">${name}</div>`).join('')}
                                                </div>
                                            ` : '<div style="color: #999; font-size: 0.85rem; margin-top: 0.3rem;">尚未分配學生</div>'}
                                        </div>
                                    `;
                        }
                    });
                } else {
                    // 該時段無課程
                    html += '<span class="empty-cell">-</span>';
                }

                html += '</div></td>';
            });

            html += '</tr>';
        });

        tbody.innerHTML = html;

        // Also populate print table with reversed column order
        const tbodyPrint = document.getElementById('master-schedule-tbody-print');
        if (tbodyPrint) {
            const weekdaysPrint = [
                { key: 'friday', name: '星期五' },
                { key: 'thursday', name: '星期四' },
                { key: 'wednesday', name: '星期三' },
                { key: 'tuesday', name: '星期二' },
                { key: 'monday', name: '星期一' }
            ];

            let htmlPrint = '';

            timeSlots.forEach(slot => {
                if (slot.isSpecial) {
                    htmlPrint += `
                                <tr>
                                    <td colspan="5" style="background-color: #f8f9fa; text-align: center; vertical-align: middle;">
                                        <span style="color: #999;">${slot.name}時段</span>
                                    </td>
                                    <td class="col-period">
                                        <div class="period-cell">
                                            <div class="period-name">${slot.name}</div>
                                            ${slot.time ? `<div class="period-time">${slot.time}</div>` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `;
                    return;
                }

                htmlPrint += `<tr>`;

                // Weekdays in Fri-Mon order
                weekdaysPrint.forEach(day => {
                    const slotKey = `${day.key}-${slot.period}`;
                    const blocks = scheduleData[slotKey];

                    // Flatten and sort items for consistent layout
                    let renderItems = [];
                    if (blocks && Array.isArray(blocks)) {
                        blocks.forEach(block => {
                            const course = courses.find(c => c.id === block.courseId);
                            if (course && course.groups) {
                                course.groups.forEach(groupName => {
                                    renderItems.push({ course, groupName });
                                });
                            }
                        });
                    }

                    // Sort by group name (A, B, C...)
                    renderItems.sort((a, b) => a.groupName.localeCompare(b.groupName, 'zh-TW'));

                    const totalItems = renderItems.length;
                    const layoutClass = totalItems === 3 ? 'layout-3' : '';

                    htmlPrint += `<td><div class="day-cell-grid ${layoutClass}">`;

                    if (totalItems > 0) {
                        renderItems.forEach(item => {
                            const { course, groupName } = item;
                            const details = course.groupDetails[groupName];
                            if (!details) return;

                            const teacherData = details.teacher;
                            let teacherDisplay = '未排';
                            if (Array.isArray(teacherData)) {
                                // Join with <br> to ensure one teacher per line
                                teacherDisplay = teacherData.filter(t => t && t !== '').join('<br>') || '未排';
                            } else if (teacherData) {
                                teacherDisplay = teacherData;
                            }

                            const isSingleBlock = totalItems === 1;
                            const spanClass = isSingleBlock ? 'span-2' : '';

                            // 若群組名稱與課程名稱相同，則不顯示群組名稱
                            const displayGroupName = groupName === course.name ? '' : `<span style="font-size:0.8em">${groupName}</span>`;

                            if (isClassroomIntegrated) {
                                // Classroom Integrated Mode for print
                                htmlPrint += `
                                            <div class="master-group-block classroom-integrated ${spanClass}">
                                                <div class="master-group-header">${course.name} ${displayGroupName}</div>
                                                <div class="master-group-info-vertical">
                                                    <div class="master-info-row">👨‍🏫 ${teacherDisplay}</div>
                                                    <div class="master-info-row">🏠 ${details.room || '待訂'}</div>
                                                </div>
                                            </div>
                                        `;
                            } else {

                                // Normal Master Schedule Mode
                                let groupStudents = assignments[course.id]?.[groupName] || [];
                                const override = slotOverrides[slotKey]?.[course.id]?.[groupName];

                                if (override) {
                                    if (Array.isArray(override)) {
                                        // Legacy support: Absolute list
                                        groupStudents = override;
                                    } else if (override.type === 'delta') {
                                        // New Delta support: Apply additions and removals
                                        // 1. Filter out removed
                                        groupStudents = groupStudents.filter(sid => !override.removed.includes(sid));
                                        // 2. Add added (avoid duplicates)
                                        override.added.forEach(sid => {
                                            if (!groupStudents.includes(sid)) groupStudents.push(sid);
                                        });
                                    }
                                }

                                const studentNames = groupStudents.map(studentId => {
                                    const student = students.find(s => s.id === studentId);
                                    return student ? `${student.grade} ${student.name}` : '';
                                }).filter(name => name);

                                htmlPrint += `
                                            <div class="master-group-block ${spanClass}">
                                                <div class="master-group-header">${course.name} ${displayGroupName}</div>
                                                <div class="master-group-info-vertical">
                                                    <div class="master-info-row">👨‍🏫 ${teacherDisplay}</div>
                                                    <div class="master-info-row">🏠 ${details.room || '待訂'}</div>
                                                </div>
                                                ${studentNames.length > 0 ? `
                                                    <div class="master-student-list-vertical">
                                                        ${studentNames.map(name => `<div class="master-student-item">${name}</div>`).join('')}
                                                    </div>
                                                ` : '<div style="color: #999; font-size: 0.85rem; margin-top: 0.3rem;">尚未分配學生</div>'}
                                            </div>
                                        `;
                            }
                        });
                    } else {
                        htmlPrint += '<span class="empty-cell">-</span>';
                    }

                    htmlPrint += '</div></td>';
                });

                // Period column at the end
                htmlPrint += `
                    <td class="col-period">
                        <div class="period-cell">
                            <div class="period-name">${slot.name}</div>
                            <div class="period-time">${slot.time}</div>
                        </div>
                    </td>
                `;

                htmlPrint += '</tr>';
            });

            tbodyPrint.innerHTML = htmlPrint;
        }
    }

    window.printMasterSchedule = function () {
        setTimeout(() => window.print(), 100);
    };

    // Add event listener for master schedule export button
    const btnExportMasterSchedule = document.getElementById('btn-export-master-schedule');
    if (btnExportMasterSchedule) {
        btnExportMasterSchedule.addEventListener('click', () => {
            const type = document.getElementById('schedule-type-select').value;
            // Check if renderPrintTeacherSchedules exists (it should)
            if (type === 'teacher' && window.renderPrintTeacherSchedules) {
                window.renderPrintTeacherSchedules();
                document.body.classList.add('print-teacher-mode');

                const cleanup = () => {
                    document.body.classList.remove('print-teacher-mode');
                    window.removeEventListener('afterprint', cleanup);
                };
                window.addEventListener('afterprint', cleanup);

                setTimeout(() => window.print(), 100);
            } else {
                // Determine current type to ensure correct content is ready
                if (type === 'master') {
                    generatedSchedulesContainer.innerHTML = ''; // Ensure clean state
                    renderMasterSchedule();
                } else if (type === 'student') {
                    generateStudentSchedules();
                } else if (type === 'classroom') {
                    generateClassroomSchedules();
                }

                document.body.classList.add('print-general-mode');

                const cleanup = () => {
                    document.body.classList.remove('print-general-mode');
                    window.removeEventListener('afterprint', cleanup);
                };
                window.addEventListener('afterprint', cleanup);

                setTimeout(() => window.print(), 100);
            }
        });
    }

    // --- Schedule Generation Features ---
    const scheduleTypeSelect = document.getElementById('schedule-type-select');
    const masterScheduleContent = document.getElementById('master-schedule-content');
    const generatedSchedulesContainer = document.getElementById('generated-schedules-container');

    if (scheduleTypeSelect) {
        scheduleTypeSelect.addEventListener('change', (e) => {
            const type = e.target.value;
            if (type === 'master' || type === 'classroom_integrated') {
                masterScheduleContent.style.display = 'block';
                generatedSchedulesContainer.style.display = 'none';
                generatedSchedulesContainer.innerHTML = ''; // Clear content to prevent printing issues
                renderMasterSchedule(type === 'classroom_integrated');
            } else {
                masterScheduleContent.style.display = 'none';
                generatedSchedulesContainer.style.display = 'block';
                if (type === 'teacher') generateTeacherSchedules();
                else if (type === 'student') generateStudentSchedules();
                else if (type === 'classroom') generateClassroomSchedules();
            }
        });
    }

    function getCommonTimeSlots() {
        return [
            { period: 'morning', name: '早自習', time: '', isSpecial: true },
            { period: '1', name: '第一節', time: '08:30~09:15' },
            { period: '2', name: '第二節', time: '09:25~10:10' },
            { period: '3', name: '第三節', time: '10:20~11:05' },
            { period: '4', name: '第四節', time: '11:15~12:00' },
            { period: 'lunch', name: '中午', time: '12:30~13:10', isSpecial: true },
            { period: '5', name: '第五節', time: '13:20~14:05' },
            { period: '6', name: '第六節', time: '14:15~15:00' },
            { period: '7', name: '第七節', time: '15:20~16:05' }
        ];
    }

    function getWeekdays() {
        return [
            { key: 'monday', name: '星期一' },
            { key: 'tuesday', name: '星期二' },
            { key: 'wednesday', name: '星期三' },
            { key: 'thursday', name: '星期四' },
            { key: 'friday', name: '星期五' }
        ];
    }

    function generateIndividualScheduleHTML(title, getCellContent, extraClass = '') {
        const timeSlots = getCommonTimeSlots();
        const weekdays = getWeekdays();

        let html = `
            <div class="individual-schedule ${extraClass}">
                <h3 class="schedule-title">${title}</h3>
                <table class="master-schedule-table">
                    <thead>
                        <tr>
                            <th class="col-period">節次 / 時間</th>
                            ${weekdays.map(d => `<th>${d.name}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        timeSlots.forEach(slot => {
            if (slot.isSpecial) {
                html += `
                    <tr>
                        <td class="col-period">
                            <div class="period-cell">
                                <div class="period-name">${slot.name}</div>
                                ${slot.time ? `<div class="period-time">${slot.time}</div>` : ''}
                            </div>
                        </td>
                        <td colspan="5" style="background-color: #f8f9fa; text-align: center; vertical-align: middle;">
                            <span style="color: #999;">${slot.name}時段</span>
                        </td>
                    </tr>
                `;
                return;
            }

            html += `
                <tr>
                    <td class="col-period">
                        <div class="period-cell">
                            <div class="period-name">${slot.name}</div>
                            <div class="period-time">${slot.time}</div>
                        </div>
                    </td>
            `;

            weekdays.forEach(day => {
                const slotKey = `${day.key}-${slot.period}`;
                const content = getCellContent(slotKey);
                html += `<td>${content || '<span class="empty-cell">-</span>'}</td>`;
            });

            html += '</tr>';
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
        return html;
    }

    function generateTeacherSchedules() {
        let html = '';
        const validTeachers = teachers.filter(t => t && t.name);

        if (validTeachers.length === 0) {
            generatedSchedulesContainer.innerHTML = '<div class="empty-state">尚無教師資料</div>';
            return;
        }

        const timeSlots = getCommonTimeSlots();
        const weekdays = getWeekdays();

        validTeachers.forEach(teacher => {
            const teacherName = teacher.name;
            const baseHours = teacher.baseHours || 0;

            if (!teacherPartTimeMarks[teacherName]) {
                teacherPartTimeMarks[teacherName] = {};
            }

            // Collect course statistics
            const teacherCourses = {};
            let totalHours = 0;
            let partTimeHours = 0;

            // Start building teacher schedule HTML
            html += `
                <div class="individual-schedule">
                    <h3 class="schedule-title">${teacherName}老師課表</h3>
                    <table class="master-schedule-table">
                        <thead>
                            <tr>
                                <th class="col-period">節次 / 時間</th>
                                ${weekdays.map(d => `<th>${d.name}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
            `;

            // Generate regular schedule rows
            timeSlots.forEach(slot => {
                if (slot.isSpecial) {
                    html += `
                        <tr>
                            <td class="col-period">
                                <div class="period-cell">
                                    <div class="period-name">${slot.name}</div>
                                    ${slot.time ? `<div class="period-time">${slot.time}</div>` : ''}
                                </div>
                            </td>
                            <td colspan="5" style="background-color: #f8f9fa; text-align: center; vertical-align: middle;">
                                <span style="color: #999;">${slot.name}時段</span>
                            </td>
                        </tr>
                    `;
                    return;
                }

                html += `
                    <tr>
                        <td class="col-period">
                            <div class="period-cell">
                                <div class="period-name">${slot.name}</div>
                                <div class="period-time">${slot.time}</div>
                            </div>
                        </td>
                `;

                weekdays.forEach(day => {
                    const slotKey = `${day.key}-${slot.period}`;
                    const blocks = scheduleData[slotKey];

                    if (!blocks || !Array.isArray(blocks)) {
                        html += '<td><span class="empty-cell">-</span></td>';
                        return;
                    }

                    const teacherBlocks = [];
                    blocks.forEach(block => {
                        const course = courses.find(c => c.id === block.courseId);
                        if (!course) return;

                        course.groups.forEach(groupName => {
                            const details = course.groupDetails[groupName];
                            if (!details) return;

                            let isMatch = false;
                            if (Array.isArray(details.teacher)) {
                                isMatch = details.teacher.includes(teacherName);
                            } else {
                                isMatch = details.teacher === teacherName;
                            }

                            if (isMatch) {
                                if (!teacherCourses[course.name]) {
                                    teacherCourses[course.name] = 0;
                                }
                                teacherCourses[course.name]++;
                                totalHours++;

                                const isPartTime = teacherPartTimeMarks[teacherName][slotKey] === true;
                                if (isPartTime) {
                                    partTimeHours++;
                                }

                                teacherBlocks.push(`
                                    <div class="master-group-block clickable-course ${isPartTime ? 'part-time-mark' : ''}" 
                                         data-teacher="${teacherName}" 
                                         data-slot="${slotKey}"
                                         onclick="togglePartTimeMark('${teacherName}', '${slotKey}')">
                                        <div class="master-group-header">${course.name} - ${groupName}</div>
                                        ${isPartTime ? '<div class="master-info-row" style="color: #d97706; font-weight: 500;">(兼課)</div>' : ''}
                                        <div class="master-info-row">${details.room || '待訂'}</div>
                                    </div>
                                `);
                            }
                        });
                    });

                    html += `<td>${teacherBlocks.join('') || '<span class="empty-cell">-</span>'}</td>`;
                });

                html += '</tr>';
            });

            // Calculate overtime (No longer auto-calculated)
            // const overtime = Math.max(0, totalHours - baseHours); 
            // Note: Overtime is now manual input

            // Add statistics rows inside the table
            html += `
                        <tr class="stats-row">
                            <td colspan="6" style="padding: 0.8rem; background-color: #f8f9fa;">
                                <div style="text-align: left; font-size: 0.95rem;">
                                    ${Object.entries(teacherCourses).map(([name, count]) =>
                `${name}：${count}節`
            ).join('　　')}
                                </div>
                            </td>
                        </tr>
                        <tr class="stats-row">
                            <td style="border: 1px solid #ddd; padding: 0.6rem; text-align: center;">總時數：${totalHours}節</td>
                            <td style="border: 1px solid #ddd; padding: 0.6rem; text-align: center;">
                                基本鐘點：${baseHours}節
                                <div style="margin-top: 4px;">
                                    <input type="text" 
                                           class="form-control" 
                                           style="font-size: 0.85rem; padding: 2px 4px; text-align: center; width: 90%; margin: 0 auto; background: #eee;" 
                                           placeholder="(備註)" 
                                           value="${teacher.note || ''}" 
                                           onchange="updateTeacherNote(${teacher.id}, this.value)"
                                           onclick="event.stopPropagation()">
                                </div>
                            </td>
                            <td colspan="2" style="border: 1px solid #ddd; padding: 0.6rem; text-align: center;">兼課：${partTimeHours}節</td>
                            <td colspan="2" style="border: 1px solid #ddd; padding: 0.6rem; text-align: center;">
                                超鐘點
                                <div style="margin-top: 4px;">
                                     <input type="number" 
                                           class="form-control" 
                                           style="font-size: 0.85rem; padding: 2px 4px; text-align: center; width: 60px; margin: 0 auto; background: #eee;" 
                                           placeholder="" 
                                           value="${teacher.overtime || ''}" 
                                           onchange="updateTeacherOvertime(${teacher.id}, this.value)"
                                           onclick="event.stopPropagation()">
                                </div>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            `;
        });

        generatedSchedulesContainer.innerHTML = html;
    }

    // Update teacher overtime
    window.updateTeacherOvertime = function (teacherId, value) {
        const teacher = teachers.find(t => t.id === teacherId);
        if (teacher) {
            teacher.overtime = value;
            saveTeachers();
        }
    };

    function generateStudentSchedules() {
        let html = '';
        const validStudents = students.filter(s => s && s.name);

        if (validStudents.length === 0) {
            generatedSchedulesContainer.innerHTML = '<div class="empty-state">尚無學生資料</div>';
            return;
        }

        // Shared Data
        const timeSlots = getCommonTimeSlots();
        const toChineseNum = (num) => {
            const map = { '1': '一', '2': '二', '3': '三' };
            return map[num] || num;
        };

        const scheduleTitle = {
            prefix: document.getElementById('title-prefix')?.value || '',
            year: document.getElementById('title-year')?.value || '',
            semester: document.getElementById('title-semester')?.value || ''
        };

        validStudents.forEach(student => {
            const semesterChinese = toChineseNum(scheduleTitle.semester);
            const titleHeader = `新北市立江翠國中特教班 ${scheduleTitle.year} 學年度第${semesterChinese}學期課表`;
            const fullTitleScreen = `${scheduleTitle.prefix} ${scheduleTitle.year} 學年度第 ${scheduleTitle.semester} 學期 ${student.grade} ${student.name} 課表`;

            // --- 1. Screen Layout (Standard: Mon -> Fri) ---
            const weekdaysScreen = [
                { key: 'monday', name: '星期一' },
                { key: 'tuesday', name: '星期二' },
                { key: 'wednesday', name: '星期三' },
                { key: 'thursday', name: '星期四' },
                { key: 'friday', name: '星期五' }
            ];

            html += `
                <!-- Screen Version -->
                <div class="individual-schedule student-schedule-screen">
                    <h3 class="schedule-title">${fullTitleScreen}</h3>
                    <table class="master-schedule-table">
                        <thead>
                            <tr>
                                <th class="col-period">節次 / 時間</th>
                                ${weekdaysScreen.map(d => `<th>${d.name}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
            `;

            timeSlots.forEach(slot => {
                // Screen version keeps special slots (Morning, Lunch)
                if (slot.isSpecial) {
                    html += `
                        <tr>
                            <td class="col-period">
                                <div class="period-cell">
                                    <div class="period-name">${slot.name}</div>
                                    ${slot.time ? `<div class="period-time">${slot.time}</div>` : ''}
                                </div>
                            </td>
                            <td colspan="5" style="background-color: #f8f9fa; text-align: center; vertical-align: middle;">
                                <span style="color: #999;">${slot.name}時段</span>
                            </td>
                        </tr>
                    `;
                    return;
                }

                html += `
                    <tr>
                        <td class="col-period">
                            <div class="period-cell">
                                <div class="period-name">${slot.name}</div>
                                <div class="period-time">${slot.time}</div>
                            </div>
                        </td>
                `;

                weekdaysScreen.forEach(day => {
                    const slotKey = `${day.key}-${slot.period}`;
                    const content = getStudentCellContent(student, slotKey, day.name, slot.name);
                    html += `
                        <td class="clickable-cell" onclick="openManualEntryModal(${student.id}, '${slotKey}', '${day.name}', '${slot.name}')">
                            ${content || '<span class="empty-cell">-</span>'}
                            <div class="edit-hint">(點擊可編輯課程)</div>
                        </td>
                    `;
                });
                html += '</tr>';
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;

            // --- 2. Print Layout (Custom: Fri -> Mon, Special Format) ---
            const weekdaysPrint = [
                { key: 'friday', name: '五' },
                { key: 'thursday', name: '四' },
                { key: 'wednesday', name: '三' },
                { key: 'tuesday', name: '二' },
                { key: 'monday', name: '一' }
            ];

            html += `
                <!-- Print Version -->
                <div class="individual-schedule student-schedule-print">
                    <div class="schedule-header-container">
                        <h2 class="schedule-main-title">${titleHeader}</h2>
                        <div class="schedule-student-name">${student.name}</div>
                    </div>
                    <table class="master-schedule-table student-table">
                        <thead>
                            <tr>
                                ${weekdaysPrint.map(d => `<th class="col-day">${d.name}</th>`).join('')}
                                <th class="col-time-header">時間</th>
                                <th class="col-period-header"></th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            let isAfterLunch = false;

            timeSlots.forEach(slot => {
                // Print version skips special rows, uses double border
                if (slot.isSpecial) {
                    if (slot.period === 'lunch') isAfterLunch = true;
                    return;
                }

                const rowClass = isAfterLunch ? 'lunch-separator' : '';
                if (isAfterLunch) isAfterLunch = false;

                html += `<tr class="${rowClass}">`;

                // Fri -> Mon columns
                weekdaysPrint.forEach(day => {
                    const slotKey = `${day.key}-${slot.period}`;
                    // Use a specific print content generator or the same one?
                    // The print one has specific styling (large subject, small teacher).
                    // The screen one has standard block styling.
                    // Let's reuse the logic but wrap it differently if needed, 
                    // OR just duplicate the simple extraction logic for print to ensure the specific classes match index.css

                    let manualEntry = studentManualEntries[student.id]?.[slotKey];
                    let cellContent = '';

                    if (manualEntry) {
                        if (typeof manualEntry === 'string') manualEntry = { course: manualEntry, teacher: '', room: '' };
                        cellContent = `
                            <div class="student-cell-content">
                                <div class="cell-subject">${manualEntry.course}</div>
                                <div class="cell-teacher">${manualEntry.teacher || ''}</div>
                                <div class="cell-room">${manualEntry.room || ''}</div>
                            </div>
                        `;
                    } else {
                        const blocks = scheduleData[slotKey];
                        if (blocks && Array.isArray(blocks)) {
                            let found = false;
                            for (const block of blocks) {
                                const course = courses.find(c => c.id === block.courseId);
                                if (!course) continue;
                                course.groups.forEach(groupName => {
                                    // Check for override first
                                    const override = slotOverrides[slotKey]?.[course.id]?.[groupName];
                                    let groupStudents = assignments[course.id]?.[groupName] || [];

                                    if (override) {
                                        if (Array.isArray(override)) {
                                            // Legacy: Absolute list
                                            groupStudents = override;
                                        } else if (override.type === 'delta') {
                                            // Delta: Apply changes
                                            // 1. Filter out removed
                                            groupStudents = groupStudents.filter(sid => !override.removed.includes(sid));
                                            // 2. Add added (avoid duplicates)
                                            override.added.forEach(sid => {
                                                if (!groupStudents.includes(sid)) groupStudents.push(sid);
                                            });
                                        }
                                    }

                                    // Ensure it is an array
                                    if (!Array.isArray(groupStudents)) groupStudents = [];

                                    if (groupStudents.includes(student.id)) {
                                        found = true;
                                        const details = course.groupDetails[groupName];
                                        const teacherDisplay = Array.isArray(details.teacher) ? details.teacher.join('、') : (details.teacher || '');
                                        cellContent = `
                                            <div class="student-cell-content">
                                                <div class="cell-subject">${course.name}</div>
                                                <div class="cell-teacher">${teacherDisplay}</div>
                                                <div class="cell-room">${details.room || ''}</div>
                                            </div>
                                        `;
                                    }
                                });
                                if (found) break;
                            }
                        }
                    }

                    // Print cells are also clickable? Maybe not necessary for print view, but harmless.
                    // The print view is hidden on screen anyway.
                    // Actually, if it's hidden on screen, you can't click it.
                    html += `
                        <td class="student-data-cell">
                            ${cellContent}
                        </td>
                    `;
                });

                // Time Column (Stacked)
                const startTime = slot.time ? slot.time.split('~')[0] : '';
                const endTime = slot.time ? slot.time.split('~')[1] : '';
                html += `
                    <td class="col-time-cell">
                        ${startTime ? `<div class="time-stack"><div>${startTime}</div><div>|</div><div>${endTime}</div></div>` : ''}
                    </td>
                `;

                // Period Column (Vertical)
                html += `
                    <td class="col-period-name-cell">
                        <div class="vertical-text">${slot.name}</div>
                    </td>
                `;
                html += '</tr>';
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        });

        generatedSchedulesContainer.innerHTML = html;
    }

    function getStudentCellContent(student, slotKey, dayName, slotName) {
        let manualEntry = studentManualEntries[student.id]?.[slotKey];
        if (manualEntry) {
            if (typeof manualEntry === 'string') manualEntry = { course: manualEntry, teacher: '', room: '' };
            return `
                <div class="master-group-block manual-entry-block">
                    <div class="master-group-header manual-content">${manualEntry.course}</div>
                    ${manualEntry.teacher ? `<div class="master-info-row manual-content">${manualEntry.teacher}</div>` : ''}
                    ${manualEntry.room ? `<div class="master-info-row manual-content">${manualEntry.room}</div>` : ''}
                </div>
            `;
        }

        const blocks = scheduleData[slotKey];
        if (blocks && Array.isArray(blocks)) {
            const studentBlocks = [];
            blocks.forEach(block => {
                const course = courses.find(c => c.id === block.courseId);
                if (!course) return;
                course.groups.forEach(groupName => {
                    // Check for override first
                    // Check for override first
                    const override = slotOverrides[slotKey]?.[course.id]?.[groupName];
                    let groupStudents = assignments[course.id]?.[groupName] || [];

                    if (override) {
                        if (Array.isArray(override)) {
                            // Legacy: Absolute list
                            groupStudents = override;
                        } else if (override.type === 'delta') {
                            // Delta: Apply changes
                            // 1. Filter out removed
                            groupStudents = groupStudents.filter(sid => !override.removed.includes(sid));
                            // 2. Add added (avoid duplicates)
                            override.added.forEach(sid => {
                                if (!groupStudents.includes(sid)) groupStudents.push(sid);
                            });
                        }
                    }

                    // Ensure it is an array
                    if (!Array.isArray(groupStudents)) groupStudents = [];

                    if (groupStudents.some(id => String(id) === String(student.id))) {
                        const details = course.groupDetails[groupName];
                        const teacherDisplay = Array.isArray(details.teacher) ? details.teacher.join(', ') : (details.teacher || '未排');
                        studentBlocks.push(`
                            <div class="master-group-block">
                                <div class="master-group-header">${course.name}</div>
                                <div class="master-info-row">${teacherDisplay}</div>
                                <div class="master-info-row">${details.room || '待訂'}</div>
                            </div>
                        `);
                    }
                });
            });
            return studentBlocks.join('');
        }
        return '';
    }

    // Manual Entry Modal Functions
    window.openManualEntryModal = function (studentId, slotKey, dayName, periodName) {
        const student = students.find(s => s.id === studentId);
        if (!student) return;

        let currentEntry = studentManualEntries[studentId]?.[slotKey] || { course: '', teacher: '', room: '' };

        // Backward compatibility
        if (typeof currentEntry === 'string') {
            currentEntry = { course: currentEntry, teacher: '', room: '' };
        }

        modalTitle.textContent = `編輯課表 - ${student.name}`;
        modalBody.innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <strong>時段：</strong> ${dayName} ${periodName}
            </div>
            <div class="form-group">
                <label>課程名稱</label>
                <input type="text" id="manual-course-input" class="form-control" value="${currentEntry.course || ''}" placeholder="請輸入課程名稱">
            </div>
            <div class="form-group">
                <label>授課教師</label>
                <input type="text" id="manual-teacher-input" class="form-control" value="${currentEntry.teacher || ''}" placeholder="請輸入授課教師">
            </div>
            <div class="form-group">
                <label>教室地點</label>
                <input type="text" id="manual-room-input" class="form-control" value="${currentEntry.room || ''}" placeholder="請輸入教室">
            </div>
            <div style="font-size: 0.9rem; color: #666; margin-top: 1rem;">
                * 填寫任意欄位後儲存，即會取代原排課內容。若要恢復顯示原本排定的課程，請將「課程名稱」清空並儲存。
            </div>
        `;

        modalConfirm.onclick = () => saveStudentManualEntry(studentId, slotKey);
        modal.style.display = 'block'; modalDirty = false;
    };

    window.saveStudentManualEntry = function (studentId, slotKey) {
        const courseInput = document.getElementById('manual-course-input');
        const teacherInput = document.getElementById('manual-teacher-input');
        const roomInput = document.getElementById('manual-room-input');

        const courseVal = courseInput.value.trim();
        const teacherVal = teacherInput.value.trim();
        const roomVal = roomInput.value.trim();

        if (!studentManualEntries[studentId]) {
            studentManualEntries[studentId] = {};
        }

        if (courseVal) {
            studentManualEntries[studentId][slotKey] = {
                course: courseVal,
                teacher: teacherVal,
                room: roomVal
            };
        } else {
            // If course is empty, remove the entry regardless of other fields
            delete studentManualEntries[studentId][slotKey];
            if (Object.keys(studentManualEntries[studentId]).length === 0) {
                delete studentManualEntries[studentId];
            }
        }

        store.set('studentManualEntries', studentManualEntries);
        generateStudentSchedules();
        closeModal();
        saveAllDataToServer();
    };

    // Student Override Modal Functions (for Master Schedule)
    window.openStudentOverrideModal = function (slotKey, courseId, groupName) {
        const course = courses.find(c => c.id === courseId);
        if (!course) return;

        // Get base student list from assignments
        const baseStudents = assignments[courseId]?.[groupName] || [];

        // Get current override
        const override = slotOverrides[slotKey]?.[courseId]?.[groupName];

        // Calculate current effective student list
        let currentStudents = [...baseStudents];
        if (override) {
            if (Array.isArray(override)) {
                // Legacy: absolute list
                currentStudents = override;
            } else if (override.type === 'delta') {
                // Delta: apply changes
                currentStudents = currentStudents.filter(sid => !override.removed.includes(sid));
                override.added.forEach(sid => {
                    if (!currentStudents.includes(sid)) currentStudents.push(sid);
                });
            }
        }

        const isOverridden = !!override;

        // Parse slot key for display
        const [day, period] = slotKey.split('-');
        const dayNames = {
            'monday': '星期一', 'tuesday': '星期二', 'wednesday': '星期三',
            'thursday': '星期四', 'friday': '星期五'
        };
        const periodNames = {
            'morning': '早自習', '1': '第一節', '2': '第二節', '3': '第三節', '4': '第四節',
            'lunch': '午休', '5': '第五節', '6': '第六節', '7': '第七節'
        };

        modalTitle.textContent = `正在編輯 ${course.name} 在此時段的學生名單。`;

        // Sort students by grade (descending) then name
        const sortedStudents = [...students].sort((a, b) => {
            if (b.grade !== a.grade) return b.grade - a.grade;
            return a.name.localeCompare(b.name);
        });

        // Group students by grade
        const studentsByGrade = { 9: [], 8: [], 7: [] };
        sortedStudents.forEach(s => {
            if (studentsByGrade[s.grade]) studentsByGrade[s.grade].push(s);
        });

        // Build grade-based HTML
        let studentListHTML = '';
        [9, 8, 7].forEach(grade => {
            if (studentsByGrade[grade].length > 0) {
                studentListHTML += `<div class="grade-section" style="margin-bottom: 1rem;"><h4 style="color: #3b82f6; margin-bottom: 0.5rem;">${grade} 年級</h4><div class="student-checkbox-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">`;
                studentsByGrade[grade].forEach(student => {
                    const isChecked = currentStudents.includes(student.id);
                    studentListHTML += `
                        <label class="student-checkbox-item" style="display: flex; align-items: center; padding: 8px; background: ${isChecked ? '#dbeafe' : '#fff'}; border: 1px solid ${isChecked ? '#3b82f6' : '#e5e7eb'}; border-radius: 4px; cursor: pointer;">
                            <input type="checkbox" value="${student.id}" ${isChecked ? 'checked' : ''} style="margin-right: 8px; width: 16px; height: 16px;">
                            <span style="display: inline-block; min-width: 24px; font-weight: 600; color: #6b7280; background: #e5e7eb; border-radius: 50%; text-align: center; margin-right: 6px;">${student.grade}</span>
                            <span style="font-weight: 500;">${student.name}</span>
                        </label>
                    `;
                });
                studentListHTML += `</div></div>`;
            }
        });

        let html = `
            <div style="margin-bottom: 1rem; padding: 10px; background: ${isOverridden ? '#fef3c7' : '#f0f9ff'}; border-left: 3px solid ${isOverridden ? '#f59e0b' : '#3b82f6'}; border-radius: 4px;">
                ${isOverridden ? '<strong>⚠️ 此時段目前使用微調名單</strong>' : '<strong>目前使用全域預設名單</strong>'}
            </div>
            <div style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 10px;">
                ${studentListHTML}
            </div>
        `;

        modalBody.innerHTML = html;

        // Add checkbox change listeners for visual feedback
        setTimeout(() => {
            const checkboxes = modalBody.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const label = e.target.closest('label');
                    if (e.target.checked) {
                        label.style.background = '#dbeafe';
                        label.style.borderColor = '#3b82f6';
                    } else {
                        label.style.background = '#fff';
                        label.style.borderColor = '#e5e7eb';
                    }
                });
            });
        }, 0);

        // Store context for save function
        modalConfirm.onclick = () => saveStudentOverride(slotKey, courseId, groupName, baseStudents);

        // Add reset button ONLY for this modal
        const modalFooter = modal.querySelector('.modal-footer');
        // Remove any existing clear button first
        const existingClearBtn = modalFooter.querySelector('.btn-clear-override');
        if (existingClearBtn) existingClearBtn.remove();

        const resetBtn = document.createElement('button');
        resetBtn.textContent = '🔄 重設此時段調整';
        resetBtn.className = 'btn-secondary btn-clear-override';
        resetBtn.style.marginRight = '10px';
        resetBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Reset button clicked:', slotKey, courseId, groupName);
            clearStudentOverride(slotKey, courseId, groupName);
        };
        modalFooter.insertBefore(resetBtn, modalFooter.firstChild);

        modal.style.display = 'block'; modalDirty = false;
    };

    function saveStudentOverride(slotKey, courseId, groupName, baseStudents) {
        // Get selected students
        const checkboxes = modalBody.querySelectorAll('input[type="checkbox"]:checked');
        const selectedStudents = Array.from(checkboxes).map(cb => parseInt(cb.value));

        // Calculate delta
        const added = selectedStudents.filter(sid => !baseStudents.includes(sid));
        const removed = baseStudents.filter(sid => !selectedStudents.includes(sid));

        // Initialize structure if needed
        if (!slotOverrides[slotKey]) slotOverrides[slotKey] = {};
        if (!slotOverrides[slotKey][courseId]) slotOverrides[slotKey][courseId] = {};

        let hasChanges = false;
        if (added.length === 0 && removed.length === 0) {
            // No changes, remove override
            delete slotOverrides[slotKey][courseId][groupName];
            if (Object.keys(slotOverrides[slotKey][courseId]).length === 0) {
                delete slotOverrides[slotKey][courseId];
            }
            if (Object.keys(slotOverrides[slotKey]).length === 0) {
                delete slotOverrides[slotKey];
            }
        } else {
            // Store delta
            slotOverrides[slotKey][courseId][groupName] = {
                type: 'delta',
                added: added,
                removed: removed
            };
            hasChanges = true;
        }

        // Close modal first
        closeModal();

        // Show loading overlay
        showLoadingOverlay('正在更新課表...');

        // Save to localStorage
        store.set('slotOverrides', slotOverrides);

        // Force re-render with loading feedback
        setTimeout(() => {
            renderMasterSchedule();
            hideLoadingOverlay();

            // Show feedback based on changes
            if (hasChanges) {
                showToast(`✅ 已調整學生名單 (新增${added.length}位，移除${removed.length}位)`, 'success');
            } else {
                showToast('✅ 已恢復為原始分組設定', 'info');
            }
        }, 150);

        saveAllDataToServer();
    }

    // Loading overlay functions
    function showLoadingOverlay(message) {
        let overlay = document.getElementById('loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.innerHTML = `
                <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 99999; display: flex; justify-content: center; align-items: center;">
                    <div style="background: white; padding: 30px 50px; border-radius: 10px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                        <div style="width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top: 4px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
                        <div id="loading-message" style="font-size: 16px; color: #374151; font-weight: 500;">${message}</div>
                    </div>
                </div>
                <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
            `;
            document.body.appendChild(overlay);
        } else {
            document.getElementById('loading-message').textContent = message;
            overlay.style.display = 'block';
        }
    }

    function hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.remove();
    }

    function showToast(message, type = 'info') {
        // Remove existing toast
        const existing = document.getElementById('action-toast');
        if (existing) existing.remove();

        const colors = {
            success: { bg: '#10b981', border: '#059669' },
            info: { bg: '#3b82f6', border: '#2563eb' },
            warning: { bg: '#f59e0b', border: '#d97706' },
            error: { bg: '#ef4444', border: '#dc2626' }
        };
        const color = colors[type] || colors.info;

        const toast = document.createElement('div');
        toast.id = 'action-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${color.bg};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 100000;
            font-weight: 500;
            animation: slideIn 0.3s ease-out;
        `;
        toast.innerHTML = `<style>@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }</style>${message}`;
        document.body.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function clearStudentOverride(slotKey, courseId, groupName) {
        // Close modal first
        closeModal();

        const hasOverride = slotOverrides[slotKey]?.[courseId]?.[groupName];

        if (hasOverride) {
            // Show loading overlay
            showLoadingOverlay('正在重設名單...');

            delete slotOverrides[slotKey][courseId][groupName];

            if (Object.keys(slotOverrides[slotKey][courseId]).length === 0) {
                delete slotOverrides[slotKey][courseId];
            }
            if (Object.keys(slotOverrides[slotKey]).length === 0) {
                delete slotOverrides[slotKey];
            }

            store.set('slotOverrides', slotOverrides);
            saveAllDataToServer();

            // Refresh with delay
            setTimeout(() => {
                renderMasterSchedule();
                hideLoadingOverlay();
                showToast('✅ 已恢復為分組管理中的原始設定', 'success');
            }, 150);
        } else {
            showToast('此時段未進行過調整', 'info');
        }
    }

    function generateClassroomSchedules() {
        let html = '';
        // Collect all unique rooms
        const rooms = new Set();
        courses.forEach(c => {
            if (c.groupDetails) {
                Object.values(c.groupDetails).forEach(d => {
                    if (d.room) rooms.add(d.room);
                    if (d.displayRoom) rooms.add(d.displayRoom);
                });
            }
        });

        if (rooms.size === 0) {
            generatedSchedulesContainer.innerHTML = '<div class="empty-state">尚無教室資料</div>';
            return;
        }

        const sortedRooms = Array.from(rooms).sort();
        const weekdaysPrint = [
            { key: 'friday', name: '星期五' },
            { key: 'thursday', name: '星期四' },
            { key: 'wednesday', name: '星期三' },
            { key: 'tuesday', name: '星期二' },
            { key: 'monday', name: '星期一' }
        ];

        const scheduleTitle = {
            prefix: document.getElementById('title-prefix')?.value || '',
            year: document.getElementById('title-year')?.value || '',
            semester: document.getElementById('title-semester')?.value || ''
        };

        const timeSlots = getCommonTimeSlots();
        const today = new Date();
        const dateStr = `${today.getFullYear() - 1911}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')} 製`;

        sortedRooms.forEach(room => {
            // Screen Version (Mon-Fri)
            const fullTitle = `${scheduleTitle.prefix} ${scheduleTitle.year} 學年度第 ${scheduleTitle.semester} 學期 ${room} 課表`;

            // Screen HTML
            html += generateIndividualScheduleHTML(fullTitle, (slotKey) => {
                const blocks = scheduleData[slotKey];
                if (!blocks || !Array.isArray(blocks)) return null;

                const roomBlocks = [];
                blocks.forEach(block => {
                    const course = courses.find(c => c.id === block.courseId);
                    if (!course) return;

                    course.groups.forEach(groupName => {
                        const details = course.groupDetails[groupName];
                        // Use displayRoom if set, otherwise original room
                        const effectiveRoom = details.displayRoom || details.room;

                        if (details && effectiveRoom === room) {
                            const teacherDisplay = Array.isArray(details.teacher) ? details.teacher.join(', ') : (details.teacher || '未排');

                            roomBlocks.push(`
                                <div class="master-group-block">
                                    <div class="master-group-header">${course.name} - ${groupName}</div>
                                    <div class="master-info-row">${teacherDisplay}</div>
                                </div>
                            `);
                        }
                    });
                });
                return roomBlocks.join('');
            }, 'classroom-schedule-screen');

            // Print Version (Fri-Mon, Custom Layout)
            html += `
                <div class="individual-schedule classroom-schedule-print">
                    <div class="classroom-print-header">
                        <h2 class="classroom-title">
                            ${scheduleTitle.prefix} ${scheduleTitle.year} 學年度第 ${scheduleTitle.semester} 學期${room} 課表
                        </h2>
                        <div class="classroom-date-generated">${dateStr}</div>
                    </div>
                    
                    <table class="classroom-print-table">
                        <thead>
                            <tr>
                                ${weekdaysPrint.map(d => `<th>${d.name}</th>`).join('')}
                                <th class="col-time-print"></th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            let isAfterLunch = false;

            timeSlots.forEach(slot => {
                if (slot.isSpecial) {
                    // Skip special slots like Morning/Lunch in this specific print layout if not desired, 
                    // BUT the image might include them? The image started with empty/blank cells.
                    // The image shows 7 periods. It likely excludes morning/lunch or treats them differently.
                    // User said "版面格式必須與圖片相同". 
                    // The image shows 7 rows. Let's assume standard 1-7 periods.
                    // If Morning/Lunch are needed, we can add them, but standard classroom schedules usually focus on periods.
                    // However, if there are classes in morning/lunch, they should be shown.
                    // Let's Skip Morning/Lunch for now based on "7 rows" visual in most standard TW schedules unless data exists?
                    // No, let's keep it safe. If isSpecial, we might skip or show a thin row?
                    // The image doesn't clearly show Morning/Lunch. It starts with empty rows and has "第1節...".
                    // Let's assume we skip Morning, but maybe Lunch is a break?
                    // For now, I'll Skip Morning and Lunch to match the "7 periods" typical layout, unless requested otherwise.
                    // Wait, checking the image again...
                    // The image has 7 rows (Section 1 to 7).
                    // So I will filter out isSpecial.
                    return;
                }

                html += `<tr>`;

                // Weekdays Fri -> Mon
                weekdaysPrint.forEach(day => {
                    const slotKey = `${day.key}-${slot.period}`;
                    const blocks = scheduleData[slotKey];
                    let cellContent = '';

                    if (blocks && Array.isArray(blocks)) {
                        const roomBlocks = [];
                        blocks.forEach(block => {
                            const course = courses.find(c => c.id === block.courseId);
                            if (!course) return;

                            course.groups.forEach(groupName => {
                                const details = course.groupDetails[groupName];
                                // Use displayRoom if set, otherwise original room
                                const effectiveRoom = details.displayRoom || details.room;

                                if (details && effectiveRoom === room) {
                                    // Found class in this room
                                    const teacherDisplay = Array.isArray(details.teacher)
                                        ? details.teacher.join('、')
                                        : (details.teacher || '');

                                    roomBlocks.push(`
                                        <div class="classroom-cell-content">
                                            <div class="cell-subject">${course.name}</div>
                                            <div class="cell-teacher">${teacherDisplay}</div>
                                            <div class="cell-room">【${room}】</div> <!-- Explicitly putting room here as per image, though it's redundant for the room schedule, the image has it -->
                                        </div>
                                    `);
                                }
                            });
                        });
                        cellContent = roomBlocks.join('<br>');
                    }

                    html += `<td>${cellContent}</td>`;
                });

                // Time/Period Column (Last)
                const startTime = slot.time ? slot.time.split('~')[0].replace(':', ' : ') : '';
                const endTime = slot.time ? slot.time.split('~')[1].replace(':', ' : ') : '';

                // Convert Chinese number to Arabic for "Section" display to match image (e.g., 第一節 -> 第 1 節)
                const chineseNumMap = { '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9' };
                // Extract the Chinese number part, e.g., "第一節" -> "一"
                const sectionName = slot.name.replace('第', '').replace('節', '');
                const arabicNum = chineseNumMap[sectionName] || sectionName;

                html += `
                    <td class="col-time-print-cell">
                        <div class="period-num">第 ${arabicNum} 節</div>
                        <div class="period-time">${startTime}</div>
                        <div class="period-time-sep">/</div>
                        <div class="period-time">${endTime}</div>
                    </td>
                `;

                html += `</tr>`;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        });
        generatedSchedulesContainer.innerHTML = html;
    }

    // Update teacher note
    window.updateTeacherNote = function (teacherId, note) {
        const teacher = teachers.find(t => t.id === teacherId);
        if (teacher) {
            teacher.note = note;
            saveTeachers();
        }
    };

    // Toggle part-time mark for teacher schedule
    window.togglePartTimeMark = function (teacherName, slotKey) {
        if (!teacherPartTimeMarks[teacherName]) {
            teacherPartTimeMarks[teacherName] = {};
        }

        // Toggle the mark
        teacherPartTimeMarks[teacherName][slotKey] = !teacherPartTimeMarks[teacherName][slotKey];

        // Save to localStorage
        store.set('teacherPartTimeMarks', teacherPartTimeMarks);

        // Regenerate teacher schedules to reflect the change
        generateTeacherSchedules();
    };

    // Update renderMasterSchedule when switching to the view
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));
            btn.classList.add('active');
            const viewId = btn.dataset.view + '-view';
            const targetView = document.getElementById(viewId);
            if (targetView) targetView.classList.add('active');

            // Refresh dropdown when entering Groups view
            if (btn.dataset.view === 'groups') {
                updateGroupingCourseSelect();
            }

            if (btn.dataset.view === 'master-schedule') {
                renderMasterSchedule();
            }
        });
    });

    // --- Print Schedule Functions ---
    window.renderPrintSchedule = function () {
        const wrapper = document.getElementById('print-schedule-wrapper');
        // Fix: Move wrapper to body to avoid being hidden by parent view
        if (wrapper && wrapper.parentElement !== document.body) {
            document.body.appendChild(wrapper);
        }

        const titleElement = document.getElementById('print-schedule-title');
        const dateElement = document.getElementById('print-implementation-date');
        const tbody = document.getElementById('print-schedule-tbody');

        if (!tbody) return;

        // 1. Sync Title
        const prefix = document.getElementById('title-prefix').value || '';
        const year = document.getElementById('title-year').value || '';
        const semester = document.getElementById('title-semester').value || '';
        const suffix = document.getElementById('title-suffix').value || '';
        titleElement.textContent = `${prefix} ${year}學年度第${semester}學期 ${suffix}課表`;

        // 2. Sync Date
        const startDate = document.getElementById('implementation-start-date').value;
        const endDate = document.getElementById('implementation-end-date').value;
        if (startDate || endDate) {
            const fmt = (d) => d ? d.replace(/-/g, '.') : '____.__.__';
            dateElement.textContent = `實施日期 ${fmt(startDate)}-${fmt(endDate)}`;
        } else {
            dateElement.textContent = '';
        }

        // 3. Render Table Content (A4 Portrait Simple)
        const timeSlots = [
            { period: 'morning', name: '早自習', time: '' },
            { period: '1', name: '1', time: '08:30~09:15' },
            { period: '2', name: '2', time: '09:25~10:10' },
            { period: '3', name: '3', time: '10:20~11:05' },
            { period: '4', name: '4', time: '11:15~12:00' },
            { period: 'lunch', name: '', time: '午休', isLunch: true },
            { period: '5', name: '5', time: '13:20~14:05' },
            { period: '6', name: '6', time: '14:15~15:00' },
            { period: '7', name: '7', time: '15:20~16:05' }
        ];

        const weekdays = ['friday', 'thursday', 'wednesday', 'tuesday', 'monday'];

        let html = '';

        timeSlots.forEach(slot => {
            if (slot.isLunch) {
                html += `
                    <tr>
                         <td colspan="5" style="text-align: center; height: 50px; vertical-align: middle; border: 1px solid #000; font-size: 14pt;">午休</td>
                        <td style="text-align: center; border: 1px solid #000; white-space: pre-wrap; font-size: 10pt;">12:30\n|\n13:10</td>
                        <td style="text-align: center; border: 1px solid #000;"></td>
                    </tr>
                `;
                return;
            }

            const timeDisplay = slot.time ? slot.time.replace('~', '\n|\n') : '';

            html += '<tr>';

            weekdays.forEach(day => {
                const slotKey = `${day}-${slot.period}`;
                const items = scheduleData[slotKey];
                let content = '';

                if (items && items.length > 0) {
                    const courseNames = items.map(item => {
                        const course = courses.find(c => c.id === item.courseId);
                        if (!course) return '';
                        return course.name;
                    }).filter(n => n);

                    content = courseNames.map(name => {
                        return name.replace(/\(([^)]+)\)/g, '<br><span style="color: grey; font-size: 0.9em;">($1)</span>');
                    }).join('<br>');
                }

                html += `<td style="border: 1px solid #000; height: 60px; text-align: center; vertical-align: middle; font-size: 12pt;">${content}</td>`;
            });

            html += `<td style="border: 1px solid #000; text-align: center; vertical-align: middle; white-space: pre-wrap; font-size: 10pt; line-height: 1.2;">${timeDisplay}</td>`;
            html += `<td style="border: 1px solid #000; text-align: center; vertical-align: middle; font-size: 12pt;">${slot.name}</td>`;
            html += '</tr>';
        });

        tbody.innerHTML = html;
    };

    const btnExportSchedule = document.getElementById('btn-export-schedule');
    if (btnExportSchedule) {
        if (typeof exportSchedulePDF === 'function') {
            btnExportSchedule.removeEventListener('click', exportSchedulePDF);
        }
        btnExportSchedule.onclick = () => {
            if (window.renderPrintSchedule) window.renderPrintSchedule();
            document.body.classList.add('print-simple-mode');
            const cleanup = () => {
                document.body.classList.remove('print-simple-mode');
                window.removeEventListener('afterprint', cleanup);
            };
            window.addEventListener('afterprint', cleanup);
            setTimeout(() => window.print(), 500);
        };
    }

    // --- Teacher Print Logic ---
    window.renderPrintTeacherSchedules = function () {
        const wrapper = document.getElementById('print-teacher-schedule-wrapper');
        if (!wrapper) return;

        // Ensure wrapper is child of body to escape hidden parent views
        if (wrapper.parentElement !== document.body) {
            document.body.appendChild(wrapper);
        }

        let html = '';
        const validTeachers = teachers.filter(t => t && t.name);

        const timeSlots = [
            { period: 'morning', name: '早自習', time: '' },
            { period: '1', name: '1', time: '08:30~09:15' },
            { period: '2', name: '2', time: '09:25~10:10' },
            { period: '3', name: '3', time: '10:20~11:05' },
            { period: '4', name: '4', time: '11:15~12:00' },
            { period: 'lunch', name: '午休', time: '12:30~13:10', isLunch: true },
            { period: '5', name: '5', time: '13:20~14:05' },
            { period: '6', name: '6', time: '14:15~15:00' },
            { period: '7', name: '7', time: '15:20~16:05' }
        ];

        const weekdays = ['friday', 'thursday', 'wednesday', 'tuesday', 'monday'];

        // Helper to check if teacher teaches a block
        const isTeachedBy = (block, teacherName) => {
            const course = courses.find(c => c.id === block.courseId);
            if (!course) return false;
            let found = false;
            course.groups.forEach(groupName => {
                const details = course.groupDetails[groupName];
                if (details) {
                    if (Array.isArray(details.teacher)) {
                        if (details.teacher.includes(teacherName)) found = true;
                    } else if (details.teacher === teacherName) {
                        found = true;
                    }
                }
            });
            return found;
        };

        validTeachers.forEach(teacher => {
            const teacherName = teacher.name;
            const teacherCourses = {};
            let totalHours = 0;
            let partTimeHours = 0;
            const baseHours = teacher.baseHours || 0;

            let tableRows = '';
            timeSlots.forEach(slot => {
                if (slot.isLunch) {
                    tableRows += `
                        <tr>
                            <td colspan="5" style="border: 1px solid #000; text-align: center; font-size: 14pt; height: 35px; vertical-align: middle;">午休</td>
                            <td style="border: 1px solid #000; text-align: center; white-space: pre-wrap; font-size: 10pt;">12:30\n|\n13:10</td>
                             <td style="border: 1px solid #000;"></td>
                        </tr>
                      `;
                    return;
                }

                let rowHtml = '<tr>';
                const timeDisplay = slot.time ? slot.time.replace('~', '\n|\n') : '';

                weekdays.forEach(day => {
                    const slotKey = `${day}-${slot.period}`;
                    const blocks = scheduleData[slotKey] || [];
                    let cellContent = '';

                    // Filter blocks for this teacher
                    // Issue: A slot might have multiple blocks (different courses/groups).
                    // We check if THIS teacher is involved in any.
                    // Note: Logic in generateTeacherSchedules had a bug? It iterated all blocks.
                    // We should unique the content if user teaches multiple groups in same slot (unlikely but possible).

                    const teacherBlocks = [];

                    blocks.forEach(block => {
                        const course = courses.find(c => c.id === block.courseId);
                        if (!course) return;

                        course.groups.forEach(groupName => {
                            const details = course.groupDetails[groupName];
                            if (details) {
                                const isMatch = Array.isArray(details.teacher) ? details.teacher.includes(teacherName) : details.teacher === teacherName;
                                if (isMatch) {
                                    // Found a teaching block
                                    // Check overlap? Assume valid data.
                                    // Add to stats
                                    const key = `${course.name}`;
                                    // Avoid double counting if same course name multiple times in same slot?
                                    // Stats calculation should be careful. 
                                    // We increment stats here.

                                    // But wait, if I print multiple groups in same cell?
                                    // Only increment once per slot per course? Or per hour?
                                    // Standard logic: 1 slot = 1 hour.
                                    // If teaches 2 groups in same slot (impossible physically), should count as 1?
                                    // Let's assume 1.

                                    teacherBlocks.push({ course, isMatch, slotKey });
                                }
                            }
                        });
                    });

                    // Unique by course name for display?
                    // If teacher matches multiple, display all?
                    if (teacherBlocks.length > 0) {
                        // Only count 1 hour per slot even if data is weird
                        totalHours++;

                        // Check part time mark
                        const isPartTime = teacherPartTimeMarks[teacherName] && teacherPartTimeMarks[teacherName][slotKey];
                        if (isPartTime) partTimeHours++;

                        // Update course counts
                        teacherBlocks.forEach(tb => {
                            if (!teacherCourses[tb.course.name]) teacherCourses[tb.course.name] = 0;
                            // We only increment course count once per slot? 
                            // Current logic: simple count.
                        });
                        // Just take the first one for stats to avoid double count in loop
                        const primaryBlock = teacherBlocks[0];
                        teacherCourses[primaryBlock.course.name] = (teacherCourses[primaryBlock.course.name] || 0) + 1;
                        // Correction: map logic above was wrong.
                        // Fixed: increment count for the primary course.

                        cellContent = teacherBlocks.map(tb => tb.course.name).join(' / ');
                        if (isPartTime) {
                            cellContent += '<br><span style="font-size:0.8em">(兼)</span>';
                        }
                    }

                    rowHtml += `<td style="border: 1px solid #000; text-align: center; height: 55px; font-size: 13pt; vertical-align: middle;">${cellContent}</td>`;
                });

                rowHtml += `<td style="border: 1px solid #000; text-align: center; white-space: pre-wrap; font-size: 10pt; line-height: 1.2; vertical-align: middle;">${timeDisplay}</td>`;
                rowHtml += `<td style="border: 1px solid #000; text-align: center; font-size: 12pt; vertical-align: middle;">${slot.name}</td>`;

                rowHtml += '</tr>';
                tableRows += rowHtml;
            });

            const overtime = Math.max(0, totalHours - baseHours);
            // Note: For print, we use stored overtime value if available, or empty string.
            // Or user wanted manual input.
            // Wait, if user inputs overtime, we should display it. 
            // Previous logic calculated it. Now we read from teacher.overtime.
            const overtimeDisplay = teacher.overtime || '';

            // 處理備註括號邏輯：若已有括號則不重複添加
            let noteDisplay = '';
            if (teacher.note) {
                const note = teacher.note.trim();
                if ((note.startsWith('(') && note.endsWith(')')) || (note.startsWith('（') && note.endsWith('）'))) {
                    noteDisplay = '<br>' + note;
                } else {
                    noteDisplay = '<br>(' + note + ')';
                }
            }

            html += `
                <div class="teacher-print-page">
                    <h1 class="print-header">
                        ${scheduleTitle.prefix} ${scheduleTitle.year} 學年度第 ${scheduleTitle.semester} 學期 特教班教師課表
                    </h1>
                    <div class="print-subheader">任課教師：${teacherName} 老師</div>
                    
                    <table class="print-table">
                        <thead>
                            <tr>
                                <th style="width: 16%;">星期五</th>
                                <th style="width: 16%;">星期四</th>
                                <th style="width: 16%;">星期三</th>
                                <th style="width: 16%;">星期二</th>
                                <th style="width: 16%;">星期一</th>
                                <th style="width: 12%;">時間</th>
                                <th style="width: 8%;">節次</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                    
                    <div class="print-footer-container">
                        <div class="print-date">
                           實施日期 ${implementationDates.startDate ? implementationDates.startDate.replace(/-/g, '.') : '___'} - ${implementationDates.endDate ? implementationDates.endDate.replace(/-/g, '.') : '___'}
                        </div>
                        
                        <div class="print-stats-text">
                            ${Object.entries(teacherCourses).map(([name, count]) => `-${name}：${count} 節`).join('  ')}
                        </div>

                         <table class="print-stats-table">
                            <tr>
                                <td>總時數：${totalHours} 節</td>
                                <td>基本鐘點：${baseHours} 節${noteDisplay}</td>
                                <td>兼課：${partTimeHours} 節</td>
                                <td>超鐘點：${overtimeDisplay ? overtimeDisplay + ' 節' : ''}</td>
                            </tr>
                         </table>
                    </div>
                </div>
             `;
        });

        wrapper.innerHTML = html;
    };

    window.exportScheduleWord = async function () {
        const btn = document.getElementById('btn-export-schedule-word');
        const originalText = btn.textContent;
        btn.textContent = '⏳ 處理中...';
        btn.disabled = true;

        try {
            // 1. Gather Data
            const prefix = document.getElementById('title-prefix').value || '';
            const year = document.getElementById('title-year').value || '';
            const semester = document.getElementById('title-semester').value || '';
            const suffix = document.getElementById('title-suffix').value || '';
            const title = `${prefix} ${year}學年度第${semester}學期 ${suffix}課表`;

            const startDate = document.getElementById('implementation-start-date').value;
            const endDate = document.getElementById('implementation-end-date').value;
            const fmt = (d) => d ? d.replace(/-/g, '.') : '____.__.__';
            const dateRange = startDate || endDate ? `${fmt(startDate)}-${fmt(endDate)}` : '';

            // 2. Build Schedule Rows
            const timeSlots = [
                { period: 'morning', name: '早自習', time: '' },
                { period: '1', name: '1', time: '08:30~09:15' },
                { period: '2', name: '2', time: '09:25~10:10' },
                { period: '3', name: '3', time: '10:20~11:05' },
                { period: '4', name: '4', time: '11:15~12:00' },
                { period: 'lunch', name: '午休', time: '12:30~13:10', isLunch: true },
                { period: '5', name: '5', time: '13:20~14:05' },
                { period: '6', name: '6', time: '14:15~15:00' },
                { period: '7', name: '7', time: '15:20~16:05' }
            ];

            const weekdays = ['friday', 'thursday', 'wednesday', 'tuesday', 'monday'];
            const scheduleRows = timeSlots.map(slot => {
                const row = {
                    period: slot.period,
                    name: slot.name,
                    time: slot.time,
                    isLunch: slot.isLunch || false,
                    days: {}
                };

                if (!slot.isLunch) {
                    weekdays.forEach(day => {
                        const slotKey = `${day}-${slot.period}`;
                        const items = scheduleData[slotKey];
                        if (items && items.length > 0) {
                            const courseNames = items.map(item => {
                                const course = courses.find(c => c.id === item.courseId);
                                if (!course) return '';
                                return course.name;
                            }).filter(n => n);

                            // Format with parentheses for optional details if needed, similar to print
                            // Here just joining with newline for cleaner Word content
                            row.days[day] = courseNames.join('\n');
                        } else {
                            row.days[day] = '';
                        }
                    });
                }
                return row;
            });

            // 3. Generate Client-Side
            await window.generateWordScheduleJS({
                title: title,
                date_range: dateRange,
                schedule: scheduleRows
            });

        } catch (error) {
            console.error('Export Error:', error);
            showSnackbar('匯出失敗: ' + error.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    };

    const btnExportScheduleWord = document.getElementById('btn-export-schedule-word');
    if (btnExportScheduleWord) {
        console.log('Export Word button found, attaching listener');
        btnExportScheduleWord.onclick = window.exportScheduleWord;
    } else {
        console.error('Export Word button NOT found');
    }

    window.exportTeacherScheduleWord = async function (targetBtn = null) {
        const btn = targetBtn || document.getElementById('btn-export-teacher-word');
        // If called from master schedule, btn might be passed. If not, try default (which might not exist in that view)
        if (!btn) {
            console.error('Export button not found');
            return;
        }

        const originalText = btn.textContent;
        btn.textContent = '⏳ 處理中...';
        btn.disabled = true;

        try {
            // 1. Title & Date
            const prefix = document.getElementById('title-prefix').value || '';
            const year = document.getElementById('title-year').value || '';
            const semester = document.getElementById('title-semester').value || '';
            const suffix = document.getElementById('title-suffix').value || '';
            const title = `${prefix} ${year}學年度第${semester}學期 特教班教師課表`;

            const startDate = document.getElementById('implementation-start-date').value;
            const endDate = document.getElementById('implementation-end-date').value;
            const fmt = (d) => d ? d.replace(/-/g, '.') : '____.__.__';
            const dateRange = startDate || endDate ? `${fmt(startDate)}-${fmt(endDate)}` : '';

            // 2. Gather Teachers Data
            const validTeachers = teachers.filter(t => t && t.name);
            const teachersPayload = [];

            // Common Time Slots
            const timeSlots = [
                { period: 'morning', name: '早自習', time: '' },
                { period: '1', name: '1', time: '08:30~09:15' },
                { period: '2', name: '2', time: '09:25~10:10' },
                { period: '3', name: '3', time: '10:20~11:05' },
                { period: '4', name: '4', time: '11:15~12:00' },
                { period: 'lunch', name: '午休', time: '12:30~13:10', isLunch: true },
                { period: '5', name: '5', time: '13:20~14:05' },
                { period: '6', name: '6', time: '14:15~15:00' },
                { period: '7', name: '7', time: '15:20~16:05' }
            ];
            const weekdays = ['friday', 'thursday', 'wednesday', 'tuesday', 'monday'];

            validTeachers.forEach(teacher => {
                const teacherName = teacher.name;
                const teacherCourses = {};
                let totalHours = 0;
                let partTimeHours = 0;
                const baseHours = teacher.baseHours || 0;

                const scheduleRows = timeSlots.map(slot => {
                    const row = {
                        period: slot.period,
                        name: slot.name,
                        time: slot.time,
                        isLunch: slot.isLunch || false,
                        days: {}
                    };

                    if (!slot.isLunch) {
                        weekdays.forEach(day => {
                            const slotKey = `${day}-${slot.period}`;
                            const blocks = scheduleData[slotKey] || [];

                            // Check teaching blocks
                            const teacherBlocks = [];
                            blocks.forEach(block => {
                                const course = courses.find(c => c.id === block.courseId);
                                if (!course) return;
                                course.groups.forEach(groupName => {
                                    const details = course.groupDetails[groupName];
                                    if (details) {
                                        const isMatch = Array.isArray(details.teacher) ? details.teacher.includes(teacherName) : details.teacher === teacherName;
                                        if (isMatch) teacherBlocks.push({ course, slotKey });
                                    }
                                });
                            });

                            if (teacherBlocks.length > 0) {
                                totalHours++;
                                const isPartTime = teacherPartTimeMarks[teacherName] && teacherPartTimeMarks[teacherName][slotKey];
                                if (isPartTime) partTimeHours++;

                                const primaryBlock = teacherBlocks[0];
                                teacherCourses[primaryBlock.course.name] = (teacherCourses[primaryBlock.course.name] || 0) + 1;

                                const names = teacherBlocks.map(tb => tb.course.name).join(' / ');
                                row.days[day] = names + (isPartTime ? '<br>(兼)' : '');
                            } else {
                                row.days[day] = '';
                            }
                        });
                    }
                    return row;
                });

                const overtime = Math.max(0, totalHours - baseHours);
                const overtimeDisplay = teacher.overtime || '';

                // Stats Text
                const statsText = Object.entries(teacherCourses).map(([name, count]) => `-${name}：${count} 節`).join('  ');

                // Note logic
                let noteDisplay = '';
                if (teacher.note) {
                    const note = teacher.note.trim();
                    if ((note.startsWith('(') && note.endsWith(')')) || (note.startsWith('（') && note.endsWith('）'))) {
                        noteDisplay = note;
                    } else {
                        noteDisplay = '(' + note + ')';
                    }
                }

                teachersPayload.push({
                    name: teacherName,
                    schedule_rows: scheduleRows,
                    stats_text: statsText,
                    stats_table: {
                        total: totalHours,
                        base: baseHours,
                        part_time: partTimeHours,
                        overtime: overtimeDisplay ? overtimeDisplay + ' 節' : '',
                        note: noteDisplay
                    }
                });
            });

            // 3. Generate Client-Side
            await window.generateWordTeacherScheduleJS({
                title: title,
                date_range: dateRange,
                teachers: teachersPayload
            });

        } catch (e) {
            console.error(e);
            showSnackbar('匯出失敗: ' + e.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    };

    window.exportClassroomScheduleWord = async function (targetBtn = null) {
        const btn = targetBtn || document.getElementById('btn-export-classroom-word');
        if (!btn) {
            console.error('Export button not found');
            return;
        }
        const originalText = btn.textContent;
        btn.textContent = '⏳ 處理中...';
        btn.disabled = true;

        try {
            // 1. Gather Rooms
            const rooms = new Set();
            courses.forEach(c => {
                if (c.groupDetails) {
                    Object.values(c.groupDetails).forEach(d => {
                        if (d.room) rooms.add(d.room);
                        if (d.displayRoom) rooms.add(d.displayRoom);
                    });
                }
            });
            const sortedRooms = Array.from(rooms).sort();

            const today = new Date();
            const dateCreated = `${today.getFullYear() - 1911}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')} 製`;

            const prefix = document.getElementById('title-prefix').value || '';
            const year = document.getElementById('title-year').value || '';
            const semester = document.getElementById('title-semester').value || '';
            const titlePrefix = `${prefix} ${year}學年度第${semester}學期`;

            const classroomsPayload = [];
            const weekdays = ['friday', 'thursday', 'wednesday', 'tuesday', 'monday'];
            const timeSlots = [
                { period: '1', name: '第一節', time: '08:30~09:15' },
                { period: '2', name: '第二節', time: '09:25~10:10' },
                { period: '3', name: '第三節', time: '10:20~11:05' },
                { period: '4', name: '第四節', time: '11:15~12:00' },
                { period: '5', name: '第五節', time: '13:20~14:05' },
                { period: '6', name: '第六節', time: '14:15~15:00' },
                { period: '7', name: '第七節', time: '15:20~16:05' }
            ];

            sortedRooms.forEach(room => {
                const scheduleRows = timeSlots.map(slot => {
                    const row = {
                        period: slot.period,
                        name: slot.name,
                        time: slot.time,
                        days: {},
                        time_display: `${slot.name.replace('第', '').replace('節', '')}\n${slot.time.split('~')[0]}\n|\n${slot.time.split('~')[1]}`
                    };

                    weekdays.forEach(day => {
                        const slotKey = `${day}-${slot.period}`;
                        const blocks = scheduleData[slotKey] || [];
                        const roomBlocks = [];

                        blocks.forEach(block => {
                            const course = courses.find(c => c.id === block.courseId);
                            if (!course) return;
                            course.groups.forEach(groupName => {
                                const details = course.groupDetails[groupName];
                                const effectiveRoom = details.displayRoom || details.room;
                                if (details && effectiveRoom === room) {
                                    const teacherDisplay = Array.isArray(details.teacher) ? details.teacher.join('、') : (details.teacher || '');
                                    roomBlocks.push(`${course.name}\n${teacherDisplay}\n【${room}】`);
                                }
                            });
                        });
                        row.days[day] = roomBlocks.join('\n');
                    });
                    return row;
                });
                classroomsPayload.push({ name: room, schedule_rows: scheduleRows });
            });

            // Generate Client-Side
            await window.generateWordClassroomScheduleJS({
                title_prefix: titlePrefix,
                date_created: dateCreated,
                classrooms: classroomsPayload
            });

        } catch (e) {
            console.error(e);
            showSnackbar('匯出失敗: ' + e.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    };

    window.exportStudentScheduleWord = async function (targetBtn = null) {
        const btn = targetBtn || document.getElementById('btn-export-student-word');
        // If called from master schedule, btn might be passed.
        if (!btn) {
            console.error('Export button not found');
            return;
        }

        const originalText = btn.textContent;
        btn.textContent = '⏳ 處理中...';
        btn.disabled = true;

        try {
            // 1. Title Info
            const prefix = document.getElementById('title-prefix').value || '';
            const year = document.getElementById('title-year').value || '';
            const semester = document.getElementById('title-semester').value || '';
            const semesterChinese = { '1': '一', '2': '二', '3': '三' }[semester] || semester;

            const title = `新北市立江翠國中特教班 ${year} 學年度第${semesterChinese}學期課表`;

            // 2. Filter Students
            const validStudents = students.filter(s => s && s.name);
            if (validStudents.length === 0) {
                showSnackbar('無學生資料可匯出');
                return;
            }

            // 3. Build Payload
            const timeSlots = [
                { period: '1', name: '1', time: '08:30~09:15' },
                { period: '2', name: '2', time: '09:25~10:10' },
                { period: '3', name: '3', time: '10:20~11:05' },
                { period: '4', name: '4', time: '11:15~12:00' },
                { period: '5', name: '5', time: '13:20~14:05' },
                { period: '6', name: '6', time: '14:15~15:00' },
                { period: '7', name: '7', time: '15:20~16:05' }
            ];
            // Print layout is Fri -> Mon
            const weekdaysPrint = [
                { key: 'friday', name: '五' },
                { key: 'thursday', name: '四' },
                { key: 'wednesday', name: '三' },
                { key: 'tuesday', name: '二' },
                { key: 'monday', name: '一' }
            ];

            const studentsPayload = validStudents.map(student => {
                const scheduleRows = timeSlots.map(slot => {
                    const row = {
                        period: slot.period,
                        name: slot.name,
                        time: slot.time,
                        days: {}
                    };

                    weekdaysPrint.forEach(day => {
                        const slotKey = `${day.key}-${slot.period}`;

                        // Logic derived from generateStudentSchedules
                        let manualEntry = studentManualEntries[student.id]?.[slotKey];
                        let cellContent = '';

                        if (manualEntry) {
                            if (typeof manualEntry === 'string') manualEntry = { course: manualEntry, teacher: '', room: '' };
                            // Format: Subject \n Teacher \n Room
                            cellContent = `${manualEntry.course || ''}\n${manualEntry.teacher || ''}\n${manualEntry.room || ''}`;
                        } else {
                            const blocks = scheduleData[slotKey];
                            if (blocks && Array.isArray(blocks)) {
                                for (const block of blocks) {
                                    const course = courses.find(c => c.id === block.courseId);
                                    if (!course) continue;

                                    course.groups.forEach(groupName => {
                                        // Check for override
                                        const override = slotOverrides[slotKey]?.[course.id]?.[groupName];
                                        let groupStudents = assignments[course.id]?.[groupName] || [];

                                        if (override) {
                                            if (Array.isArray(override)) {
                                                // Legacy: Absolute list
                                                groupStudents = override;
                                            } else if (override.type === 'delta') {
                                                // Delta: Apply changes
                                                // 1. Filter out removed
                                                groupStudents = groupStudents.filter(sid => !override.removed.includes(sid));
                                                // 2. Add added (avoid duplicates)
                                                override.added.forEach(sid => {
                                                    if (!groupStudents.includes(sid)) groupStudents.push(sid);
                                                });
                                            }
                                        }

                                        // Ensure it is an array
                                        if (!Array.isArray(groupStudents)) groupStudents = [];

                                        if (groupStudents.includes(student.id)) {
                                            const details = course.groupDetails[groupName];
                                            const teacherDisplay = Array.isArray(details.teacher) ? details.teacher.join('、') : (details.teacher || '');
                                            // Format: Subject \n Teacher \n Room
                                            cellContent = `${course.name}\n${teacherDisplay}\n${details.room || ''}`;
                                        }
                                    });
                                    if (cellContent) break; // Found applicable course
                                }
                            }
                        }
                        row.days[day.key] = cellContent.trim();
                    });
                    return row;
                });

                return {
                    name: student.name,
                    grade: student.grade, // Optional context
                    schedule_rows: scheduleRows
                };
            });

            // 4. Generate Client-Side
            await window.generateWordStudentScheduleJS({
                title: title,
                students: studentsPayload
            });

        } catch (e) {
            console.error(e);
            showSnackbar('匯出失敗: ' + e.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    };

    // Bind buttons
    // Bind buttons
    window.exportMasterScheduleWord = async function () {
        const btn = document.getElementById('btn-export-master-schedule-word');
        const originalText = btn.textContent;
        btn.textContent = '⏳  處理中...';
        btn.disabled = true;

        try {
            const scheduleType = document.getElementById('schedule-type-select').value;
            console.log('Exporting schedule type:', scheduleType);

            // 1. Delegate to specific functions for supported types
            if (scheduleType === 'master' || scheduleType === 'classroom_integrated') {
                // 準備數據（自輸入欄位讀取標題，與畫面顯示一致）
                const data = {
                    isClassroomIntegrated: scheduleType === 'classroom_integrated',
                    prefix: document.getElementById('title-prefix')?.value || scheduleTitle?.prefix || '',
                    year: document.getElementById('title-year')?.value || scheduleTitle?.year || '',
                    semester: document.getElementById('title-semester')?.value || scheduleTitle?.semester || '',
                    courses: courses,
                    scheduleData: scheduleData,
                    students: students,
                    assignments: assignments,
                    slotOverrides: slotOverrides,
                    timeSlots: getCommonTimeSlots(),
                    implementationDates: implementationDates,
                    madeDate: (() => {
                        const t = new Date();
                        const roc = t.getFullYear() - 1911;
                        const mm = String(t.getMonth() + 1).padStart(2, '0');
                        const dd = String(t.getDate()).padStart(2, '0');
                        return `${roc}. ${mm}. ${dd}`;
                    })()
                };

                await window.generateWordMasterScheduleJS(data);
                return;
            } else if (scheduleType === 'teacher') {
                await window.exportTeacherScheduleWord(btn);
                return;
            } else if (scheduleType === 'student') {
                await window.exportStudentScheduleWord(btn);
                return;
            } else if (scheduleType === 'classroom') {
                // 準備教室課表數據
                const data = {
                    prefix: document.getElementById('title-prefix')?.value || scheduleTitle?.prefix || '',
                    year: document.getElementById('title-year')?.value || scheduleTitle?.year || '',
                    semester: document.getElementById('title-semester')?.value || scheduleTitle?.semester || '',
                    courses: courses,
                    scheduleData: scheduleData,
                    timeSlots: getCommonTimeSlots()
                };

                await window.generateWordClassroomScheduleJS(data);
                return;
            }

            // Should not reach here if valid type selected
            console.warn('Unknown schedule type for export:', scheduleType);

        } catch (e) {
            console.error(e);
            showSnackbar('匯出失敗: ' + e.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    };

    const btnExportMasterScheduleWord = document.getElementById('btn-export-master-schedule-word');
    if (btnExportMasterScheduleWord) {
        btnExportMasterScheduleWord.addEventListener('click', window.exportMasterScheduleWord);
    }

    function getFormattedDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    // --- Update window.__TEST__ with all defined functions (for test environment) ---
    if (typeof window !== 'undefined' && window.__TEST__) {
        // Override getters with actual function references
        window.__TEST__.sanitizeScheduleData = sanitizeScheduleData;
        window.__TEST__.parseTimestamp = parseTimestamp;
        window.__TEST__.syncLocalStorage = syncLocalStorage;
        window.__TEST__.restoreData = restoreData;
        window.__TEST__.loadDataAndSync = loadDataAndSync;
        window.__TEST__.saveAllDataToServer = saveAllDataToServer;
        window.__TEST__.saveToCustomServer = saveToCustomServer;
        window.__TEST__.importDataToMemory = importDataToMemory;
        window.__TEST__.handleSaveCourse = handleSaveCourse;
        window.__TEST__.handleSaveStudent = handleSaveStudent;
        window.__TEST__.handleSaveTeacher = handleSaveTeacher;
        window.__TEST__.openAddCourseModal = openAddCourseModal;
        window.__TEST__.openAddStudentModal = openAddStudentModal;
        window.__TEST__.openAddTeacherModal = openAddTeacherModal;
        window.__TEST__.renderCourseList = renderCourseList;
        window.__TEST__.renderStudentList = renderStudentList;
        window.__TEST__.renderTeacherList = renderTeacherList;
        window.__TEST__.renderGroupingWorkspace = renderGroupingWorkspace;
        window.__TEST__.renderAllGroupsOverview = renderAllGroupsOverview;
        window.__TEST__.handleZoneDrop = handleZoneDrop;
        window.__TEST__.renderMasterSchedule = renderMasterSchedule;
        window.__TEST__.renderCourseBlocks = renderCourseBlocks;
        window.__TEST__.handleScheduleDrop = handleScheduleDrop;
        if (typeof removeCourseBlock !== 'undefined') window.__TEST__.removeCourseBlock = removeCourseBlock;
        if (typeof window.removeFromSchedule !== 'undefined') window.__TEST__.removeFromSchedule = window.removeFromSchedule;
    }
});


    async function handleLogout() {
        const confirmed = confirm('確定要登出嗎？\n\n提醒：請記得定期使用「匯出資料」功能來備份您的課表');
        if (confirmed) {
            showSnackbar('感謝使用！祝您教學順利', null, 2000);
            setTimeout(doLogout, 2000);
        }
    }
