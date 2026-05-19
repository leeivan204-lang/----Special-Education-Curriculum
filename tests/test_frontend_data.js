const fs = require('fs');
const vm = require('vm');
const path = require('path');

// --- Mock Browser Environment ---
global.window = global;

// Properly mock addEventListener to capture DOMContentLoaded callback
const eventListeners = {};
global.window.addEventListener = (event, callback) => {
    if (event === 'DOMContentLoaded') {
        global._domContentLoadedCallback = callback;
    }
    if (!eventListeners[event]) {
        eventListeners[event] = [];
    }
    eventListeners[event].push(callback);
};

global.window.location = {
    protocol: 'http:',
    hostname: 'localhost'
};
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

// Mock Elements Registry (to store elements created by createElement or retrieved by getElementById)
const elements = {};

class MockElement {
    constructor(id = '', tag = 'div') {
        this.id = id;
        this.tagName = tag.toUpperCase();
        this.value = '';
        this.textContent = '';
        this.innerHTML = '';
        this.style = { display: '' };
        this.classList = {
            add: (cls) => this.classes.add(cls),
            remove: (cls) => this.classes.delete(cls),
            contains: (cls) => this.classes.has(cls)
        };
        this.classes = new Set();
        this.children = [];
        this.attributes = {};
        this.dataset = {};
        this.eventListeners = {};
    }

    addEventListener(event, callback) {
        if (!this.eventListeners[event]) this.eventListeners[event] = [];
        this.eventListeners[event].push(callback);
    }

    removeEventListener(event, callback) {
        if (this.eventListeners[event]) {
            this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
        }
    }

    click() {
        if (this.onclick) this.onclick();
        if (this.eventListeners['click']) this.eventListeners['click'].forEach(cb => cb());
    }

    // Simulate input change
    input(val) {
        this.value = val;
        if (this.eventListeners['input']) this.eventListeners['input'].forEach(cb => cb({ target: this }));
        if (this.eventListeners['change']) this.eventListeners['change'].forEach(cb => cb({ target: this }));
    }

    querySelector(selector) {
        // Very basic selector support
        if (selector.startsWith('.')) {
            const cls = selector.substring(1);
            return this.children.find(c => c.classes.has(cls)) || null;
        }
        return null;
    }

    querySelectorAll(selector) {
        if (selector.startsWith('.')) {
            const cls = selector.substring(1);
            return this.children.filter(c => c.classes.has(cls));
        }
        return [];
    }

    appendChild(child) {
        this.children.push(child);
    }

    setAttribute(k, v) { this.attributes[k] = v; }
    getAttribute(k) { return this.attributes[k]; }

    remove() {
        // In a real DOM, this removes the element from its parent.
        // For mock, we can just clear it or do nothing if we don't track parent-child strictness
        this.innerHTML = '';
        // Optionally remove from parents children if we tracked parent
    }
}

// Mock Document
global.document = {
    addEventListener: (event, callback) => {
        if (event === 'DOMContentLoaded') global._domContentLoadedCallback = callback;
    },
    getElementById: (id) => {
        if (!elements[id]) elements[id] = new MockElement(id);
        return elements[id];
    },
    querySelector: (selector) => {
        // For testing, we might need to find specific elements if not by ID
        return new MockElement();
    },
    querySelectorAll: (selector) => {
        // Return empty for now unless specifically mocked
        if (selector === '.group-preview-item') {
            // We need to return mock elements that represent the dynamic form
            // This logic depends on what we injected into innerHTML
            // For now, let's look at a special global array we can populate in tests
            return global._mockGroupItems || [];
        }
        return [];
    },
    createElement: (tag) => new MockElement('', tag),
    body: new MockElement('body'),
    head: new MockElement('head')
};

// Mock Alert/Confirm
global.alert = (msg) => console.log(`[ALERT] ${msg}`);
global.confirm = (msg) => {
    console.log(`[CONFIRM] ${msg}`);
    return true; // Always confirm
};

// Mock URL
global.URL = { createObjectURL: () => 'blob:url', revokeObjectURL: () => { } };
global.Blob = class { };


