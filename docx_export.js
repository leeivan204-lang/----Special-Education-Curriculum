
// ==========================================
// Client-Side Word Export Functions (docx.js)
// ==========================================

const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, VerticalAlign, HeightRule, HeadingLevel, BorderStyle } = docx;

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
            children: [new TextRun({ text: `任課教師：${teacher.name} 老師`, font: "標楷體", size: 32 })] // 16pt
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
                spacing: { before: 120 }, // 6pt
                children: [new TextRun({ text: `實施日期 ${data.date_range}`, font: "Times New Roman", size: 24 })]
            }));
        }

        // Stats Text
        if (teacher.stats_text) {
            children.push(new Paragraph({
                alignment: AlignmentType.LEFT,
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
                        alignment: AlignmentType.LEFT,
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
