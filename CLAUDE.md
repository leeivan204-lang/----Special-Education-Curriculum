# 專案指南 - 特教課表管理系統

> **版本**: 2026.07.18a　|　**文件版本**: 3.0（移除 GAS 自動還原與編輯模式後的實際架構）

---

## 1. 快速開始 (Quick Start)

### 本地開發 (Local Development)
```bash
# 1. 安裝依賴
pip install -r requirements.txt

# 2. 啟動伺服器 (http://localhost:3000)
python app.py

# 3. 瀏覽器開啟
http://localhost:3000
```

登入後輸入任意 User ID 即進入系統。每位使用者擁有各自獨立的編輯空間，資料以 `userId` 隔離。

### 生產環境打包 (Build Executable)
```powershell
./build_exe.ps1
# 輸出: dist/SpecialEdSchedule.exe
```

---

## 2. 專案架構 (Architecture)

### 系統架構圖
```
┌─────────────────────────────────────────────────────────────┐
│                    使用者瀏覽器                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Frontend: HTML5 + CSS3 + Vanilla JavaScript          │   │
│  │ - index.html   : UI 結構                              │   │
│  │ - script.js    : 課程/學生/教師/分組管理、拖放排課、  │   │
│  │                  總課表渲染、同步邏輯、Socket.IO      │   │
│  │ - index.css    : 樣式表                               │   │
│  │ - docx_export.js: 前端 Word 匯出 (docx.js)            │   │
│  │ - LocalStorage : 本地快取                             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────┬──────────────────────────────────────────┘
                  │ WebSocket (Socket.IO) + HTTP JSON API
                  │
┌─────────────────▼──────────────────────────────────────────┐
│            後端伺服器 (Flask + Flask-SocketIO)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ app.py:                                              │   │
│  │ - POST /api/login          : 帳號/密碼驗證           │   │
│  │ - GET  /api/data/<user_id> : 讀取使用者資料          │   │
│  │ - POST /api/data/<user_id> : 儲存使用者資料 (含 409  │   │
│  │                              時間戳衝突處理)          │   │
│  │ - GET  /api/ping           : 健康檢查                │   │
│  │ - Socket.IO: join / disconnect                       │   │
│  │ - (保留但前端已停用) editor_* 鎖定端點               │   │
│  └────────────────────┬─────────────────────────────────┘   │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │ 本地資料儲存 (data/<user_id>.json)                   │   │
│  │ - Render free tier 為短暫檔案系統，重啟後遺失 ❌     │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘

備份策略：使用者以「匯出資料 (JSON)」/「匯出攜帶檔」手動備份，
         再以「匯入資料」還原。系統不再自動連線 Google Apps Script。
         (gas_script.gs 仍保留於 repo，屬選用的外部備份腳本，非執行流程一部分)
```

### 資料流程 (Data Flow)

#### 登入 → 載入 / 同步流程
```
使用者輸入 User ID → POST /api/login (驗證)
    ↓
loadDataAndSync()  [script.js:878]
    ↓
GET /api/data/<user_id>  (逾時 10 秒)
    ├─ 伺服器有資料
    │     ├─ 本機 lastSyncedTimestamp > 伺服器 timestamp + 門檻
    │     │     → 以本機 localStorage 為準，並延遲補推伺服器
    │     └─ 否則 → 採用伺服器資料 (importDataToMemory)
    └─ 逾時 / 無資料 → 顯示還原橫幅，等待重試 (不自動寫入空資料)
```

> 同步以 **時間戳 (timestamp)** 判斷，無 `confirm()` 對話框、無 GAS 還原。

#### 儲存流程
```
資料變動 → saveAllDataToServer()  [script.js:964]
    ↓
POST /api/data/<user_id>  { data, lastSyncedTimestamp, force }
    ├─ 200 → 更新 lastSyncedTimestamp
    └─ 409 → 時間戳衝突，依合併/覆蓋策略處理
```

---

## 3. 關鍵程式碼位置 (Critical Code Locations)

### 前端資料與同步 (script.js)

| 功能 | 行號 | 說明 |
|------|------|------|
| 版本字串 `VERSION_NUMBER` | 47 | 目前: `2026.07.18a`（同步更新 index.html 版本與 `?v=` 快取字串） |
| `store` (LocalStorage 封裝) | ~200 | `get/set/getRaw/setRaw`；快取與 `lastSyncedTimestamp` |
| `loadDataAndSync()` | 878 | 登入後載入 + 時間戳同步（**無 GAS**） |
| `saveAllDataToServer()` | 964 | POST 儲存，含 409 衝突處理 |
| `importDataToMemory()` | 1299 | 將資料寫入記憶體變數並刷新所有畫面 |
| `getFullDataSnapshot()` | 1795 | 匯出/儲存用的完整資料快照 |
| `renderMasterSchedule()` | 3528 | 總課表 / 教室統整課表 畫面渲染（含列印版反序表格） |
| `getCommonTimeSlots()` | 3958 | 共用時段定義（早自習、1–4 節、中午、5–7 節） |
| `generateClassroomSchedules()` | 4888 | 教室課表（個別）畫面渲染 |
| `exportMasterScheduleWord()` | 5904 | **Word 匯出分派器**：依 schedule-type 呼叫對應函數 |

