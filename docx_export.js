
// ==========================================
// Client-Side Word Export Functions (docx.js)
// ==========================================

const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, VerticalAlign, HeightRule, HeadingLevel, BorderStyle, PageOrientation } = docx;

// Helper: 1cm = 567 twips (approx), 1pt = 20 twips
const CM_TO_TWIP = 567;
const PT_TO_TWIP = 20;

// Helper to create a cell with centered text
function createCenteredCell(text, widthTwips, options = {}) {
    const fontSize = options.fontSize || 12; // pt
    const bold = options.bold || false;
    const verticalAlign = options.verticalAlign || VerticalAlign.CENTER;
    const rowSpan = options.rowSpan || 1;
    const colSpan = options.colSpan || 1;
    const fontName = options.fontName || "標楷體";

    // Handle newlines
    const lines = text.toString().split('\n');
    const runs = [];
    lines.forEach((line, index) => {
        runs.push(new TextRun({
            text: line,
            font: fontName,
            size: fontSize * 2, // docx uses half-points
            bold: bold,
        }));
        if (index < lines.length - 1) {
            runs.push(new TextRun({ text: "", break: 1 }));
        }
    });

    return new TableCell({
        width: { size: widthTwips, type: WidthType.DXA }, // DXA = Twips
        verticalAlign: verticalAlign,
        rowSpan: rowSpan,
        columnSpan: colSpan,
        children: [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: runs
            })
        ],
        ...options.cellOptions
    });
}

// 1. Generate Simple Schedule Word
window.generateWordScheduleJS = async function (data) {
    const titleText = data.title || '特教班課表';
    const dateRange = data.date_range || '';
    const scheduleRows = data.schedule || [];

    const tableRows = [];

    // Calculated Widths (Total ~18.5cm)
    // Fri-Mon (5 cols): 2.9cm * 5 = 14.5cm
    // Time: 2.5cm
    // Section: 1.5cm
    const colWidths = [
        Math.round(2.9 * CM_TO_TWIP),
        Math.round(2.9 * CM_TO_TWIP),
        Math.round(2.9 * CM_TO_TWIP),
        Math.round(2.9 * CM_TO_TWIP),
        Math.round(2.9 * CM_TO_TWIP),
        Math.round(2.5 * CM_TO_TWIP),
        Math.round(1.5 * CM_TO_TWIP)
    ];

    // Header Row
    tableRows.push(new TableRow({
        children: [
            createCenteredCell("星期五", colWidths[0], { bold: true, fontSize: 12 }),
            createCenteredCell("星期四", colWidths[1], { bold: true, fontSize: 12 }),
            createCenteredCell("星期三", colWidths[2], { bold: true, fontSize: 12 }),
            createCenteredCell("星期二", colWidths[3], { bold: true, fontSize: 12 }),
            createCenteredCell("星期一", colWidths[4], { bold: true, fontSize: 12 }),
            createCenteredCell("時間", colWidths[5], { bold: true, fontSize: 12 }),
            createCenteredCell("節次", colWidths[6], { bold: true, fontSize: 12 }),
        ]
    }));

    // Data Rows
    scheduleRows.forEach(row => {
        const height = row.isLunch ? 700 : 800; // twips

        const trChildren = [];

        if (row.isLunch) {
            // Lunch: Merge first 5 cells
            const mergeWidth = colWidths.slice(0, 5).reduce((a, b) => a + b, 0);
            trChildren.push(createCenteredCell("午休", mergeWidth, { colSpan: 5, fontSize: 14 }));
            trChildren.push(createCenteredCell("12:30\n|\n13:10", colWidths[5], { fontSize: 12 })); // App used 12/14 mixed? Python says 14 for Lunch text, Time cell standard.
            trChildren.push(createCenteredCell("", colWidths[6], { fontSize: 12 }));
        } else {
            // Standard
            const dayMap = ['friday', 'thursday', 'wednesday', 'tuesday', 'monday'];
            dayMap.forEach((dayKey, idx) => {
                let content = row.days[dayKey] || '';
                content = content.replace(/<br>/g, '\n').replace(/&nbsp;/g, ' ');
                trChildren.push(createCenteredCell(content, colWidths[idx], { fontSize: 12 }));
            });

            // Time
            const timeStr = (row.time || '').replace('~', '\n|\n');
            trChildren.push(createCenteredCell(timeStr, colWidths[5], { fontSize: 12 }));

            // Section
            trChildren.push(createCenteredCell(row.name || '', colWidths[6], { fontSize: 12 }));
        }

        tableRows.push(new TableRow({
            height: { value: height, rule: HeightRule.AT_LEAST },
            children: trChildren
        }));
    });

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: Math.round(1.27 * CM_TO_TWIP),
                        bottom: Math.round(1.27 * CM_TO_TWIP),
                        left: Math.round(1.27 * CM_TO_TWIP),
                        right: Math.round(1.27 * CM_TO_TWIP),
                    }
                }
            },
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    heading: HeadingLevel.TITLE,
                    children: [
                        new TextRun({
                            text: titleText,
                            font: "標楷體",
                            size: 40, // 20pt
                            bold: true
                        })
                    ]
                }),
                new Paragraph({ text: "" }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: tableRows
                }),
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 240 }, // 12pt
                    children: [new TextRun({ text: dateRange ? `實施日期 ${dateRange}` : '', font: "Times New Roman", size: 24 })]
                })
            ]
        }]
    });

    const buffer = await Packer.toBlob(doc);
    saveAs(buffer, `${titleText}.docx`);
};

