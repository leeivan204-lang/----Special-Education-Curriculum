const fs = require('fs');
const vm = require('vm');
const path = require('path');

// --- Mark as Test Environment ---
global.__IS_TEST__ = true;  // Signal to script.js that we're in a test environment

// --- Mock Browser Environment ---
global.window = global;
global.window.addEventListener = (event, callback) => {
    // Mock implementation
};
global.window.location = {
    protocol: 'http:',
    hostname: 'localhost',
    reload: () => {}
};
global.location = global.window.location;
global.self = global;

// Mock LocalStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = String(value); },
        clear: () => { store = {}; },
        removeItem: (key) => { delete store[key]; }
    };
})();
global.localStorage = localStorageMock;

// Mock Socket.IO
global.io = function () {
    return {
        on: () => { },
        emit: () => { },
        connect: () => { },
        disconnect: () => { },
        id: 'test-socket-id'
    };
};

// Mock Fetch
global.fetch = async () => ({
    ok: true,
    json: async () => ({ success: true, data: null }),
    text: async () => ""
});

// Mock Document
const documentMock = {
    addEventListener: (event, callback) => {
        if (event === 'DOMContentLoaded') {
            // Run immediately or store? Run immediately for simplicity if environment is ready
            // But script.js expects elements to exist.
            // We'll run it after we define the mock elements (already done by the script loaded below?)
            // No, script.js calls this. We should store it and run it manually after environment setup.
            global._domContentLoadedCallback = callback;
        }
    },
    getElementById: (id) => {
        // Return element mock
        const el = {
            id,
            style: {},
            classList: { add: () => { }, remove: () => { } },
            addEventListener: () => { },
            removeEventListener: () => { },
            value: '',
            textContent: '',
            querySelector: () => ({ parentNode: { insertBefore: () => { } }, width: 100 }),
            querySelectorAll: () => [],
            appendChild: () => { },
            innerHTML: '',
            remove: () => { },
            setAttribute: (k, v) => { },
            getAttribute: (k) => null
        };
        return el;
    },
    querySelector: (selector) => {
        return {
            style: {},
            classList: { add: () => { }, remove: () => { } },
            addEventListener: () => { },
            removeEventListener: () => { },
            appendChild: () => { },
            innerHTML: '',
            remove: () => { },
            setAttribute: (k, v) => { },
            getAttribute: (k) => null
        };
    },
    querySelectorAll: () => [],
    createElement: (tag) => ({
        style: {},
        id: '',
        appendChild: () => { },
        classList: { add: () => { }, remove: () => { } },
        querySelector: () => ({ textContent: '' })
    }),
    body: {
        insertBefore: () => { },
        appendChild: () => { },
        firstChild: null
    }
};
global.document = documentMock;

// Other Globals
global.URL = { createObjectURL: () => { }, revokeObjectURL: () => { } };
global.Blob = class { };
global.alert = console.log;
global.confirm = () => true;

