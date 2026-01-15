# 專案指南 - 特教課表管理系統

## 1. 常用指令 (Commands)

### 環境設置 (Setup)
- **安裝依賴**: `pip install -r requirements.txt`
  - 確保已安裝 Python 3.x

### 開發與執行 (Run)
- **啟動伺服器**: `python app.py`
  - 伺服器預設地址: http://localhost:3000
  - 支援區域網訪問 (LAN Access)

### 建置與發布 (Build)
- **建立執行檔**: `./build_exe.ps1`
  - 使用 PyInstaller 打包
  - 輸出位置: `dist/SpecialEdSchedule.exe`
  - 包裝內容: `index.html`, `index.css`, `script.js` 會被打包進執行檔中

## 2. 專案結構 (Structure)

### 核心檔案
- `app.py`: Flask 後端應用程式，負責提供 API 與靜態檔案服務。
- `index.html`: 前端主要介面與結構。
- `script.js`: 前端核心邏輯 (課程管理、排課、拖放功能)。
- `index.css`: 應用程式樣式表。

### 資料目錄
- `data/`: 存放使用者資料 (JSON 格式)，由 `app.py` 自動管理。

### 工具腳本
- `build_exe.ps1`: 用於將 Python 腳本打包為 Windows 執行檔 (.exe) 的 PowerShell 腳本。

## 3. 技術堆疊 (Tech Stack)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Python (Flask)
- **Database**: JSON Files (Local Storage)
- **Packaging**: PyInstaller