// 2. Generate Teacher Schedule Word (Multi-page)
window.generateWordTeacherScheduleJS = async function (data) {
    const teachersData = data.teachers || [];
    const children = [];

    // Widths
    // Days: 3.1cm
    // Time/Per: 1.5cm
    const colWidths = [
        Math.round(3.1 * CM_TO_TWIP),
        Math.round(3.1 * CM_TO_TWIP),
        Math.round(3.1 * CM_TO_TWIP),
        Math.round(3.1 * CM_TO_TWIP),
        Math.round(3.1 * CM_TO_TWIP),
        Math.round(1.5 * CM_TO_TWIP),
        Math.round(1.5 * CM_TO_TWIP)
    ];

    teachersData.forEach((teacher, index) => {
        // Page Break
        if (index > 0) {
            children.push(new Paragraph({
                children: [],
                pageBreakBefore: true
            }));
        }

        // Title
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({
                    text: data.title || '特教班教師課表',
                    font: "標楷體",
                    size: 40,
                    bold: true
                })
            ]
        }));

        // Teacher Name
        children.push(new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 240, after: 240 }, // Add spacing
            children: [new TextRun({ text: `任課教師：${teacher.name} 老師`, font: "標楷體", size: 28 })] // 14pt = 28
        }));

        // Table
        const tableRows = [];
        // Header
        tableRows.push(new TableRow({
            children: [
                createCenteredCell("星期五", colWidths[0], { bold: true, fontSize: 12 }),
                createCenteredCell("星期四", colWidths[1], { bold: true, fontSize: 12 }),
                createCenteredCell("星期三", colWidths[2], { bold: true, fontSize: 12 }),
                createCenteredCell("星期二", colWidths[3], { bold: true, fontSize: 12 }),
                createCenteredCell("星期一", colWidths[4], { bold: true, fontSize: 12 }),
                createCenteredCell("時間", colWidths[5], { bold: true, fontSize: 12 }),
                createCenteredCell("節次", colWidths[6], { bold: true, fontSize: 12 }),
            ]
        }));

        teacher.schedule_rows.forEach(row => {
            const height = row.isLunch ? 700 : 850;
            const trChildren = [];

            if (row.isLunch) {
                const mergeWidth = colWidths.slice(0, 5).reduce((a, b) => a + b, 0);
                trChildren.push(createCenteredCell("午休", mergeWidth, { colSpan: 5, fontSize: 14 }));
                trChildren.push(createCenteredCell("12:30\n|\n13:10", colWidths[5], { fontSize: 12 }));
                trChildren.push(createCenteredCell("", colWidths[6], { fontSize: 12 }));
            } else {
                const dayMap = ['friday', 'thursday', 'wednesday', 'tuesday', 'monday'];
                dayMap.forEach((dayKey, idx) => {
                    let content = row.days[dayKey] || '';
                    content = content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
                    // New requirement: Wrap (兼)
                    content = content.replace(/\(兼\)/g, '\n(兼)');

                    trChildren.push(createCenteredCell(content, colWidths[idx], { fontSize: 12 }));
                });
                const timeStr = (row.time || '').replace('~', '\n|\n');
                trChildren.push(createCenteredCell(timeStr, colWidths[5], { fontSize: 12 }));
                trChildren.push(createCenteredCell(row.name || '', colWidths[6], { fontSize: 12 }));
            }

            tableRows.push(new TableRow({
                height: { value: height, rule: HeightRule.AT_LEAST },
                children: trChildren
            }));
        });

        children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows
        }));

        // Footer Date
        if (data.date_range) {
            children.push(new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 120, after: 240 }, // 6pt before, 12pt after
                children: [new TextRun({ text: `實施日期 ${data.date_range}`, font: "Times New Roman", size: 24 })]
            }));
        }

        // Stats Text
        if (teacher.stats_text) {
            children.push(new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { after: 240 }, // 12pt after
                children: [new TextRun({ text: teacher.stats_text, font: "標楷體", size: 24 })]
            }));
        }

        // Stats Table
        if (teacher.stats_table) {
            const stats = teacher.stats_table;

            // Stats Table: 4 columns, equal width
            // Total width ~18.46cm. Each col ~4.615cm -> ~2616 Twips
            const colWidth = 2616;

            // Build Base Hours Cell Content
            const baseRuns = [
                new TextRun({ text: `基本鐘點：${stats.base} 節`, font: "標楷體", size: 24, bold: false })
            ];
            if (stats.note) {
                baseRuns.push(new TextRun({ text: "", break: 1 }));
                baseRuns.push(new TextRun({ text: stats.note, font: "標楷體", size: 24, bold: false }));
            }

            const baseCell = new TableCell({
                width: { size: colWidth, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER, // Changed to CENTER
                        children: baseRuns
                    })
                ]
            });

            const statsRow = new TableRow({
                children: [
                    createCenteredCell(`總時數：${stats.total} 節`, colWidth, { fontSize: 12 }),
                    baseCell,
                    createCenteredCell(`兼課：${stats.part_time} 節`, colWidth, { fontSize: 12 }),
                    createCenteredCell(`超鐘點：${stats.overtime}`, colWidth, { fontSize: 12 }),
                ]
            });
            children.push(new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [statsRow]
            }));
        }
    });

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: Math.round(1.27 * CM_TO_TWIP),
                        bottom: Math.round(1.27 * CM_TO_TWIP),
                        left: Math.round(1.27 * CM_TO_TWIP),
                        right: Math.round(1.27 * CM_TO_TWIP),
                    }
                }
            },
            children: children
        }]
    });

    const buffer = await Packer.toBlob(doc);
    saveAs(buffer, `${data.title || 'teachers_schedule'}.docx`);
};