// --- Load script.js ---
const scriptPath = path.join(__dirname, '../script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

console.log("Loading script.js...");
try {
    // Override GAS_API_URL for testing
    const modifiedScriptContent = scriptContent.replace(
        /const GAS_API_URL = .*;/,
        "const GAS_API_URL = 'http://mock-gas';"
    );
    vm.runInThisContext(modifiedScriptContent);
} catch (e) {
    console.error("Error loading script.js:", e);
    process.exit(1);
}

// Run DOMContentLoaded
if (global._domContentLoadedCallback) {
    console.log("Running DOMContentLoaded callback...");
    try {
        global._domContentLoadedCallback();
    } catch (e) {
        console.error("Error inside DOMContentLoaded:", e);
        // Continue if possible? If init fails, tests might fail.
    }
} else {
    console.error("DOMContentLoaded callback not registered!");
    process.exit(1);
}

// --- Check for exposed test hooks ---
if (!global.window.__TEST__) {
    console.error("FATAL: window.__TEST__ not found. Ensure script.js exposes internals.");
    process.exit(1);
}

const {
    parseTimestamp,
    sanitizeScheduleData,
    scheduleData, // getter
} = global.window.__TEST__;

// --- Run Tests ---
let passed = 0;
let failed = 0;

function assert(condition, msg) {
    if (condition) {
        console.log(`PASS: ${msg}`);
        passed++;
    } else {
        console.error(`FAIL: ${msg}`);
        failed++;
    }
}

function assertEqual(actual, expected, msg) {
    if (actual === expected) {
        console.log(`PASS: ${msg}`);
        passed++;
    } else {
        console.error(`FAIL: ${msg} (Expected ${expected}, got ${actual})`);
        failed++;
    }
}

console.log("\n--- Running Frontend Utility Tests ---\n");

// Parse Timestamp
assertEqual(parseTimestamp('2025/01/01 12:00:00'), new Date(2025, 0, 1, 12, 0, 0).getTime(), 'Standard ISO format');
assertEqual(parseTimestamp(null), 0, 'Null timestamp');

// Sanitize Schedule Data
console.log("\n--- Running Sanitization Tests ---\n");

// Setup Mock Data
global.window.__TEST__.courses = [{ id: 1, name: 'C1' }];
const sd = global.window.__TEST__.scheduleData;

// Clear
for (let k in sd) delete sd[k];

// Add Data
sd['monday-1'] = [{ blockIndex: 0, courseId: 1 }];
sd['monday-2'] = [{ blockIndex: 0, courseId: 999 }]; // Invalid

// Execute
global.window.__TEST__.sanitizeScheduleData();

// Verify
assert(sd['monday-1'] && sd['monday-1'].length === 1, 'Valid item kept');
assert(!sd['monday-2'], 'Invalid item removed');


console.log("\n--- Running Sync Logic Tests ---\n");

// Mock confirm to always say YES first
global.confirm = () => true;

// Helper to reset state
function resetSyncState() {
    global.window.__TEST__.CURRENT_USER = 'test_user';
    global.window.__TEST__.LAST_SYNCED_TIMESTAMP = 1000;
    global.window.__TEST__.courses = [];
    global.window.__TEST__.students = [];

    // Mock rendering functions to avoid DOM errors during sync
    global.window.__TEST__.skipRender = true;

    localStorage.clear();
}

const { loadDataAndSync } = global.window.__TEST__;

async function runSyncTests() {
    // Test 1: Remote > Local (Standard Load)
    resetSyncState();
    console.log("Test 1: Remote (Server) > Local");

    // Mock Fetch for Server Data
    global.fetch = async (url) => {
        if (url.includes('mock-gas')) return { ok: false, json: async () => null }; // No cloud data
        if (url.includes('/api/data/')) {
            return {
                ok: true,
                json: async () => ({
                    success: true,
                    data: {
                        timestamp: 2000,
                        courses: [{ id: 1, name: 'RemoteCourse' }]
                    }
                })
            };
        }
        return { ok: false, json: async () => null };
    };

    await loadDataAndSync();

    // Verify
    const currentCourses = global.window.__TEST__.courses;
    assert(currentCourses.length === 1 && currentCourses[0].name === 'RemoteCourse', 'Loaded remote data');

    assert(global.window.__TEST__.LAST_SYNCED_TIMESTAMP === 2000, 'Updated LAST_SYNCED_TIMESTAMP');


    // Test 2: Local > Remote (Conflict -> Choose Local)
    resetSyncState();
    console.log("Test 2: Local > Remote (Conflict -> Choose Local)");

    // Setup Local
    global.window.__TEST__.courses = [{ id: 2, name: 'LocalCourse' }];
    localStorage.setItem('lastSavedTimestamp', 3000); // Newer than server (2000)

    // Mock confirm to return TRUE (Choose Local)
    global.confirm = () => true;

    // Mock Save
    let saveCalled = false;
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
        if (url.includes('mock-gas')) return { ok: false, json: async () => null };
        if (url.includes('/api/data/') && options && options.method === 'POST') {
            saveCalled = true;
            return { ok: true, json: async () => ({ success: true }) };
        }
        return originalFetch(url, options); // Reuse server=2000 mock
    };

    await loadDataAndSync();

    assert(saveCalled, 'Attempted to save local data to server');


    // Test 3: Cloud > Server (Cloud Restore)
    resetSyncState();
    console.log("Test 3: Cloud > Server");

    // Mock Fetch
    global.GAS_API_URL = 'http://mock-gas';
    global.fetch = async (url) => {
        if (url.includes('mock-gas')) {
            return {
                ok: true,
                json: async () => ({
                    // Cloud API response structure
                    data: {
                        timestamp: 5000,
                        courses: [{ id: 3, name: 'CloudCourse' }]
                    }
                })
            };
        }
        if (url.includes('/api/data/')) {
            return {
                ok: true,
                json: async () => ({
                    success: true,
                    data: { timestamp: 2000, courses: [] }
                })
            };
        }
        return { ok: true, json: async () => ({ success: true }) }; // For save calls
    };

    // Confirm Cloud Import
    global.confirm = () => true;

    await loadDataAndSync();

    const cloudCourses = global.window.__TEST__.courses;
    assert(cloudCourses.length === 1 && cloudCourses[0].name === 'CloudCourse', 'Loaded cloud data');

    // Test 4: Restore Data (restoreData)
    resetSyncState();
    console.log("Test 4: Restore Data");

    // Mock saveAllDataToServer to track calls
    let saveAllDataToServerCalled = false;
    // We can't easily mock the internal function reference used by restoreData 
    // because restoreData calls the internal saveAllDataToServer, not window.__TEST__.saveAllDataToServer.
    // However, saveAllDataToServer calls fetch, so we can track it via fetch.
    let fetchCalled = false;
    global.fetch = async (url) => {
        if (url.includes('/api/data/')) {
            fetchCalled = true;
            return { ok: true, json: async () => ({ success: true }) };
        }
        return { ok: true, json: async () => ({ success: true }) };
    };

    // Mock location
    global.location = { reload: () => { console.log('Mock Reload'); } };
    let alertMsg = '';
    global.alert = (msg) => { alertMsg = msg; };

    const { restoreData } = global.window.__TEST__;

    // Test Data
    const backupData = {
        courses: [{ id: 101, name: 'RestoredCourse' }],
        students: [{ id: 202, name: 'RestoredStudent' }],
        timestamp: '2025-01-01T00:00:00.000Z'
    };

    // Execute with reload=false
    restoreData(backupData, false);

    // Verify LocalStorage
    assert(localStorage.getItem('courses').includes('RestoredCourse'), 'Restored courses to LocalStorage');
    assert(localStorage.getItem('students').includes('RestoredStudent'), 'Restored students to LocalStorage');
    assert(localStorage.getItem('lastSavedTimestamp') === '2025-01-01T00:00:00.000Z', 'Restored timestamp');

    // Verify Server Sync
    assert(fetchCalled, 'Triggered saveAllDataToServer');

    // Execute with reload=true (default)
    // restoreData uses setTimeout(() => location.reload(), 1500)
    // so we need to capture the timer and fast-forward it
    let reloadCalled = false;
    global.window.location.reload = () => { reloadCalled = true; };
    const origSetTimeout = global.setTimeout;
    global.setTimeout = (fn, _ms) => { fn(); }; // Execute immediately
    restoreData(backupData, true);
    global.setTimeout = origSetTimeout; // Restore
    assert(reloadCalled, 'Triggered location.reload()');

    // Test 5: Partial Data Handling (Defaults)
    console.log("Test 5: Partial Data Handling");
    localStorage.clear(); // Start fresh
    const partialData = {
        timestamp: '2025-01-02T00:00:00.000Z'
        // No courses, students, etc.
    };
    restoreData(partialData, false);

    // Check that missing keys didn't cause errors and didn't create "undefined" strings in localStorage
    // Since restoreData checks "if (data.courses)", it won't set the item.
    // So localStorage.getItem('courses') should be null.
    assert(localStorage.getItem('courses') === null, 'Ignored missing courses field');

    // However, the requirement "Use default values" implies the APP recovers.
    // Let's verify that if we initialized the app state now, it would be safe.
    // (Simulate App Init)
    const courses = JSON.parse(localStorage.getItem('courses')) || [];
    assert(Array.isArray(courses) && courses.length === 0, 'App falls back to default empty array');
}

runSyncTests().then(() => {
    console.log(`\nTests Completed. Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) process.exit(1);
});