// --- Load script.js ---
const scriptPath = path.join(__dirname, '../script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

console.log("Loading script.js...");
try {
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
    try {
        global._domContentLoadedCallback();
    } catch (e) {
        console.error("Error running DOMContentLoaded callback:", e);
        process.exit(1);
    }
} else {
    console.error("DOMContentLoaded callback not registered!");
    process.exit(1);
}

// Verify window.__TEST__ exists and has required properties
if (!global.window.__TEST__) {
    console.error("❌ window.__TEST__ not created!");
    console.error("Available on window:", Object.keys(global.window).slice(0, 10));
    process.exit(1);
}

// Test Helpers
const testExports = global.window.__TEST__;
if (!testExports.handleSaveCourse) {
    console.error("❌ handleSaveCourse not found in window.__TEST__");
    console.error("Available exports:", Object.keys(testExports).slice(0, 20));
    process.exit(1);
}

const {
    handleSaveCourse,
    handleSaveStudent,
    handleSaveTeacher,
    openAddCourseModal,
    openAddStudentModal,
    openAddTeacherModal,
    renderCourseList,
    renderStudentList,
    renderTeacherList,
    deleteCourse,
    deleteStudent,
    deleteTeacher,
    courses,
    students,
} = testExports;

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

async function runDataTests() {
    console.log("\n--- Frontend Data Management Tests ---\n");

    // DM-01: Add Standard Course
    console.log("TEST DM-01: Add Standard Course (國文)");

    // 1. Open Modal
    openAddCourseModal();

    // 2. Set Inputs
    const subjectSelect = document.getElementById('subject-select');
    subjectSelect.value = '國文';

    const groupCount = document.getElementById('group-count');
    groupCount.value = '2';

    const courseHours = document.getElementById('course-hours-input');
    courseHours.value = '4';

    // Mock the group preview items logic which read from DOM
    // In script.js handleSaveCourse uses: document.querySelectorAll('.group-preview-item')
    // We need to inject mock elements that mimic what updateGroupPreview would generate

    const groupItem1 = new MockElement();
    groupItem1.classes.add('group-preview-item');
    const nameInput1 = new MockElement(); nameInput1.classes.add('group-name-input'); nameInput1.value = '國文 A';
    const roomInput1 = new MockElement(); roomInput1.classes.add('group-room-input'); roomInput1.value = '136教室';
    const teacherInput1_1 = new MockElement(); teacherInput1_1.classes.add('group-teacher-input-1'); teacherInput1_1.value = 'TeacherA';
    const teacherInput1_2 = new MockElement(); teacherInput1_2.classes.add('group-teacher-input-2'); teacherInput1_2.value = '';

    groupItem1.children = [nameInput1, roomInput1, teacherInput1_1, teacherInput1_2];

    const groupItem2 = new MockElement();
    groupItem2.classes.add('group-preview-item');
    const nameInput2 = new MockElement(); nameInput2.classes.add('group-name-input'); nameInput2.value = '國文 B';
    const roomInput2 = new MockElement(); roomInput2.classes.add('group-room-input'); roomInput2.value = '137教室';
    const teacherInput2_1 = new MockElement(); teacherInput2_1.classes.add('group-teacher-input-1'); teacherInput2_1.value = 'TeacherB';
    const teacherInput2_2 = new MockElement(); teacherInput2_2.classes.add('group-teacher-input-2'); teacherInput2_2.value = '';

    groupItem2.children = [nameInput2, roomInput2, teacherInput2_1, teacherInput2_2];

    global._mockGroupItems = [groupItem1, groupItem2];

    // 3. Save
    handleSaveCourse();

    // 4. Verify
    const savedCourse = global.window.__TEST__.courses.find(c => c.name === '國文');
    assert(savedCourse !== undefined, 'Course "國文" should exist');
    assert(savedCourse.groups.length === 2, 'Should have 2 groups');
    assert(savedCourse.groupDetails['國文 A'].hours === '4', 'Hours should be 4');
    assert(savedCourse.groupDetails['國文 A'].teacher[0] === 'TeacherA', 'Teacher A assigned');


    // DM-02: Add Custom Course
    console.log("TEST DM-02: Add Custom Course (社交技巧)");

    openAddCourseModal();
    document.getElementById('subject-select').value = '自訂';
    document.getElementById('custom-subject-input').value = '社交技巧';
    document.getElementById('group-count').value = '1';
    document.getElementById('course-hours-input').value = '2';

    // Mock Preview Items
    const groupItemCustom = new MockElement();
    groupItemCustom.classes.add('group-preview-item');
    const nameInputCustom = new MockElement(); nameInputCustom.classes.add('group-name-input'); nameInputCustom.value = '社交技巧';
    const roomInputCustom = new MockElement(); roomInputCustom.classes.add('group-room-input'); roomInputCustom.value = '待訂';
    const teacherInputCustom = new MockElement(); teacherInputCustom.classes.add('group-teacher-input-1'); teacherInputCustom.value = 'TeacherC';
    const teacherInputCustom2 = new MockElement(); teacherInputCustom2.classes.add('group-teacher-input-2'); teacherInputCustom2.value = '';

    groupItemCustom.children = [nameInputCustom, roomInputCustom, teacherInputCustom, teacherInputCustom2];
    global._mockGroupItems = [groupItemCustom];

    handleSaveCourse();

    const customCourse = global.window.__TEST__.courses.find(c => c.name === '社交技巧');
    assert(customCourse !== undefined, 'Course "社交技巧" should exist');
    assert(customCourse.groups.length === 1, 'Should have 1 group');

    // DM-03: Edit Course
    console.log("TEST DM-03: Edit Course");
    // Edit '國文'
    global.window.editCourse(savedCourse.id); // Uses exposed window function (shimmed via openAddCourseModal)
    // Actually window.editCourse calls openAddCourseModal(course)

    // Change hours
    document.getElementById('course-hours-input').value = '5';
    // Keep groups same
    global._mockGroupItems = [groupItem1, groupItem2]; // Reuse previous mocks

    handleSaveCourse();

    const updatedCourse = global.window.__TEST__.courses.find(c => c.id === savedCourse.id);
    assert(updatedCourse.groupDetails['國文 A'].hours === '5', 'Hours updated to 5');

    // DM-04: Delete Course
    console.log("TEST DM-04: Delete Course");
    // Mock confirm done globally

    // Call delete via window global function
    if (global.window.deleteCourse) {
        // We need to shim the onclick handlers from renderCourseList
        // renderCourseList generates HTML string, it doesn't attach listeners directly.
        // But script.js defines window.deleteCourse = ... 
        // Let's call it directly.
        global.window.deleteCourse(customCourse.id);

        const deletedCourse = global.window.__TEST__.courses.find(c => c.id === customCourse.id);
        assert(deletedCourse === undefined, 'Course "社交技巧" should be deleted');
    } else {
        console.error("FAIL: window.deleteCourse not defined");
        failed++;
    }

    // DM-05: Student CRUD
    console.log("TEST DM-05: Student CRUD");

    openAddStudentModal();
    document.getElementById('student-name').value = '王小明';
    document.getElementById('student-grade').value = '8';

    handleSaveStudent();

    const student = global.window.__TEST__.students.find(s => s.name === '王小明');
    assert(student !== undefined, 'Student "王小明" added');
    assert(student.grade === '8', 'Grade is 8');

    // Delete Student
    global.window.deleteStudent(student.id);
    const deletedStudent = global.window.__TEST__.students.find(s => s.id === student.id);
    assert(deletedStudent === undefined, 'Student deleted');

    // DM-06: Teacher CRUD
    console.log("TEST DM-06: Teacher CRUD");

    // Need to initialize teachers array since it might be empty
    if (!global.window.__TEST__.teachers) global.window.__TEST__.teachers = [];

    openAddTeacherModal();
    document.getElementById('teacher-name').value = '陳老師';
    document.getElementById('teacher-base-hours').value = '16';

    handleSaveTeacher();

    const teacher = global.window.__TEST__.teachers.find(t => t.name === '陳老師'); // Accessed via internal var exposed
    // Wait, teachers variable is local to script.js closure, but exposed in __TEST__.
    // Let's check exposure:
    // get teachers() { return teachers; }
    // Yes.

    // Note: The getter returns the reference. changes should be reflected if array is modified in place.
    // script.js: teachers.push(...) -> yes.

    // Wait, I need to re-read the getter.
    // const teacher = global.window.__TEST__.teachers.find(...)
    // If global.window.__TEST__.teachers returns the array, it should be fine.

    // Let's check if my previous code has correct internal reference
    const teachersList = global.window.__TEST__.teachers || []; // Fallback
    const savedTeacher = teachersList.find(t => t.name === '陳老師');

    assert(savedTeacher !== undefined, 'Teacher "陳老師" added');
    assert(savedTeacher.baseHours === 16, 'Base hours is 16');

}

runDataTests().then(() => {
    console.log(`\nTests Completed. Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) process.exit(1);
}).catch(e => {
    console.error("UNEXPECTED ERROR:", e);
    process.exit(1);
});