// 3. Generate Student Schedule
window.generateWordStudentScheduleJS = async function (data) {
    const studentsData = data.students || [];
    const children = [];

    // Widths matches Teacher: Days 3.1cm, Time 1.5cm, Per 1.5cm
    const colWidths = [
        Math.round(3.1 * CM_TO_TWIP),
        Math.round(3.1 * CM_TO_TWIP),
        Math.round(3.1 * CM_TO_TWIP),
        Math.round(3.1 * CM_TO_TWIP),
        Math.round(3.1 * CM_TO_TWIP),
        Math.round(1.5 * CM_TO_TWIP),
        Math.round(1.5 * CM_TO_TWIP)
    ];

    studentsData.forEach((student, index) => {
        if (index > 0) {
            children.push(new Paragraph({
                children: [],
                pageBreakBefore: true
            }));
        }

        // Title
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({
                    text: data.title || '學生課表',
                    font: "標楷體",
                    size: 40,
                    bold: true
                })
            ]
        }));

        // Student Name
        children.push(new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: student.name, font: "標楷體", size: 28, bold: true })] // 14pt
        }));

        // Table
        const tableRows = [];
        // Header
        tableRows.push(new TableRow({
            children: [
                createCenteredCell("星期五", colWidths[0], { bold: true, fontSize: 12 }),
                createCenteredCell("星期四", colWidths[1], { bold: true, fontSize: 12 }),
                createCenteredCell("星期三", colWidths[2], { bold: true, fontSize: 12 }),
                createCenteredCell("星期二", colWidths[3], { bold: true, fontSize: 12 }),
                createCenteredCell("星期一", colWidths[4], { bold: true, fontSize: 12 }),
                createCenteredCell("時間", colWidths[5], { bold: true, fontSize: 12 }),
                createCenteredCell("節次", colWidths[6], { bold: true, fontSize: 12 }),
            ]
        }));

        student.schedule_rows.forEach(row => {
            const height = 1300; // Consistent height ~2.3cm
            const trChildren = [];

            // Days
            const dayMap = ['friday', 'thursday', 'wednesday', 'tuesday', 'monday'];
            dayMap.forEach((dayKey, idx) => {
                let content = row.days[dayKey] || '';
                // Split content
                const parts = content.split('\n');

                const paras = [];
                // 1. Subject (16pt Bold)
                if (parts.length > 0 && parts[0].trim()) {
                    paras.push(new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: parts[0].trim(), font: "標楷體", size: 32, bold: true })]
                    }));
                }
                // 2. Teacher (10pt)
                if (parts.length > 1 && parts[1].trim()) {
                    paras.push(new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: parts[1].trim(), font: "標楷體", size: 20 })]
                    }));
                }
                // 3. Room (10pt)
                if (parts.length > 2 && parts[2].trim()) {
                    paras.push(new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: parts[2].trim(), font: "標楷體", size: 20 })]
                    }));
                }

                if (paras.length === 0) paras.push(new Paragraph(""));

                trChildren.push(new TableCell({
                    width: { size: colWidths[idx], type: WidthType.DXA },
                    verticalAlign: VerticalAlign.CENTER,
                    children: paras
                }));
            });

            // Time
            const timeStr = (row.time || '');
            let timeCellChildren = [];
            if (timeStr.includes('~')) {
                const tParts = timeStr.split('~');
                timeCellChildren = [
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tParts[0], font: "Times New Roman", size: 22 })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "|", font: "Times New Roman", size: 22 })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tParts[1], font: "Times New Roman", size: 22 })] })
                ];
            } else {
                timeCellChildren = [
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: timeStr, font: "Times New Roman", size: 22 })] })
                ];
            }
            trChildren.push(new TableCell({
                width: { size: colWidths[5], type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                children: timeCellChildren
            }));

            // Section
            trChildren.push(createCenteredCell(row.name || '', colWidths[6], { fontSize: 12 }));

            tableRows.push(new TableRow({
                height: { value: height, rule: HeightRule.AT_LEAST },
                children: trChildren
            }));
        });

        children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows
        }));
    });

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: Math.round(1.27 * CM_TO_TWIP),
                        bottom: Math.round(1.27 * CM_TO_TWIP),
                        left: Math.round(1.27 * CM_TO_TWIP),
                        right: Math.round(1.27 * CM_TO_TWIP),
                    }
                }
            },
            children: children
        }]
    });

    const buffer = await Packer.toBlob(doc);
    saveAs(buffer, `${data.title || 'student_schedules'}.docx`);
};

