# Changelog

本文件記錄特教課表管理系統的版本更新歷史。

格式基於 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)，
版本編號遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

---

## [Unreleased]

### 計劃中
- Windows 獨立執行檔 (.exe)
- 操作教學影片嵌入系統內
- 範例資料檔案

---

## [1.0.0] - 2026-02-07

### 新增
- 🎉 **首次正式發佈**
- 學生管理功能
  - 新增、編輯、刪除學生
  - 年級設定 (7, 8, 9)
  - 點擊年級數字快速切換功能
- 課程管理功能
  - 標準科目與自訂科目支援
  - 分組設定 (1-5 組)
  - 每週節數設定
  - 教師與教室分配
- 教師管理功能
  - 新增、編輯教師資料
  - 基本鐘點設定
  - 備註欄位
- 分組管理功能
  - 拖曳式學生分組
  - 學生池視覺化
  - 跨組移動學生
  - 清除所有分組功能
  - 分組總覽
- 排課功能 (簡易課表)
  - 拖曳式排課介面
  - 週一至週五 7 節課時間表
  - 課程區塊池顯示剩餘節數
  - 同時段多課程支援 (2-5 門課)
  - 課表標題與實施日期設定
- 總課表功能
  - 綜合顯示所有課程資訊
  - 多視圖切換:
    - 總課表
    - 教室統整課表
    - 教師課表 (個別)
    - 學生課表 (個別)
    - 教室課表
  - 單節學生名單微調 (Override 機制)
  - 教師兼課標記
  - 學生抽離課程手動輸入
- Word 匯出功能
  - 簡易課表匯出 (橫向 A4)
  - 教師課表匯出 (基本鐘點換行顯示)
  - 學生課表匯出 (課程/教師/教室分層樣式)
  - 欄位寬度固定 (節次/時間欄 1.5cm)
- PDF 匯出與列印功能
- 資料管理功能
  - JSON 格式資料匯出/匯入
  - Google Cloud (Google Sheets) 雲端備份
  - 攜帶檔 (Portable) 匯出
  - LocalStorage 本地儲存
- WebSocket 多人協作提示
  - 同時編輯警告
  - 時間戳衝突偵測
- 完整測試套件
  - 前端測試 (43 項)
  - 後端測試 (11 項)
  - 測試覆蓋率 100%

### 資料流設計
- DF-01: 分組→總課表資料連動
- DF-02: 總課表→學生課表資料連動
- DF-03: 總課表微調不回寫分組
- DF-04: 學生課表調整不回寫總課表

### 修復
- 修復 Word 匯出時 `groupStudents.some is not a function` 錯誤
- 修復學生課表顯示錯誤與資料反轉問題
- 修復分組學生池溢出無捲軸問題
- 修復空狀態訊息高度過大問題
- 修復教師課表匯出格式問題

### 技術規格
- 前端: HTML, CSS, JavaScript (Vanilla)
- 後端: Python Flask + Flask-SocketIO
- 資料庫: JSON 檔案 + LocalStorage
- 雲端備份: Google Apps Script + Google Sheets
- 測試: Node.js (前端) + Python unittest (後端)

### 部署方式
- GitHub Pages (靜態版本)
- 本地執行 (完整功能，含自動存檔)
- 獨立執行檔 (規劃中)

---

## 版本說明

### 語義化版本號格式: `MAJOR.MINOR.PATCH`

- **MAJOR**: 重大變更，可能包含不相容的 API 修改
- **MINOR**: 新增向後相容的功能
- **PATCH**: 向後相容的 Bug 修復

### 更新類型標記

- `新增`: 新功能
- `變更`: 既有功能的變更
- `棄用`: 即將移除的功能
- `移除`: 已移除的功能
- `修復`: Bug 修復
- `安全性`: 安全性修復

---

## 相關連結

- [GitHub Repository](https://github.com/leeivan204-lang/----Special-Education-Curriculum)
- [使用說明書](使用說明書_User_Manual.md)
- [問題回報](https://github.com/leeivan204-lang/----Special-Education-Curriculum/issues)

---

**感謝所有貢獻者與使用者！**
