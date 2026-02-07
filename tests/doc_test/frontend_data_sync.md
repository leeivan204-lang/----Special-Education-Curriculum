# 前端資料同步測試案例 (Frontend Data Sync Test Cases)

## 測試目標
驗證 `script.js` 中的 `loadDataAndSync` 函式能否正確處理不同來源（Server, Google Cloud, LocalStorage）的資料同步與衝突解決。

## 測試環境
- **執行環境**: Node.js (使用 `test_frontend_node.js` 模擬瀏覽器環境)
- **相依模組**: `fs`, `vm`, `path`
- **Mock 物件**: `window`, `document`, `localStorage`, `fetch`, `confirm`

## 測試案例詳細列表

### 1. 遠端資料優先 (Remote > Local)
- **情境**: 使用者登入，伺服器有較新資料，本地無資料或舊資料。
- **預期結果**:
    - `fetch` 成功取得伺服器資料。
    - `importDataToMemory` 被呼叫並載入資料。
    - `LAST_SYNCED_TIMESTAMP` 更新為伺服器時間戳記。
    - 資料成功寫入 `window.__TEST__.courses`。
- **測試狀態**: ✅ Passed

### 2. 本地資料衝突，選擇本地 (Local > Remote, User chooses Local)
- **情境**: 本地 `lastSavedTimestamp` 比伺服器時間新。
- **模擬互動**: `confirm` 對話框彈出，使用者選擇「確定」（保留本地）。
- **預期結果**:
    - 觸發 `saveAllDataToServer` (Mocked fetch POST)。
    - 本地資料保留，並嘗試上傳至伺服器。
- **測試狀態**: ✅ Passed

### 3. 皆無資料，發現雲端備份 (Cloud Restore)
- **情境**: 伺服器無資料，但 Google Cloud (GAS) 有較新備份。
- **模擬互動**: `confirm` 對話框彈出，使用者選擇「匯入雲端資料」。
- **預期結果**:
    - `fetch` 成功取得 Mock GAS 資料。
    - `importDataToMemory` 載入雲端資料。
    - 自動觸發 `saveToCustomServer` 同步回伺服器。
    - 資料成功寫入 `window.__TEST__.courses`。
- **測試狀態**: ✅ Passed

## 執行紀錄
- **測試腳本**: `node test_frontend_node.js`
- **最近執行時間**: 2026-02-07
- **結果**: 8 Tests Passed, 0 Failed

## 備註
- 測試過程中已 Mock 了 `refreshAllViews` 等 UI 渲染函式，以避免 Node.js 環境中缺少 DOM API 導致的錯誤。
- 透過 `window.__TEST__` 暴露了內部狀態 (`CURRENT_USER`, `LAST_SYNCED_TIMESTAMP`) 以便測試驗證。
- Google Apps Script URL 在測試中被動態替換為 `http://mock-gas` 以避免真實網路請求。
