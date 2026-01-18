# 特教課表管理系統 (Special Education Curriculum Management System)

本專案是一個專為特殊教育班級設計的課表管理系統，支援課程分組、學生管理、以及課表排程功能。

## 專案功能
- **學生管理**：新增、編輯學生資料。
- **課程管理**：設定課程名稱、節數及分組需求。
- **排課功能**：視覺化排課介面，支援拖拉操作。
- **資料備份**：支援匯出/匯入 JSON 格式備份，以及 Google Cloud (Google Sheets) 雲端備份。
- **列印輸出**：支援匯出 PDF 或列印總課表及個別課表。

## 部署與執行

### 線上部署 (GitHub Pages)
本專案已設定 GitHub Actions，推送至 `main` 或 `master` 分支後將自動部署至 GitHub Pages。
- 確保 Repository 設定中的 Pages Source 為 `GitHub Actions`。
- 部署後，網頁將為靜態版本。
- **注意**：靜態版本不支援本地 Python 後端 (`app.py`) 的登入驗證與本地檔案讀寫。
- **建議**：使用線上版時，請搭配「匯出資料」與「備份至 Google Cloud」功能來保存資料。

### 本地執行 (完整功能)
若需使用完整本地功能（如本地自動存檔），請執行 Python 後端：

1. 安裝依賴：
   ```bash
   pip install -r requirements.txt
   ```
2. 啟動伺服器：
   ```bash
   python app.py
   ```
3. 開啟瀏覽器訪問 `http://localhost:3000`。

## 操作紀錄與注意事項 (.gitignore)
本專案已設定 `.gitignore` 以排除以下檔案：
- `data/`：本地資料夾，避免上傳學生個資。
- `*.bak.*`, `*.record`：系統產生的備份與暫存檔。
- `.env`：環境變數與敏感設定。
- Python 快取與虛擬環境檔案。

## 雲端備份設定
本系統支援將資料備份至 Google Sheets (透過 Google Apps Script)。
- GAS URL 已硬寫入於系統中。 
- 若需修改，請參閱 `script.js` 中的 `GAS_API_URL` 常數。
