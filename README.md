# 特教課表管理系統 v2026.07.18a

**一個專為特殊教育老師設計的現代化課表管理系統**

[![Version](https://img.shields.io/badge/version-v2026.07.18a-blue.svg)](#)
[![Status](https://img.shields.io/badge/status-Production%20Ready-brightgreen.svg)](#)
[![Tests](https://img.shields.io/badge/tests-53%2F53%20passing-brightgreen.svg)](#)

---

## 🎯 快速開始

| 我是… | 請看 |
|-------|------|
| 👨‍🏫 教師 | **[使用說明書_User_Manual.md](使用說明書_User_Manual.md)** |
| 👨‍💻 開發者 | **[CLAUDE.md](CLAUDE.md)**（架構與開發指南） |
| 🔧 部署/管理員 | **[DEPLOY.md](DEPLOY.md)**、**[SETUP_PYTHON.md](SETUP_PYTHON.md)** |
| 📝 版本紀錄 | **[CHANGELOG.md](CHANGELOG.md)** |

---

## 🚀 線上使用

👉 **[https://special-education-curriculum.onrender.com](https://special-education-curriculum.onrender.com)**

- ✅ 無需安裝，瀏覽器即開即用
- ✅ 輸入 User ID 即進入，**每位使用者擁有各自獨立的編輯空間**（資料以 userId 隔離）
- ✅ 手動匯出／匯入課表，完全自主控制備份

**登入**：帳號 `admin`，密碼由管理員提供。

---

## 💻 本地執行

```bash
# 1. 安裝依賴
pip install -r requirements.txt

# 2. 啟動伺服器
python app.py

# 3. 打開瀏覽器
http://localhost:3000
```

---

## ✨ 主要功能

### 📅 課表管理
- 課程 / 學生 / 教師 / 分組管理（新增、編輯、刪除、搜尋、批次）
- 拖放式排課（簡易課表），支援同時段多課程
- 多視圖：**總課表、教室統整課表、教師課表、學生課表、教室課表**
- 單節學生名單微調（override）、教師兼課標記、學生抽離手動輸入

### 👥 學生與分組
- 學生年級設定與快速切換
- 拖曳式分組、學生池視覺化、分組總覽、匯出 CSV

### 📤 匯出功能
- **PDF / 列印**：所有課表皆可
- **Word (.docx)**：簡易課表、教師課表、學生課表、**總課表**、**教室統整課表**、**教室課表**
  - 總課表 Word 版面對照列印/PDF：橫向 A4、星期反序、節次欄在右、分組由右到左、每格列出學生名單

### 💾 資料備份與版本管理
- **匯出／匯入 JSON** — 自由選擇備份位置與時機
- **攜帶檔案模式** — 完整課表資料離線可用
- **LocalStorage 本地快取** + 伺服器儲存（以時間戳同步，含 409 衝突處理）

---

## 🏗️ 技術架構

| 層級 | 技術 |
|------|------|
| 前端 | HTML5 + CSS3 + Vanilla JavaScript；`docx.js`（Word 匯出） |
| 後端 | Python Flask + Flask-SocketIO |
| 儲存 | `data/<user_id>.json`（伺服器）+ LocalStorage（本地快取） |
| 部署 | Render.com（gunicorn）／本地 `python app.py`／獨立 exe |

> 詳細架構、資料模型與關鍵程式碼位置請見 **[CLAUDE.md](CLAUDE.md)**。

---

## 🔐 安全與隱私

- ✅ HTTPS 加密傳輸
- ✅ 資料以 userId 隔離，使用者自主控制匯出/匯入備份
- ✅ 帳號密碼驗證；密鑰以環境變數管理，無硬編碼
- ⚠️ Render free tier 為短暫檔案系統，伺服器重啟會清空 `data/` — 請定期以匯出功能備份

---

## 🔄 版本更新（摘要）

完整紀錄見 **[CHANGELOG.md](CHANGELOG.md)**。

### v2026.07.18a（2026-07-18）
- ✨ **新增總課表 / 教室統整課表 / 教室課表(個別) 的 Word 匯出**
- ✨ 總課表 Word 版面對照列印/PDF：橫向、星期反序、分組由右到左、格內框線對齊、學生逐行列出
- 🧪 同步測試改寫為時間戳邏輯；移除已淘汰的 GAS 雲端還原測試

### v2026.05.20b（2026-05-20）
- ❌ 移除「編輯／檢視模式」區分與角色條；改為每位使用者獨立編輯空間
- 🔧 改善 WebSocket 與 API timeout（Render 冷啟動）

### 早期
- 移除登入時的 Google Apps Script 自動還原，改為手動匯出/匯入備份

---

## 🧪 測試

```bash
node tests/test_frontend_node.js        # 14
node tests/test_frontend_data.js        # 14
node tests/test_frontend_grouping.js    # 9
node tests/test_frontend_scheduling.js  # 6
python -m pytest tests/test_backend_api.py -q   # 10
```

目前：前端 43 項、後端 10 項，全部通過。

---

**特教課表管理系統 v2026.07.18a**　|　最後更新：2026-07-18
官方網址：https://special-education-curriculum.onrender.com
