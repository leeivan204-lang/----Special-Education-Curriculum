document.addEventListener('DOMContentLoaded', () => {
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

    // --- Login & State ---
    let CURRENT_USER = null;
    const API_BASE = 'http://localhost:3000/api';

    // UI Elements for Login
    const loginSection = document.getElementById('login-section');
    const mainAppSection = document.getElementById('main-app-section');
    const loginBtn = document.getElementById('btn-login');
    const registerBtn = document.getElementById('btn-register');
    const loginInput = document.getElementById('login-id');
    const loginMessage = document.getElementById('login-message');

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

    function resetState() {
        console.log('Resetting state for new user...');
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
        localStorage.clear();
    }

    async function handleLogin() {
        const userId = loginInput.value.trim();
        if (!userId) {
            showLoginError('請輸入 User ID');
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = '登入中...';
        showLoginError(''); // Clear error

        try {
            // 1. Authenticate
            const loginResp = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            const loginResult = await loginResp.json();

            if (!loginResult.success) {
                throw new Error(loginResult.message || '登入失敗');
            }

            CURRENT_USER = userId;

            // 2. Load Data
            await loadDataAndSync();

            // 3. Enter App
            loginSection.classList.add('hidden'); // Add helper class if needed, or inline
            loginSection.style.display = 'none';
            mainAppSection.style.display = 'flex';

            // 4. Force Re-render
            refreshAllViews();

        } catch (err) {
            console.error(err);
            // If connection fails, assume offline mode (GitHub Pages or local without server)
            console.warn('Connection failed, switching to Offline Mode');

            // Proceed as logged in (Offline)
            CURRENT_USER = userId;

            // Load local data only
            // We can just call loadDataAndSync(), its catch block will handle fetch failure 
            // but we need it to NOT throw so we can proceed.
            // Actually, loadDataAndSync already catches errors and falls back to local.
            await loadDataAndSync();

            // Enter App
            loginSection.classList.add('hidden');
            loginSection.style.display = 'none';
            mainAppSection.style.display = 'flex';

            // Force Re-render
            refreshAllViews();

            // Notify user
            // Optional: alert('以此 ID 進入離線模式 (Offline Mode)');
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = '登入';
        }
    }

    function showLoginError(msg) {
        if (loginMessage) loginMessage.textContent = msg;
    }

    async function loadDataAndSync() {
        try {
            const resp = await fetch(`${API_BASE}/data/${encodeURIComponent(CURRENT_USER)}`);
            const result = await resp.json();

            if (result.success && result.data) {
                // Server has data -> Overwrite local memory & localStorage
                console.log('Syncing data from server...');
                importDataToMemory(result.data);
            } else {
                // No server data -> First time?
                // Check if we have local data. If yes, migrate it to server.
                console.log('No server data found. Checking local data...');
                if (courses.length > 0 || students.length > 0) {
                    // Local data found. Ask user what to do.
                    const userWantsToImport = confirm(
                        `系統偵測到此裝置上有尚未清除的暫存資料。\n\n` +
                        `ID "${CURRENT_USER}" 目前是沒資料的全新帳號。\n\n` +
                        `請問您想要將目前的暫存資料匯入到這個新帳號嗎？\n` +
                        `[確定] 匯入目前的資料 (例如剛離線編輯過)\n` +
                        `[取消] 建立全新的空白課表 (清除舊資料)`
                    );

                    if (userWantsToImport) {
                        console.log('User chose to import local data. Migrating to server...');
                        await saveAllDataToServer();
                    } else {
                        console.log('User chose fresh start. Resetting state...');
                        resetState();
                        // Save the empty state to server so next time it's not "No server data"
                        await saveAllDataToServer();
                        // Force UI refresh after reset
                        refreshAllViews();
                    }
                } else {
                    // Brand new user, empty start
                    console.log('No local data. Starting fresh.');
                    // Save empty state to initialize the file on server
                    await saveAllDataToServer();
                }
            }
        } catch (err) {
            console.warn('Data sync failed (Offline Mode active):', err);

            // Try enabling cloud sync from Google Sheets if server unavailable
            try {
                if (GAS_API_URL) {
                    console.log('Attempting to fetch data from Google Sheets...');
                    // Appending a query parameter to avoid caching and if the script uses it
                    const gasResp = await fetch(`${GAS_API_URL}?userId=${encodeURIComponent(CURRENT_USER)}`);
                    const gasResult = await gasResp.json();
                    if (gasResult && (gasResult.courses || gasResult.data)) {
                        const finalData = gasResult.data || gasResult;
                        console.log('Data loaded from Google Sheets');
                        importDataToMemory(finalData);
                        return;
                    }
                }
            } catch (cloudErr) {
                console.warn('Google Sheets sync failed:', cloudErr);
            }
            // Fallback to local data (already loaded in variables below)

            // If we have absolutely no data (fresh offline load), try PORTABLE_DATA from data.js
            // [Modified] Disable auto-loading of Spe for u default data for new users
            // if (courses.length === 0 && students.length === 0 && typeof window.PORTABLE_DATA !== 'undefined') {
            //     console.log('Loading portable data (Spe for u default)...');
            //     importDataToMemory(window.PORTABLE_DATA);
            // }
        }
    }

    async function saveAllDataToServer() {
        if (!CURRENT_USER) return;
        const data = getFullDataSnapshot();
        try {
            await fetch(`${API_BASE}/data/${encodeURIComponent(CURRENT_USER)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            console.log('Data saved to server successfully.');
        } catch (err) {
            console.error('Failed to save to server:', err);
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
        restoreData(data, false); // false = do not reload page
    }

    function refreshAllViews() {
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

    // --- State Management ---
    let courses = JSON.parse(localStorage.getItem('courses')) || [];
    let students = JSON.parse(localStorage.getItem('students')) || [];
    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    let assignments = JSON.parse(localStorage.getItem('assignments')) || {}; // { courseId: { groupName: [studentId, ...] } }
    let scheduleData = JSON.parse(localStorage.getItem('scheduleData')) || {}; // { 'monday-1': { courseId, groupName, blockIndex }, ... }
    let teacherPartTimeMarks = JSON.parse(localStorage.getItem('teacherPartTimeMarks')) || {}; // { teacherName: { 'monday-1': true, ... } }
    let scheduleTitle = JSON.parse(localStorage.getItem('scheduleTitle')) || {
        prefix: '',
        year: '',
        semester: '',
        suffix: ''
    };
    let implementationDates = JSON.parse(localStorage.getItem('implementationDates')) || {
        startDate: '',
        endDate: ''
    };
    let studentManualEntries = JSON.parse(localStorage.getItem('studentManualEntries')) || {}; // { studentId: { 'monday-1': 'text', ... } }
    let slotOverrides = JSON.parse(localStorage.getItem('slotOverrides')) || {}; // { slotKey: { courseId: { groupName: [studentId, ...] } } }
    const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbyWP67hqVEzOagyk7JQgSJ2Ogaj8ZZrfoB2ZvA1Az_mYfXpfAv-iuA2QN8RKjJ4oxiS/exec';

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
            localStorage.setItem('scheduleData', JSON.stringify(scheduleData));
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
                    localStorage.setItem('scheduleTitle', JSON.stringify(scheduleTitle));
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
                localStorage.setItem('implementationDates', JSON.stringify(implementationDates));
                saveAllDataToServer();
            });
        }

        if (endDateInput) {
            endDateInput.value = implementationDates.endDate;
            endDateInput.addEventListener('input', (e) => {
                implementationDates.endDate = e.target.value;
                localStorage.setItem('implementationDates', JSON.stringify(implementationDates));
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

    // Add Teacher Button
    if (btnAddTeacher) {
        btnAddTeacher.addEventListener('click', () => {
            openAddTeacherModal();
        });
    }

    // Grouping Course Select
    let currentGroupingCourseId = null; // Track currently selected course
    const btnClearAssignments = document.getElementById('btn-clear-assignments');

    if (groupingCourseSelect) {
        groupingCourseSelect.addEventListener('change', (e) => {
            const courseId = e.target.value;
            currentGroupingCourseId = courseId ? parseInt(courseId) : null;

            if (courseId) {
                // Hide overview, show single course workspace
                document.getElementById('all-groups-overview').style.display = 'none';
                groupingEmptyState.style.display = 'none';
                renderGroupingWorkspace(parseInt(courseId));

                // Show clear button
                if (btnClearAssignments) {
                    btnClearAssignments.style.display = 'flex';
                }
            } else {
                groupingWorkspace.style.display = 'none';
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
                    localStorage.setItem('assignments', JSON.stringify(assignments));
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

    // New: Cloud Backup (Google Sheets)
    const btnCloudBackup = document.getElementById('btn-cloud-backup');
    // UI elements for GAS URL have been removed


    if (btnCloudBackup) {
        btnCloudBackup.addEventListener('click', async () => {
            if (!GAS_API_URL) {
                alert('系統未設定 Google Apps Script 網址，請聯繫管理員！');
                return;
            }

            if (!confirm('確定要將目前資料備份到 Google Sheet 嗎？')) return;

            btnCloudBackup.disabled = true;
            btnCloudBackup.textContent = '備份中...';

            try {
                const data = getFullDataSnapshot();
                data.userId = CURRENT_USER; // Use consistent key 'userId'

                // Using standard POST. Script should handle doGet/doPost.
                // Assuming the script returns JSON response. 
                // Using no-cors might prevent reading response, trying standard first.
                // If CORS issue, user might need to deploy GAS as "Anyone".

                await fetch(GAS_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS often likes text/plain to avoid preflight
                    body: JSON.stringify(data)
                });

                alert('備份請求已發送至 Google Cloud！');

            } catch (err) {
                console.error(err);
                alert('備份發送失敗，請檢查網路或 CORS 設定：' + err.message);
            } finally {
                btnCloudBackup.disabled = false;
                btnCloudBackup.textContent = '備份至 Google Cloud'; // Reset text
                btnCloudBackup.innerHTML = '<span class="icon">☁️</span><span>備份至 Google Cloud</span>';
            }
        });
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

            alert('攜帶檔 (data.js) 已建立！\n請將此檔案儲存在與 index.html 同一個資料夾內。\n若要移至其他電腦，請複製整個資料夾。');
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
                        restoreData(data);
                    }
                } catch (err) {
                    alert('還原失敗：檔案格式錯誤\n請確認您選擇的是正確的 .json 備份檔或 data.js 攜帶檔。');
                    console.error(err);
                }
                fileRestoreData.value = ''; // Reset
            };
            reader.readAsText(file);
        });
    }

    // 4. Auto-Import from data.js (Portable Mode)
    if (window.portableData) {
        console.log('Portable data detected:', window.portableData);

        const localTimestampStr = localStorage.getItem('lastSavedTimestamp');
        const portableTimestampStr = window.portableData.timestamp;

        // Has local data?
        const hasLocalData = localStorage.getItem('courses') && JSON.parse(localStorage.getItem('courses')).length > 0;

        if (!hasLocalData) {
            console.log('No local data found. Auto-importing portable data...');
            restoreData(window.portableData, false);
            // Reload to ensure all variables are initialized correctly with new data
            location.reload();
        } else {
            // Compare timestamps
            if (localTimestampStr === portableTimestampStr) {
                console.log('Portable data matches local data. Skipping import.');
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
    function getFullDataSnapshot() {
        return {
            timestamp: new Date().toISOString(),
            courses: JSON.parse(localStorage.getItem('courses') || '[]'),
            teachers: JSON.parse(localStorage.getItem('teachers') || '[]'),
            students: JSON.parse(localStorage.getItem('students') || '[]'),
            scheduleData: JSON.parse(localStorage.getItem('scheduleData') || '{}'),
            assignments: JSON.parse(localStorage.getItem('assignments') || '{}'),
            implementationDates: JSON.parse(localStorage.getItem('implementationDates') || '{}'),
            teacherPartTimeMarks: JSON.parse(localStorage.getItem('teacherPartTimeMarks') || '{}'),
            studentManualEntries: JSON.parse(localStorage.getItem('studentManualEntries') || '{}'),
            slotOverrides: JSON.parse(localStorage.getItem('slotOverrides') || '{}'),
            scheduleTitle: JSON.parse(localStorage.getItem('scheduleTitle') || '{}')
        };
    }

    // Helper: Timestamp String
    function getTimestampStr() {
        return new Date().toISOString().slice(0, 10).replace(/-/g, '');
    }

    // Helper: Restore Data
    function restoreData(data, reload = true) {
        if (data.courses) localStorage.setItem('courses', JSON.stringify(data.courses));
        if (data.teachers) localStorage.setItem('teachers', JSON.stringify(data.teachers));
        if (data.students) localStorage.setItem('students', JSON.stringify(data.students));
        if (data.scheduleData) localStorage.setItem('scheduleData', JSON.stringify(data.scheduleData));
        if (data.assignments) localStorage.setItem('assignments', JSON.stringify(data.assignments));
        if (data.implementationDates) localStorage.setItem('implementationDates', JSON.stringify(data.implementationDates));
        if (data.teacherPartTimeMarks) localStorage.setItem('teacherPartTimeMarks', JSON.stringify(data.teacherPartTimeMarks));
        if (data.studentManualEntries) localStorage.setItem('studentManualEntries', JSON.stringify(data.studentManualEntries));
        if (data.slotOverrides) localStorage.setItem('slotOverrides', JSON.stringify(data.slotOverrides));
        if (data.scheduleTitle) localStorage.setItem('scheduleTitle', JSON.stringify(data.scheduleTitle));
        // Note: We don't restore gasWebAppUrl from backup file, it's a local setting.

        localStorage.setItem('lastSavedTimestamp', data.timestamp || new Date().toISOString());

        // Sync restored data to server
        saveAllDataToServer();

        if (reload) {
            alert('資料載入成功！網頁將自動重新整理。');
            location.reload();
        }
    }

    // --- Course Functions ---

    let editingCourseId = null; // Track if we are editing a course

    function openAddCourseModal(courseToEdit = null) {
        editingCourseId = courseToEdit ? courseToEdit.id : null;
        modalTitle.textContent = courseToEdit ? '編輯課程' : '新增課程';

        // Generate teacher options
        const teacherOptions = teachers.map(t => `<option value="${t.name}">${t.name}</option>`).join('');

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
        modal.style.display = 'block';
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
        const subjectSelect = document.getElementById('subject-select');
        const customInput = document.getElementById('custom-subject-input');

        let subjectName = subjectSelect.value;
        if (subjectName === '自訂') {
            subjectName = customInput.value.trim();
            if (!subjectName) {
                alert('請輸入課程名稱！');
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
        localStorage.setItem('courses', JSON.stringify(courses));
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

        if (courses.length === 0) {
            courseListContainer.innerHTML = '<div class="empty-state">尚未新增任何課程</div>';
            return;
        }

        courseListContainer.innerHTML = courses.map(course => {
            // Get hours from first group (assuming shared)
            const firstGroup = course.groups[0];
            const hours = course.groupDetails && course.groupDetails[firstGroup] ? course.groupDetails[firstGroup].hours : '0';

            return `
            <div class="course-item-card">
                <div class="course-item-header">
                    <div class="course-item-title">${course.name} <span style="font-size: 0.8rem; color: #666; font-weight: normal;">(${hours} 節)</span></div>
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
                    teacherDisplay = teacherData.filter(t => t && t !== '').join(', ') || '未排';
                } else if (teacherData) {
                    teacherDisplay = teacherData;
                }
                return `
                            <div class="group-tag-container" style="display: flex; flex-direction: column; gap: 2px; align-items: flex-start;">
                                <span class="group-tag">${g}</span>
                                <div style="font-size: 0.8rem; color: #666; display: flex; gap: 5px;">
                                    <span>👨‍🏫 ${teacherDisplay}</span>
                                    <span>🏠 ${room}</span>
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>
            </div>
            `;
        }).join('');
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
        modal.style.display = 'block';
    }

    function handleSaveStudent() {
        const nameInput = document.getElementById('student-name');
        const gradeInput = document.getElementById('student-grade');

        const name = nameInput.value.trim();
        if (!name) {
            alert('請輸入學生姓名！');
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
        localStorage.setItem('students', JSON.stringify(students));
        saveAllDataToServer();
    }

    function renderStudentList() {
        if (!studentListContainer) return;

        if (students.length === 0) {
            studentListContainer.innerHTML = '<div class="empty-state">尚未新增任何學生</div>';
            return;
        }

        // Sort by grade (9 -> 7) then name
        const sortedStudents = [...students].sort((a, b) => {
            if (b.grade !== a.grade) return b.grade - a.grade;
            return a.name.localeCompare(b.name);
        });

        studentListContainer.innerHTML = sortedStudents.map(student => `
            <div class="student-card">
                <div class="student-info">
                    <span class="student-grade" onclick="toggleGrade(event, ${student.id})" style="cursor: pointer;" title="點擊切換年級">${student.grade}</span>
                    ${student.name}
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
                <input type="text" id="teacher-name" class="form-control" placeholder="請輸入姓名" value="${teacherToEdit ? teacherToEdit.name : ''}">
            </div>
            <div class="form-group">
                <label>基本鐘點</label>
                <input type="number" id="teacher-base-hours" class="form-control" placeholder="請輸入基本鐘點" min="0" value="${teacherToEdit ? teacherToEdit.baseHours || 0 : ''}">
            </div>
        `;

        modalConfirm.onclick = handleSaveTeacher;
        modal.style.display = 'block';
    }

    function handleSaveTeacher() {
        const nameInput = document.getElementById('teacher-name');
        const name = nameInput.value.trim();

        if (!name) {
            alert('請輸入教師姓名！');
            return;
        }

        const baseHours = parseInt(document.getElementById('teacher-base-hours').value) || 0;

        if (editingTeacherId) {
            // Edit existing teacher
            const index = teachers.findIndex(t => t.id === editingTeacherId);
            if (index !== -1) {
                teachers[index].name = name;
                teachers[index].baseHours = baseHours;
            }
        } else {
            // Add new teacher
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
        localStorage.setItem('teachers', JSON.stringify(teachers));
        saveAllDataToServer();
    }

    function renderTeacherList() {
        if (!teacherListContainer) return;

        if (teachers.length === 0) {
            teacherListContainer.innerHTML = '<div class="empty-state">尚未新增任何教師</div>';
            return;
        }

        teacherListContainer.innerHTML = teachers.map(teacher => `
            <div class="teacher-card">
                <div class="teacher-info">
                    <div class="teacher-icon">T</div>
                    ${teacher.name}
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
        if (confirm('確定要刪除這位教師嗎？')) {
            teachers = teachers.filter(t => t.id !== id);
            saveTeachers();
            renderTeacherList();
        }
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

        groupingWorkspace.style.display = 'flex';
        groupingEmptyState.style.display = 'none';

        // Initialize assignments for this course if not exists OR if structure is invalid
        if (!assignments[courseId]) {
            console.log('Initializing new assignments for course:', courseId);
            assignments[courseId] = {};
            course.groups.forEach(g => assignments[courseId][g] = []);
            localStorage.setItem('assignments', JSON.stringify(assignments));
        } else {
            // Validate existing structure and clean up if needed
            let needsCleanup = false;

            // 1. Check for missing or invalid groups from course definition
            course.groups.forEach(g => {
                if (!assignments[courseId][g]) {
                    console.log('Missing group in assignments:', g);
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
                console.log('Cleaned up assignments structure');
                localStorage.setItem('assignments', JSON.stringify(assignments));
            }
        }
        // Render Group Columns
        groupsColumnsContainer.innerHTML = course.groups.map(groupName => `
            <div class="group-column">
                <div class="group-column-header">${groupName}</div>
                <div class="group-drop-zone" data-group="${groupName}">
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
        return assignedIds.map(studentId => {
            const student = students.find(s => s.id === studentId);
            if (!student) return ''; // Student might have been deleted
            return createDraggableStudentHTML(student);
        }).join('');
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
                <span class="student-grade" onclick="toggleGrade(event, ${student.id})" style="cursor: pointer;" title="點擊切換年級">${student.grade}</span>
                ${student.name}
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
                    <div class="overview-course-title">${course.name}</div>
                    <div class="overview-groups-grid">
            `;

            course.groups.forEach(groupName => {
                const studentIds = courseAssignments[groupName] || [];
                const groupStudents = studentIds.map(id => students.find(s => s.id === id)).filter(s => s);

                // Sort by grade
                groupStudents.sort((a, b) => b.grade - a.grade);

                html += `
                    <div class="overview-group-card">
                        <div class="overview-group-name">${groupName}</div>
                        <div class="overview-students-list">
                `;

                if (groupStudents.length === 0) {
                    html += '<div class="overview-empty-group">尚未分配學生</div>';
                } else {
                    groupStudents.forEach(student => {
                        html += `
                            <div class="overview-student-item">
                                <span class="student-grade">${student.grade}</span>
                                ${student.name}
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

        const studentId = parseInt(e.dataTransfer.getData('text/plain'));
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
        localStorage.setItem('assignments', JSON.stringify(assignments));
        saveAllDataToServer();
        renderGroupingWorkspace(courseId);
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
        const studentId = parseInt(e.dataTransfer.getData('text/plain'));
        const courseId = parseInt(groupingCourseSelect.value);

        // Remove from groups
        const courseAssignments = assignments[courseId];
        Object.keys(courseAssignments).forEach(group => {
            courseAssignments[group] = courseAssignments[group].filter(id => id !== studentId);
        });

        localStorage.setItem('assignments', JSON.stringify(assignments));
        saveAllDataToServer();
        renderGroupingWorkspace(courseId);
        renderMasterSchedule();
    });

    function closeModal() {
        modal.style.display = 'none';
        modalConfirm.onclick = null;
    }

    // Global Helpers
    window.toggleGrade = function (event, id) {
        event.stopPropagation(); // Prevent drag start or other clicks
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
        if (confirm('確定要刪除這個課程嗎？')) {
            courses = courses.filter(c => c.id !== id);
            // Also clean up assignments
            delete assignments[id];
            localStorage.setItem('assignments', JSON.stringify(assignments));
            saveAllDataToServer();
            saveCourses();
            renderCourseList();
            updateGroupingCourseSelect();
            renderMasterSchedule();
        }
    };

    window.deleteStudent = function (id) {
        if (confirm('確定要刪除這位學生嗎？')) {
            students = students.filter(s => s.id !== id);
            // Clean up assignments
            Object.keys(assignments).forEach(cId => {
                Object.keys(assignments[cId]).forEach(gName => {
                    assignments[cId][gName] = assignments[cId][gName].filter(sId => sId !== id);
                });
            });
            localStorage.setItem('assignments', JSON.stringify(assignments));
            saveAllDataToServer();
            saveStudents();
            renderStudentList();
            // If currently viewing a course, refresh the workspace
            if (groupingCourseSelect.value) {
                renderGroupingWorkspace(parseInt(groupingCourseSelect.value));
            }
        }
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
                     data-course-name="${course.name}"
                     style="opacity: ${opacity}">
                    <div class="course-block-header">${course.name}</div>
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
                let slotHtml = '';
                slotItems.forEach((item, index) => {
                    const course = courses.find(c => c.id === item.courseId);
                    if (course) {
                        slotHtml += `
                            <div class="course-card draggable" 
                                 draggable="true"
                                 data-slot-key="${slotKey}"
                                 data-item-index="${index}">
                                <button class="btn-remove" onclick="removeFromSchedule('${slotKey}', ${index})">✖</button>
                                <div class="course-subject">${course.name}</div>
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

            if (!isReordering && scheduleData[slotKey].length >= 2) {
                alert('該時段已滿，無法再加入課程！');
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
            localStorage.setItem('scheduleData', JSON.stringify(scheduleData));
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

            localStorage.setItem('scheduleData', JSON.stringify(scheduleData));
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
                            teacherDisplay = teacherData.filter(t => t && t !== '').join('<br>') || '未排';
                        } else if (teacherData) {
                            teacherDisplay = teacherData;
                        }

                        // 如果只有一個區塊，讓它跨兩欄
                        const isSingleBlock = totalItems === 1;
                        const spanClass = isSingleBlock ? 'span-2' : '';

                        // 整合模式：若群組名稱與課程名稱相同，則不顯示群組名稱
                        const displayGroupName = groupName === course.name ? '' : `<span style="font-size:0.8em">${groupName}</span>`;

                        if (isClassroomIntegrated) {
                            // Classroom Integrated Mode: Show only course, teacher, room
                            html += `
                                        <div class="master-group-block classroom-integrated ${spanClass}">
                                            <div class="master-group-header">${course.name} ${displayGroupName}</div>
                                            <div class="master-group-info-vertical">
                                                <div class="master-info-row">👨‍🏫 ${teacherDisplay}</div>
                                                <div class="master-info-row">🏠 ${details.room || '待訂'}</div>
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
                                groupStudents = override;
                            }

                            const studentNames = groupStudents.map(studentId => {
                                const student = students.find(s => s.id === studentId);
                                return student ? `${student.grade} ${student.name}` : '';
                            }).filter(name => name);

                            const isOverridden = !!override;
                            const blockId = `block-${slotKey}-${course.id}-${groupName}`;

                            // 若群組名稱與課程名稱相同，則不顯示群組名稱
                            const displayGroupName = groupName === course.name ? '' : `<span style="font-size:0.8em">${groupName}</span>`;

                            html += `
                                        <div class="master-group-block ${spanClass}" id="${blockId}">
                                            <div class="master-group-header">
                                                ${course.name} ${displayGroupName}
                                                <span class="btn-edit-override ${isOverridden ? 'active' : ''}" 
                                                      onclick="openStudentOverrideModal('${slotKey}', ${course.id}, '${groupName}')"
                                                      title="編輯此時段學生名單">✎</span>
                                            </div>
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
                                    groupStudents = override;
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
                                    const overrideStudents = slotOverrides[slotKey]?.[course.id]?.[groupName];
                                    const groupStudents = overrideStudents || assignments[course.id]?.[groupName] || [];

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
                    const overrideStudents = slotOverrides[slotKey]?.[course.id]?.[groupName];
                    const groupStudents = overrideStudents || assignments[course.id]?.[groupName] || [];

                    if (groupStudents.includes(student.id)) {
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
        modal.style.display = 'block';
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

        localStorage.setItem('studentManualEntries', JSON.stringify(studentManualEntries));
        generateStudentSchedules();
        closeModal();
    };

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
        localStorage.setItem('teacherPartTimeMarks', JSON.stringify(teacherPartTimeMarks));

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

    // --- Student Override Functions ---

    window.openStudentOverrideModal = function (slotKey, courseId, groupName) {
        const course = courses.find(c => c.id === courseId);
        if (!course) return;

        // Get current students for this block (override or global)
        const globalStudents = assignments[courseId]?.[groupName] || [];
        const overrideStudents = slotOverrides[slotKey]?.[courseId]?.[groupName];
        const currentStudentIds = overrideStudents || globalStudents;
        const isOverridden = !!overrideStudents;

        modalTitle.textContent = `編輯名單: ${course.name} ${groupName}`;

        // Generate student checkboxes
        // Sort students by grade then name
        const sortedStudents = [...students].sort((a, b) => {
            if (b.grade !== a.grade) return b.grade - a.grade;
            return a.name.localeCompare(b.name);
        });

        // Split students by grade for better UI
        const studentsByGrade = { 7: [], 8: [], 9: [] };
        sortedStudents.forEach(s => {
            if (studentsByGrade[s.grade]) studentsByGrade[s.grade].push(s);
        });

        let studentListHTML = '';
        [9, 8, 7].forEach(grade => {
            if (studentsByGrade[grade].length > 0) {
                studentListHTML += `<div class="grade-section"><h4>${grade} 年級</h4><div class="student-checkbox-grid">`;
                studentsByGrade[grade].forEach(student => {
                    const isChecked = currentStudentIds.includes(student.id);
                    studentListHTML += `
                        <label class="student-checkbox-item ${isChecked ? 'checked' : ''}">
                            <input type="checkbox" value="${student.id}" ${isChecked ? 'checked' : ''}>
                            <span class="student-grade-badge">${student.grade}</span>
                            ${student.name}
                        </label>
                    `;
                });
                studentListHTML += `</div></div>`;
            }
        });

        modalBody.innerHTML = `
            <div class="override-info">
                <p>正在編輯 <strong>${groupName}</strong> 在此時段的學生名單。</p>
                ${isOverridden ? '<p class="override-status active">⚠️ 此時段目前使用自訂名單</p>' : '<p class="override-status">目前使用全域預設名單</p>'}
            </div>
            <div class="student-selector-container">
                ${studentListHTML}
            </div>
            <div class="override-actions" style="margin-top: 1rem; display: flex; justify-content: space-between;">
                 <button class="btn-secondary" onclick="resetStudentOverride('${slotKey}', ${courseId}, '${groupName}')">重置為預設名單</button>
            </div>
        `;

        // Add event listeners to checkboxes to toggle styling
        setTimeout(() => {
            const checkboxes = modalBody.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                cb.addEventListener('change', (e) => {
                    if (e.target.checked) e.target.closest('label').classList.add('checked');
                    else e.target.closest('label').classList.remove('checked');
                });
            });
        }, 0);

        modalConfirm.onclick = () => saveStudentOverride(slotKey, courseId, groupName);
        modal.style.display = 'block';
    };

    window.saveStudentOverride = function (slotKey, courseId, groupName) {
        const checkboxes = modalBody.querySelectorAll('input[type="checkbox"]:checked');
        const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

        if (!slotOverrides[slotKey]) slotOverrides[slotKey] = {};
        if (!slotOverrides[slotKey][courseId]) slotOverrides[slotKey][courseId] = {};

        slotOverrides[slotKey][courseId][groupName] = selectedIds;

        localStorage.setItem('slotOverrides', JSON.stringify(slotOverrides));
        renderMasterSchedule();
        closeModal();
    };

    window.resetStudentOverride = function (slotKey, courseId, groupName) {
        if (confirm('確定要重置為預設名單嗎？此時段的特殊設定將被移除。')) {
            if (slotOverrides[slotKey] && slotOverrides[slotKey][courseId]) {
                delete slotOverrides[slotKey][courseId][groupName];
                // Clean up empty objects
                if (Object.keys(slotOverrides[slotKey][courseId]).length === 0) delete slotOverrides[slotKey][courseId];
                if (Object.keys(slotOverrides[slotKey]).length === 0) delete slotOverrides[slotKey];

                localStorage.setItem('slotOverrides', JSON.stringify(slotOverrides));
                renderMasterSchedule();
                closeModal();
            }
        }
    };



    function getFormattedDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }
});