### 前端 Word 匯出 (docx_export.js)

| 匯出類型 | 函數 | 行號 |
|---------|------|------|
| 簡易課表 | `generateWordScheduleJS` | 52 |
| 教師課表 (個別) | `generateWordTeacherScheduleJS` | 165 |
| 學生課表 (個別) | `generateWordStudentScheduleJS` | 343 |
| **總課表 / 教室統整課表** | `generateWordMasterScheduleJS` | 587 |
| **教室課表 (個別)** | `generateWordClassroomScheduleJS` | 947 |

> ⚠️ 已知：`docx_export.js` 第 500 行有一個同名 `generateWordClassroomScheduleJS` 舊定義，
> 被第 947 行覆蓋，屬死碼（連同 script.js 的 `exportClassroomScheduleWord`），待清理。

**總課表 Word 版面重點**（`generateWordMasterScheduleJS`，對照列印/PDF）:
- 橫向 A4（`PageOrientation.LANDSCAPE`）
- 星期欄反序（星期五 → 星期一），節次/時間欄置於**最右**
- 每星期欄拆成兩個實體欄：分組**由右到左**（A 在右、B 在左，C、D 依序往下）
- 分組欄以主表格框線分隔 → 分隔線延伸到底；欄內逐列補空行使橫向虛線對齊
- 早自習、中午以灰底合併列呈現
- 一般總課表在每格列出學生名單；教室統整模式僅顯示課程/教師/教室

### 後端 (app.py)

| 功能 | 行號 | 說明 |
|------|------|------|
| 靜態檔服務 | 134, 138 | `/` 與 `/<path>` |
| 登入驗證 | 589 | `POST /api/login` |
| 健康檢查 | 541 | `GET /api/ping` |
| 資料讀取 | 638 | `GET /api/data/<user_id>`（讀 `data/<user_id>.json`） |
| 資料儲存 | 664 | `POST /api/data/<user_id>`（時間戳衝突回 409） |
| Socket.IO | 143, 175 | `join` / `disconnect` |
| 編輯鎖 (保留未用) | 282–541 | `editor_*` 事件與 `/api/editor/*`；前端已停用，後端保留相容 |

---

## 4. 資料模型 (Data Model)

`getFullDataSnapshot()` 產生的結構（匯出 JSON / 儲存至伺服器）:

```jsonc
{
  "schemaVersion": 1,
  "timestamp": 1721200000000,          // UTC 毫秒
  "scheduleTitle": { "prefix": "", "year": "", "semester": "", "suffix": "" },
  "implementationDates": { "startDate": "", "endDate": "" },

  "students": [ { "id": 1001, "name": "王小明", "grade": "7" } ],
  "teachers": [ { "id": 2001, "name": "陳老師", "baseHours": 20 } ],

  "courses": [
    {
      "id": 3001,
      "name": "國語文",
      "groups": ["甲組", "乙組"],                     // 分組名稱字串陣列
      "groupDetails": {
        "甲組": { "hours": 4, "room": "101教室", "teacher": ["陳老師"], "displayRoom": "" }
      }
    }
  ],

  // 分組 → 學生指派
  "assignments": { "3001": { "甲組": [1001, 1003], "乙組": [1002] } },

  // 排課：key 為 `${day}-${period}`，value 為區塊陣列
  "scheduleData": { "monday-1": [ { "courseId": 3001, "blockIndex": 0 } ] },

  // 單一時段的學生名單微調（delta 或絕對陣列）
  "slotOverrides": { "monday-1": { "3001": { "甲組": { "type": "delta", "added": [1002], "removed": [1005] } } } },

  "teacherPartTimeMarks": {},
  "studentManualEntries": {}
}
```

重點：
- `scheduleData` 為**扁平物件**，key = `{day}-{period}`（day: monday…friday；period: morning/1–7/lunch）。
- 分組學生存於獨立的 `assignments`，非 `course.groups` 內。
- 總課表某格的學生名單 = `assignments[courseId][groupName]` 再套用 `slotOverrides[slotKey]`。
- Word 匯出與畫面渲染共用同一資料模型（見 `renderMasterSchedule`）。

---

## 5. 功能總覽 (Features)

- **學生 / 課程 / 教師管理**：新增、編輯、刪除、搜尋、批次新增；年級快速切換。
- **分組管理**：拖曳式分組、學生池、分組總覽、匯出 CSV。
- **排課（簡易課表）**：拖放排課、同時段多課程、課表標題與實施日期。
- **總課表 / 教室統整課表 / 教師 / 學生 / 教室課表**：多視圖切換；單節學生名單微調（override）；教師兼課標記；學生抽離手動輸入。
- **匯出**：
  - **PDF / 列印**：所有課表皆可。
  - **Word (.docx)**：簡易課表、教師課表(個別)、學生課表(個別)、**總課表**、**教室統整課表**、**教室課表(個別)**（前端 docx.js 產生）。