// 4. Generate Classroom Schedule
window.generateWordClassroomScheduleJS = async function (data) {
    const classroomsData = data.classrooms || [];

    // Using similar layout to Teacher schedule
    const colWidths = [
        Math.round(1.5 * CM_TO_TWIP), // Time/Sec
        Math.round(3.1 * CM_TO_TWIP), // Mon
        Math.round(3.1 * CM_TO_TWIP), // Tue
        Math.round(3.1 * CM_TO_TWIP), // Wed
        Math.round(3.1 * CM_TO_TWIP), // Thu
        Math.round(3.1 * CM_TO_TWIP), // Fri
    ];
    // Note: Classroom export is usually Time first, then Mon-Fri

    const doc = new Document({
        sections: classroomsData.map(room => ({
            properties: {
                page: {
                    margin: {
                        top: Math.round(1.27 * CM_TO_TWIP),
                        bottom: Math.round(1.27 * CM_TO_TWIP),
                        left: Math.round(1.27 * CM_TO_TWIP),
                        right: Math.round(1.27 * CM_TO_TWIP),
                    }
                }
            },
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({
                            text: `${data.title_prefix} ${room.name} 課表`,
                            font: "標楷體",
                            size: 40,
                            bold: true
                        })
                    ]
                }),
                new Paragraph({
                    text: `製表日期: ${data.date_created}`,
                    alignment: AlignmentType.RIGHT,
                    run: { font: "標楷體", size: 24 }
                }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                createCenteredCell("節次/時間", colWidths[0], { bold: true, fontSize: 12 }),
                                createCenteredCell("星期一", colWidths[1], { bold: true, fontSize: 12 }),
                                createCenteredCell("星期二", colWidths[2], { bold: true, fontSize: 12 }),
                                createCenteredCell("星期三", colWidths[3], { bold: true, fontSize: 12 }),
                                createCenteredCell("星期四", colWidths[4], { bold: true, fontSize: 12 }),
                                createCenteredCell("星期五", colWidths[5], { bold: true, fontSize: 12 }),
                            ]
                        }),
                        ...room.schedule_rows.map(row => new TableRow({
                            height: { value: 800, rule: HeightRule.AT_LEAST },
                            children: [
                                createCenteredCell(row.time_display, colWidths[0], { fontSize: 12 }),
                                createCenteredCell(row.days['monday'] || '', colWidths[1], { fontSize: 12 }),
                                createCenteredCell(row.days['tuesday'] || '', colWidths[2], { fontSize: 12 }),
                                createCenteredCell(row.days['wednesday'] || '', colWidths[3], { fontSize: 12 }),
                                createCenteredCell(row.days['thursday'] || '', colWidths[4], { fontSize: 12 }),
                                createCenteredCell(row.days['friday'] || '', colWidths[5], { fontSize: 12 }),
                            ]
                        }))
                    ]
                })
            ]
        }))
    });

    const buffer = await Packer.toBlob(doc);
    saveAs(buffer, `classrooms_schedule.docx`);
};

