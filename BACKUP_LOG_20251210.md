# Backup Log - 2025-12-10

**Backup ID:** `20251210_final`
**Reason:** Full system backup after fixing student schedule print layout (font sizes, column order, visibility).

## Backed Up Files
The following files have been backed up to the project root directory:

| Original File | Backup Filename | Description |
| :--- | :--- | :--- |
| `index.html` | `index.html.bak.20251210_final` | Main HTML structure. |
| `script.js` | `script.js.bak.20251210_final` | Application logic (schedule generation, PDF export). |
| `index.css` | `index.css.bak.20251210_final` | Styling (including print layout fixes). |

## Recent Changes Included
1.  **Student Schedule Print Layout**:
    -   **Header Font Sizes**: Adjusted to 32px (Weekdays) and 26px (Time) for optimal readability.
    -   **Column Order**: Fixed Friday -> Monday ordering.
    -   **Edit Hint**: Correctly displayed on screen but hidden in print.
    -   **Styling**: High-specificity CSS overrides added to ensure print settings apply.

## Restoration Instructions
Refer to `RESTORE_GUIDE.md` for detailed instructions on how to restore these files.

***

**Backup ID:** `20251210_0110`
**Reason:** Comprehensive backup after implementing "Master Schedule Student Override" feature (Per-block customization).

## Backed Up Files

| Original File | Backup Filename | Description |
| :--- | :--- | :--- |
| `index.html` | `index.html.bak.20251210_0110` | Main HTML structure. |
| `script.js` | `script.js.bak.20251210_0110` | Logic including new `slotOverrides` feature and data structure. |
| `index.css` | `index.css.bak.20251210_0110` | Styling including new Override Edit UI (`.btn-edit-override`). |

## Recent Changes Included
1.  **Master Schedule Student Override**:
    -   Added ability to customize student lists for individual blocks in the Master Schedule.
    -   Implemented `slotOverrides` in `localStorage` for persistence.
    -   Added "Edit" button (✎) to schedule blocks (hidden in print).
    -   Created Modal UI for selecting students per block.
    -   Updated Backup/Restore to include specific override data.

***

**Backup ID:** 20251210_0150
**Reason:** Full system backup after fixing Master Schedule duplicate display issue (CSS visibility fix).

## Backed Up Files

| Original File | Backup Filename | Description |
| :--- | :--- | :--- |
| index.html | index_backup_20251210_0150.html | Content backup. |
| script.js | script_backup_20251210_0150.js | Functionality backup. |
| index.css | index_backup_20251210_0150.css | Styling backup with visibility fix. |

## Recent Changes Included
1.  **Duplicate Schedule Fix**:
    -   Address issue where print schedule was visible on screen.
    -   Added .web-only and .print-only display rules in CSS.

***

**Backup ID:** `20251210_2015`
**Reason:** User requested comprehensive backup to prevent data/functionality loss.

## Backed Up Files

| Original File | Backup Filename | Description |
| :--- | :--- | :--- |
| `index.html` | `index.html.bak.20251210_2015` | Latest HTML structure. |
| `script.js` | `script.js.bak.20251210_2015` | Latest validation/logic code. |
| `index.css` | `index.css.bak.20251210_2015` | Latest styles. |

## Notes
- This is a manual backup requested by the user.
- Remember to use the "備份資料" button in the UI to save `localStorage` data.