- **資料管理**：匯出/匯入 JSON、匯出攜帶檔、LocalStorage 本地快取。
- **多人提示**：Socket.IO 連線狀態、時間戳衝突偵測。

### 已移除功能（勿在文件或程式中復現）
- ❌ 編輯/檢視模式區分與角色條（前端已移除；後端 editor_* 端點保留但停用）。
- ❌ 登入時的 Google Apps Script 自動還原流程（改為使用者手動匯出/匯入備份）。

---

## 6. 故障排查 (Troubleshooting)

### 症狀：登入後課表未載入
1. **瀏覽器 Console (F12)**：查看 `[loadDataAndSync]` 訊息。
   - `伺服器回應逾時` → 伺服器冷啟動或網路問題，橫幅會自動重試。
   - `以本機 localStorage 為準，補推伺服器` → 本機資料較新，正常。
2. **後端日誌**：搜尋 `POST /api/login`、`GET /api/data`、`POST /api/data`。
3. **本地快取**：`localStorage` 是否有 `courses` 等資料。
4. **Render 重啟**：free tier 重啟會清空 `data/`，若無伺服器資料且本機也無 → 需以匯入還原。

### 症狀：Word 匯出無反應或內容為空
- 確認瀏覽器已載入最新 `docx_export.js`（`index.html` 的 `?v=` 快取字串是否更新；必要時 Ctrl+F5）。
- 確認資料結構正確（`scheduleData` 為扁平 `{day-period}`；分組學生在 `assignments`）。
- 於真實瀏覽器測試（自動化/無頭環境的 `Packer.toBlob` 可能卡住）。

### 症狀：儲存出現 409 / 資料過期
- 代表伺服器上的 `timestamp` 比本機基準新（他處已更新）。依提示重新載入後再儲存，或選擇覆蓋。

---

## 7. 環境設定 (Environment)

Render Dashboard 環境變數：

| 變數名 | 說明 |
|--------|------|
| `ADMIN_PASSWORD` | 後端登入密碼 |
| `FLASK_ENV` | 執行環境（`production`） |

> 註：GAS 相關環境變數（`GAS_WEBHOOK_URL`、`GAS_SERVER_KEY` 等）已非執行流程所需；
> 僅在你選擇使用 `gas_script.gs` 作為外部備份時才需設定。詳見 [DEPLOY.md](DEPLOY.md)。

---

## 8. 測試 (Tests)

```bash
# 前端 (Node.js)
node tests/test_frontend_node.js         # 工具/同步邏輯 (14)
node tests/test_frontend_data.js         # 資料處理 (14)
node tests/test_frontend_grouping.js     # 分組 (9)
node tests/test_frontend_scheduling.js   # 排課 (6)

# 後端 (Python)
python -m pytest tests/test_backend_api.py -q   # (10)
```

目前狀態：前端 43 項、後端 10 項，全部通過。

> 同步測試（`test_frontend_node.js`）已對齊新的時間戳同步邏輯；舊的 GAS 雲端還原測試已移除。

---

## 9. 開發工作流 (Development Workflow)

新增/修改功能後，依 `.agent/workflows/system-update.md` 檢查清單：
1. **更新文件**：`CLAUDE.md`、`README.md`、`CHANGELOG.md`（記錄本次變更）。
2. **敏感資訊**：確認無硬編碼金鑰；`.env` 已被 `.gitignore` 忽略。
3. **更新版本號**：`script.js` `VERSION_NUMBER`（~47）、`index.html` 側邊欄版本（~52）與 `<script src="...?v=YYYYMMDDx">` 快取字串（~657–658）。格式 `YYYY.MM.DDx`，每日字母重置。
4. **測試**：執行上述前後端測試確認全過。
5. **提交/推送**：清楚的 commit 訊息；推送後於 Render 確認部署成功。

---

## 10. 檔案結構 (File Structure)

```
特教課表 Special Education Curriculum/
├── app.py                      # Flask 後端主應用
├── index.html                  # 前端 UI
├── script.js                   # 前端邏輯（管理、排課、渲染、同步、匯出分派）
├── index.css                   # 樣式表
├── docx_export.js              # 前端 Word 匯出 (docx.js)
├── requirements.txt            # Python 依賴
├── build_exe.ps1               # 打包 exe 腳本
├── gas_script.gs               # (選用) 外部 Google Apps Script 備份腳本
├── data/                       # 本地使用者資料 (JSON)；Render 上為短暫儲存
│   └── <user_id>.json
├── tests/                      # 前端 (Node) 與後端 (pytest) 測試
├── CHANGELOG.md                # 版本更新日誌
├── DEPLOY.md / SETUP_PYTHON.md # 部署與環境設定
├── 使用說明書_User_Manual.md   # 使用手冊
└── CLAUDE.md                   # 本專案指南
```

---

**最後更新**: 2026-07-18（v2026.07.18a）