// 生成總課表 / 教室統整課表 Word 匯出
// 版面對照 script.js 列印版 (renderMasterSchedule 的 tbodyPrint)：
//   - 橫向 A4；星期欄反序 (星期五→星期一)，節次/時間欄置於最右
//   - 同一格多個分組排成 2 欄網格；單一分組跨滿整格
//   - 每個分組區塊：課程名+分組 → 教師 → 【教室】 → 學生 (逐行，含年級)
// 資料模型與 renderMasterSchedule() 一致：
//   scheduleData: { '{day}-{period}': [{ courseId }, ...] }  (扁平物件)
//   course: { id, name, groups: [名稱字串], groupDetails: { [名稱]: { teacher: [], room, displayRoom } } }
//   assignments: { [courseId]: { [分組名稱]: [studentId, ...] } }
//   slotOverrides: { [slotKey]: { [courseId]: { [分組名稱]: delta | 陣列 } } }
window.generateWordMasterScheduleJS = async function (data) {
    const isClassroomIntegrated = !!data.isClassroomIntegrated;
    const prefix = data.prefix || '';
    const year = data.year || '';
    const semester = data.semester || '';
    const courses = data.courses || [];
    const scheduleData = data.scheduleData || {};
    const students = data.students || [];
    const assignments = data.assignments || {};
    const slotOverrides = data.slotOverrides || {};
    const implementationDates = data.implementationDates || {};

    const titleSuffix = isClassroomIntegrated ? '教室統整課表' : '總課表';
    const titleText = `${prefix} ${year} 學年度第 ${semester} 學期 ${titleSuffix}`.trim();

    // 時段定義（與 getCommonTimeSlots 一致，含早自習與中午特殊時段）
    const timeSlots = data.timeSlots || [
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

    // 星期反序 (星期五 → 星期一)，節次欄在最右
    const daysReversed = [
        { key: 'friday', name: '星期五' },
        { key: 'thursday', name: '星期四' },
        { key: 'wednesday', name: '星期三' },
        { key: 'tuesday', name: '星期二' },
        { key: 'monday', name: '星期一' }
    ];

    // 列寬 (橫向 A4，可用寬度約 27cm)
    const dayWidth = Math.round(4.9 * CM_TO_TWIP);
    const periodWidth = Math.round(2.0 * CM_TO_TWIP);

    // --- 小工具 ---
    const P = (text, opts = {}) => new Paragraph({
        alignment: opts.align || AlignmentType.CENTER,
        spacing: { after: 0, line: 240, ...(opts.spacing || {}) },
        children: [new TextRun({
            text: String(text),
            font: opts.font || "標楷體",
            size: (opts.size || 10) * 2,
            bold: !!opts.bold
        })]
    });

    // 第一節 → 第 1 節
    const toArabicPeriod = (name) => {
        const map = { '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9', '十': '10' };
        const core = String(name).replace('第', '').replace('節', '');
        return `第 ${map[core] || core} 節`;
    };

    // 套用 override 後的學生名單
    const getGroupStudents = (slotKey, courseId, groupName) => {
        let groupStudents = (assignments[courseId] && assignments[courseId][groupName]) || [];
        const override = slotOverrides[slotKey] && slotOverrides[slotKey][courseId] && slotOverrides[slotKey][courseId][groupName];
        if (override) {
            if (Array.isArray(override)) {
                groupStudents = override;
            } else if (override.type === 'delta') {
                groupStudents = groupStudents.filter(sid => !(override.removed || []).includes(sid));
                (override.added || []).forEach(sid => {
                    if (!groupStudents.includes(sid)) groupStudents.push(sid);
                });
            }
        }
        return groupStudents;
    };

    // 取得某時段的分組清單 (依課程與分組定義順序，即 A、B、C、D)
    const getRenderItems = (slotKey) => {
        const blocks = scheduleData[slotKey];
        const items = [];
        if (blocks && Array.isArray(blocks)) {
            blocks.forEach(block => {
                const course = courses.find(c => c.id === block.courseId);
                if (course && Array.isArray(course.groups)) {
                    course.groups.forEach(groupName => items.push({ course, groupName }));
                }
            });
        }
        return items;
    };

    // 單一分組區塊 → Paragraph 陣列
    // twoColStudents: 學生是否兩人一行 (單一分組跨滿整格時使用)
    const groupBlockParagraphs = (slotKey, course, groupName, twoColStudents) => {
        const details = (course.groupDetails && course.groupDetails[groupName]) || {};

        // 教師 (、連接)
        const teacherData = details.teacher;
        let teacherDisplay = '未排';
        if (Array.isArray(teacherData)) {
            teacherDisplay = teacherData.filter(t => t && t !== '').join('、') || '未排';
        } else if (teacherData) {
            teacherDisplay = teacherData;
        }

        const headerName = (groupName === course.name) ? course.name : `${course.name} ${groupName}`;
        const paras = [
            P(headerName, { size: 11, bold: true }),
            P(teacherDisplay, { size: 9 }),
            P(`【${details.room || '待訂'}】`, { size: 9 })
        ];

        if (!isClassroomIntegrated) {
            const names = getGroupStudents(slotKey, course.id, groupName).map(sid => {
                const s = students.find(st => st.id === sid);
                return s ? `${s.grade} ${s.name}` : '';
            }).filter(Boolean);

            if (twoColStudents) {
                // 兩人一行 (以全形空格分隔)，貼近附檔寬區塊的雙欄排列
                for (let i = 0; i < names.length; i += 2) {
                    const pair = names.slice(i, i + 2).join('　　');
                    paras.push(P(pair, { size: 10 }));
                }
            } else {
                names.forEach(n => paras.push(P(n, { size: 10 })));
            }
        }
        return paras;
    };

    // 框線樣式：實線 = 日/節邊界；虛線 = 同一格內分組分隔
    const solidBorder = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
    const dashBorder = { style: BorderStyle.DASHED, size: 4, color: "808080" };
    const dashParaBorder = { style: BorderStyle.DASHED, size: 4, color: "808080", space: 1 };
    const subWidth = Math.round(dayWidth / 2);

    // 將多個分組區塊垂直堆疊於同一欄，區塊間以虛線橫隔
    const stackBlocks = (slotKey, blockItems) => {
        const out = [];
        blockItems.forEach((it, idx) => {
            const paras = groupBlockParagraphs(slotKey, it.course, it.groupName, false);
            out.push(...paras);
            if (idx < blockItems.length - 1) {
                // 區塊間的虛線橫隔
                out.push(new Paragraph({
                    spacing: { before: 40, after: 40 },
                    border: { bottom: dashParaBorder },
                    children: [new TextRun({ text: '' })]
                }));
            }
        });
        return out;
    };

    // 一個星期欄 → TableCell 陣列 (主表格中該日佔兩個實體欄)
    //   由右到左：A(第1組) 在右欄，B(第2組) 在左欄，C、D 依序往下堆疊
    const buildDayCells = (slotKey) => {
        const items = getRenderItems(slotKey);
        const allSolid = { top: solidBorder, bottom: solidBorder, left: solidBorder, right: solidBorder };

        // 無課程：空白格跨兩欄
        if (items.length === 0) {
            return [new TableCell({
                columnSpan: 2,
                width: { size: dayWidth, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                borders: allSolid,
                children: [P('', { size: 10 })]
            })];
        }

        // 單一分組：跨滿兩欄，學生兩人一行
        if (items.length === 1) {
            const { course, groupName } = items[0];
            return [new TableCell({
                columnSpan: 2,
                width: { size: dayWidth, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                borders: allSolid,
                children: groupBlockParagraphs(slotKey, course, groupName, true)
            })];
        }

        // 多個分組：右欄放 A、C、E (偶數索引)，左欄放 B、D (奇數索引)
        const rightItems = items.filter((_, i) => i % 2 === 0);
        const leftItems = items.filter((_, i) => i % 2 === 1);

        const leftCell = new TableCell({
            width: { size: subWidth, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            margins: { top: 20, bottom: 20, left: 20, right: 20 },
            borders: { top: solidBorder, bottom: solidBorder, left: solidBorder, right: dashBorder },
            children: leftItems.length ? stackBlocks(slotKey, leftItems) : [P('', { size: 10 })]
        });
        const rightCell = new TableCell({
            width: { size: subWidth, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            margins: { top: 20, bottom: 20, left: 20, right: 20 },
            borders: { top: solidBorder, bottom: solidBorder, left: dashBorder, right: solidBorder },
            children: stackBlocks(slotKey, rightItems)
        });

        // 主表格由左至右：左欄(B、D) 在前，右欄(A、C) 在後
        return [leftCell, rightCell];
    };

    // --- 主課表 ---
    const tableRows = [];

    // 標題列：星期五 ... 星期一 (各跨兩欄) + (節次欄留白)
    tableRows.push(new TableRow({
        tableHeader: true,
        children: [
            ...daysReversed.map(d => createCenteredCell(d.name, dayWidth, { bold: true, fontSize: 14, colSpan: 2 })),
            createCenteredCell('', periodWidth, { bold: true, fontSize: 12 })
        ]
    }));

    // 每節一列
    timeSlots.forEach(slot => {
        if (slot.isSpecial) {
            // 特殊時段（早自習、中午）：所有星期欄 (10 個實體欄) 合併為灰底提示，節次欄顯示名稱與時間
            const mergeWidth = dayWidth * 5;
            const mergedCell = new TableCell({
                width: { size: mergeWidth, type: WidthType.DXA },
                columnSpan: 10,
                verticalAlign: VerticalAlign.CENTER,
                shading: { fill: "F2F2F2" },
                children: [P(`${slot.name}時段`, { size: 11, font: "標楷體" })]
            });

            const specialPeriodParas = [P(slot.name, { size: 11, bold: true })];
            if (slot.time) {
                specialPeriodParas.push(P(String(slot.time).replace('~', '～').replace(/:/g, '：'), { size: 9 }));
            }
            const specialPeriodCell = new TableCell({
                width: { size: periodWidth, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                children: specialPeriodParas
            });

            tableRows.push(new TableRow({
                height: { value: 500, rule: HeightRule.AT_LEAST },
                children: [mergedCell, specialPeriodCell]
            }));
            return;
        }

        // 每日產生 1~2 個實體欄
        const dayCells = daysReversed.reduce((acc, d) => acc.concat(buildDayCells(`${d.key}-${slot.period}`)), []);

        // 節次/時間欄 (最右)：第 N 節 / 起 / / / 迄
        const periodParas = [P(toArabicPeriod(slot.name), { size: 11, bold: true })];
        if (slot.time) {
            const [start, end] = String(slot.time).split('~');
            if (start) periodParas.push(P(start.replace(':', '：'), { size: 10 }));
            if (end) {
                periodParas.push(P('/', { size: 10 }));
                periodParas.push(P(end.replace(':', '：'), { size: 10 }));
            }
        }
        const periodCell = new TableCell({
            width: { size: periodWidth, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: periodParas
        });

        tableRows.push(new TableRow({
            children: [...dayCells, periodCell]
        }));
    });

    // --- 文件主體 ---
    const today = data.madeDate || '';
    const docChildren = [];

    // 右上角製表日期
    if (today) {
        docChildren.push(new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 60 },
            children: [new TextRun({ text: `${today} 表`, font: "標楷體", size: 20 })]
        }));
    }

    docChildren.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [new TextRun({ text: titleText, font: "標楷體", size: 32, bold: true })]
        }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [
                subWidth, subWidth, subWidth, subWidth, subWidth,
                subWidth, subWidth, subWidth, subWidth, subWidth,
                periodWidth
            ],
            borders: {
                top: solidBorder, bottom: solidBorder, left: solidBorder, right: solidBorder,
                insideHorizontal: solidBorder, insideVertical: solidBorder
            },
            rows: tableRows
        })
    );

    // 實施日期
    const startDate = implementationDates.startDate || implementationDates.start || '';
    const endDate = implementationDates.endDate || implementationDates.end || '';
    const dateRange = (startDate && endDate) ? `${startDate} ～ ${endDate}` : '';
    if (dateRange) {
        docChildren.push(new Paragraph({
            spacing: { before: 180, after: 60 },
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: `實施日期 ${dateRange}`, font: "Times New Roman", size: 22 })]
        }));
    }

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    size: { orientation: PageOrientation.LANDSCAPE },
                    margin: {
                        top: Math.round(1.0 * CM_TO_TWIP),
                        bottom: Math.round(1.0 * CM_TO_TWIP),
                        left: Math.round(1.0 * CM_TO_TWIP),
                        right: Math.round(1.0 * CM_TO_TWIP),
                    }
                }
            },
            children: docChildren
        }]
    });

    const buffer = await Packer.toBlob(doc);
    saveAs(buffer, `${titleText}.docx`);
};

