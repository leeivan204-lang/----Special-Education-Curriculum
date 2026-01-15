# 系統還原指南 (Restore Guide)

本文件說明如何在檔案遺失或損壞時，使用備份檔案進行系統還原。

## 🔍 備份檔案位置

所有的備份檔案都存放於專案根目錄中（`d:\特教課表Special Education Curriculum\`），檔案名稱格式為：
`[原檔名]_backup_[日期]_[時間].[副檔名]`

例如：
- `script_backup_20251209_0215.js` (腳本備份)
- `index_backup_20251209_0215.html` (網頁結構備份)
- `index_backup_20251209_0215.css` (樣式表備份)

---

## 🛠️ 還原步驟

如果發生檔案遺失或損壞，請依照以下步驟還原：

### 方法一：使用檔案總管手動還原

1. **找到最新的備份檔案**
   - 依照檔案名稱中的日期時間（例如 `20251208_2308`）找到最新的備份檔案。

2. **重新命名檔案**
   - 刪除或重新命名損壞的現有檔案（例如 `script.js` -> `script.js.old`）。
   - 複製備份檔案（例如 `script_backup_20251208_2308.js`）。
   - 將複製出來的檔案重新命名為原檔名，例如改成 `script.js`。

3. **對所有主要檔案重複此步驟**
   - `index.html`
   - `index.css`
   - `script.js`

### 方法二：使用 PowerShell 指令還原

若您熟悉指令操作，可在專案資料夾中開啟 PowerShell 並執行以下指令（請將日期時間替換為您要還原的版本）：

```powershell
# 設定要還原的版本時間戳記
$Version = "20251209_0003"

# 強制還原 (會覆蓋現有檔案)
Copy-Item "script_backup_$Version.js" "script.js" -Force
Copy-Item "index_backup_$Version.html" "index.html" -Force
Copy-Item "index_backup_$Version.css" "index.css" -Force

Write-Host "還原完成！"
```

---

## 💾 資料庫備份與還原 (Data Backup & Restore)

本系統的所有資料（學生名單、課程、分組設定等）都儲存在瀏覽器的 Local Storage 中。為了防止資料遺失，**強烈建議您定期進行資料備份**。

### 如何備份資料 (Backup)
1. 在左側選單最下方，點擊綠色的 **「💾 備份資料」** 按鈕。
2. 系統會自動下載一個名為 `schedule_data_backup_YYYYMMDD.json` 的檔案。
3. **請妥善保存此檔案**（建議存放在雲端或隨身碟）。

### 如何還原資料 (Restore)
> ⚠️ **警告：還原操作會覆蓋現有的所有資料，且無法復原！**

1. 在左側選單最下方，點擊紅色的 **「📂 還原資料」** 按鈕。
2. 選擇您之前備份的 `.json` 檔案。
3. 系統會跳出確認視窗，確認無誤後點擊「確定」。
4. 還原完成後，網頁會自動重新整理，顯示還原後的課表內容。

---

## 📞 備份紀錄查詢

您可以查看目錄下的 `BACKUP_LOG_20251208.md` 檔案，裡面記錄了所有建立過的備份時間點與內容說明。
