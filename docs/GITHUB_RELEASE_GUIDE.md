# GitHub Release v1.0.0 建立指南

## 方法一：使用 GitHub CLI (推薦)

### 1. 安裝 GitHub CLI
```powershell
# Windows (使用 winget)
winget install --id GitHub.cli

# 或使用 scoop
scoop install gh
```

### 2. 登入 GitHub
```bash
gh auth login
```

### 3. 建立 Release
```bash
cd "d:\特教課表Special Education Curriculum"

# 建立標籤
git tag -a v1.0.0 -m "Release v1.0.0 - 首次正式發佈"

# 推送標籤
git push origin v1.0.0

# 建立 Release (附上 Release Notes)
gh release create v1.0.0 \
  --title "v1.0.0 - 特教課表管理系統首次正式發佈" \
  --notes-file RELEASE_NOTES_v1.0.0.md \
  --latest
```

---

## 方法二：使用 GitHub 網頁介面

### 1. 開啟 Releases 頁面
前往: https://github.com/leeivan204-lang/----Special-Education-Curriculum/releases/new

### 2. 填寫 Release 資訊
- **Tag version**: `v1.0.0`
- **Release title**: `v1.0.0 - 特教課表管理系統首次正式發佈`
- **Description**: 複製以下內容

```markdown
# 🎉 特教課表管理系統 v1.0.0

**首次正式發佈！**

這是一個專為特殊教育班級設計的課表管理系統，提供完整的學生管理、課程排程、分組功能，以及 Word 匯出和資料備份功能。

---

## ✨ 主要功能

### 📚 基礎資料管理
- **學生管理**: 新增、編輯、刪除學生資料，支援年級快速切換 (7→8→9)
- **課程管理**: 標準科目與自訂科目，支援 1-5 組分組設定
- **教師管理**: 教師資料與基本鐘點管理

### 👥 分組與排課
- **拖曳式分組**: 視覺化學生池，拖曳分配學生至各組
- **簡易課表**: 週一至週五 7 節課排課介面
- **總課表**: 綜合顯示所有課程、教師、教室、學生資訊
- **單節微調**: Override 機制，可針對單一時段調整學生名單

### 📄 匯出功能
- **Word 匯出**: 
  - 簡易課表 (橫向 A4)
  - 教師個別課表 (含基本鐘點)
  - 學生個別課表 (格式化顯示)
- **PDF 匯出**: 列印預覽與 PDF 產生
- **資料備份**: JSON 匯出/匯入、Google Cloud 備份、攜帶檔匯出

### 🔄 資料同步
- **LocalStorage**: 瀏覽器本地儲存
- **Server**: Python Flask 後端自動存檔
- **Google Sheets**: 雲端備份功能
- **WebSocket**: 多人協作提示機制

---

## 🎬 操作示範影片

完整功能示範（約 3-5 分鐘）:
- [觀看示範影片](http://127.0.0.1:8080/brain/e1a5261a-9529-4694-b8db-26f41cdfb12f/system_demo_video_1770467765257.webp)

---

## 📦 部署方式

### 線上版 (GitHub Pages)
直接訪問: [https://leeivan204-lang.github.io/----Special-Education-Curriculum/](https://leeivan204-lang.github.io/----Special-Education-Curriculum/)

> ⚠️ 線上版無法本地存檔，請使用「匯出資料」與「備份至 Google Cloud」功能

### 本地版 (完整功能)
1. 下載專案: `git clone https://github.com/leeivan204-lang/----Special-Education-Curriculum.git`
2. 安裝依賴: `pip install -r requirements.txt`
3. 啟動伺服器: `python app.py`
4. 開啟瀏覽器訪問 `http://localhost:3000`

---

## ✅ 測試狀態

- ✅ 自動化測試: **54/54 通過** (100%)
  - 前端測試: 43 項
  - 後端測試: 11 項
- ✅ 手動測試: **8/8 通過**
- ✅ 已知 Bug: 無回歸現象

---

## 📝 CHANGELOG

完整變更記錄請查看 [CHANGELOG.md](https://github.com/leeivan204-lang/----Special-Education-Curriculum/blob/main/CHANGELOG.md)

---

## 📖 使用說明

詳細操作指南請參閱 [使用說明書_User_Manual.md](https://github.com/leeivan204-lang/----Special-Education-Curriculum/blob/main/%E4%BD%BF%E7%94%A8%E8%AA%AA%E6%98%8E%E6%9B%B8_User_Manual.md)

---

## 🛠️ 技術規格

- **前端**: HTML, CSS, JavaScript (Vanilla)
- **後端**: Python Flask + Flask-SocketIO
- **資料儲存**: JSON 檔案 + LocalStorage
- **雲端備份**: Google Apps Script + Google Sheets

---

## 🤝 貢獻

歡迎回報問題或提供建議！請前往 [Issues](https://github.com/leeivan204-lang/----Special-Education-Curriculum/issues) 頁面。

---

## 📄 授權

本專案採用 MIT License - 詳見 [LICENSE](LICENSE) 檔案

---

**感謝使用特教課表管理系統！**

```

### 3. 點擊 "Publish release"

---

## Release Notes 檔案

Release Notes 已準備在 `RELEASE_NOTES_v1.0.0.md` 檔案中