// 生成教室課表 Word 匯出（按教室分組）
window.generateWordClassroomScheduleJS = async function (data) {
    const titlePrefix = data.prefix || '';
    const year = data.year || new Date().getFullYear();
    const semester = data.semester || '第一學期';
    const courses = data.courses || [];
    const scheduleData = data.scheduleData || {};
    const timeSlots = data.timeSlots || [];

    // 列寬設定 (星期五到星期一 + 時間 + 節次)
    const colWidths = [
        Math.round(2.5 * CM_TO_TWIP),  // 星期五
        Math.round(2.5 * CM_TO_TWIP),  // 星期四
        Math.round(2.5 * CM_TO_TWIP),  // 星期三
        Math.round(2.5 * CM_TO_TWIP),  // 星期二
        Math.round(2.5 * CM_TO_TWIP),  // 星期一
        Math.round(2.0 * CM_TO_TWIP)   // 時間/節次
    ];

    // 收集所有唯一的教室
    const rooms = new Set();
    courses.forEach(c => {
        if (c.groupDetails) {
            Object.values(c.groupDetails).forEach(d => {
                const effectiveRoom = d.displayRoom || d.room;
                if (effectiveRoom) rooms.add(effectiveRoom);
            });
        }
    });

    if (rooms.size === 0) {
        showSnackbar('尚無教室資料');
        return;
    }

    const sortedRooms = Array.from(rooms).sort();
    const weekdaysKeys = ['friday', 'thursday', 'wednesday', 'tuesday', 'monday'];
    const weekdaysNames = ['星期五', '星期四', '星期三', '星期二', '星期一'];

    // 為每個教室生成一頁文件
    const sections = [];

    sortedRooms.forEach((room, roomIndex) => {
        const tableRows = [];

        // 表格標題行
        tableRows.push(new TableRow({
            children: [
                createCenteredCell("星期五", colWidths[0], { bold: true, fontSize: 12 }),
                createCenteredCell("星期四", colWidths[1], { bold: true, fontSize: 12 }),
                createCenteredCell("星期三", colWidths[2], { bold: true, fontSize: 12 }),
                createCenteredCell("星期二", colWidths[3], { bold: true, fontSize: 12 }),
                createCenteredCell("星期一", colWidths[4], { bold: true, fontSize: 12 }),
                createCenteredCell("時間/節次", colWidths[5], { bold: true, fontSize: 11 }),
            ]
        }));

        // 處理每個時間段
        timeSlots.forEach(slot => {
            if (slot.isSpecial) return; // 跳過特殊時段（早自習、午休）

            const trChildren = [];

            // 星期五到星期一（逆序）
            weekdaysKeys.forEach((dayKey, dayIdx) => {
                const slotKey = `${dayKey}-${slot.period}`;
                const blocks = scheduleData[slotKey] || [];
                let cellContent = '';

                if (Array.isArray(blocks)) {
                    const roomBlocks = [];
                    blocks.forEach(block => {
                        const course = courses.find(c => c.id === block.courseId);
                        if (!course) return;

                        course.groups.forEach(groupName => {
                            const details = course.groupDetails[groupName];
                            if (!details) return;

                            const effectiveRoom = details.displayRoom || details.room;
                            if (effectiveRoom === room) {
                                const courseName = course.name || '';
                                const teacherName = Array.isArray(details.teacher)
                                    ? details.teacher.join('、')
                                    : (details.teacher || '');

                                roomBlocks.push(`${courseName}\n${teacherName}`);
                            }
                        });
                    });
                    cellContent = roomBlocks.join('\n---\n');
                }

                trChildren.push(createCenteredCell(cellContent, colWidths[dayIdx], { fontSize: 11 }));
            });

            // 時間/節次
            const sectionNum = slot.name.replace('第', '').replace('節', '');
            const timeStr = slot.time ? slot.time.replace('~', '\n|\n') : '';
            const timeCell = `第${sectionNum}節\n${timeStr}`;
            trChildren.push(createCenteredCell(timeCell, colWidths[5], { fontSize: 10 }));

            tableRows.push(new TableRow({
                height: { value: 800, rule: HeightRule.AT_LEAST },
                children: trChildren
            }));
        });

        // 為每個教室創建一個章節
        const roomTitle = `${titlePrefix} ${year} 學年度第 ${semester} 學期 ${room} 課表`;
        const pageBreak = roomIndex > 0 ? [new Paragraph({ pageBreakBefore: true })] : [];

        sections.push(...pageBreak);
        sections.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                heading: HeadingLevel.TITLE,
                children: [
                    new TextRun({
                        text: roomTitle,
                        font: "標楷體",
                        size: 36,
                        bold: true
                    })
                ]
            }),
            new Paragraph({ text: "" }),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: tableRows
            })
        );
    });

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: Math.round(1.27 * CM_TO_TWIP),
                        bottom: Math.round(1.27 * CM_TO_TWIP),
                        left: Math.round(1.27 * CM_TO_TWIP),
                        right: Math.round(1.27 * CM_TO_TWIP),
                    }
                }
            },
            children: sections
        }]
    });

    const buffer = await Packer.toBlob(doc);
    saveAs(buffer, `${titlePrefix || '教室課表'}.docx`);
};
