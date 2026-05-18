# 專案指南 - 特教課表管理系統

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
│  │ - index.html: UI 結構                                 │   │
│  │ - script.js: 課程管理、拖放、Socket.IO 事件          │   │
│  │ - index.css: 樣式表                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────┬──────────────────────────────────────────┘
                  │ WebSocket (Socket.IO) + HTTP API
                  │
┌─────────────────▼──────────────────────────────────────────┐
│               後端伺服器 (Render.com)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Backend: Python Flask                                │   │
│  │ - app.py: 主應用、API 端點、GAS 同步                 │   │
│  │ - /api/login: 驗證登入                               │   │
│  │ - /api/data/<user_id>: 讀取使用者資料                │   │
│  │ - /api/save: 儲存使用者資料                          │   │
│  │ - /api/gas-restore-force: 強制 GAS 恢復             │   │
│  └──────────────────────────────────────────────────────┘   │
│                        │                                      │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │ 本地資料儲存 (Ephemeral)                             │   │
│  │ - data/: JSON 格式使用者資料                         │   │
│  │ - 伺服器重啟時全部遺失 ❌                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────┬──────────────────────────────────────────┘
                  │ HTTP GET/POST (25s timeout)
                  │ User-Agent: Mozilla/5.0 (防反爬蟲)
                  │
┌─────────────────▼──────────────────────────────────────────┐
│        Google Apps Script (GAS) - 永久備份                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ gas_script.gs: 資料讀寫端點                          │   │
│  │ - doGet(e): 讀取使用者資料                           │   │
│  │ - doPost(e): 儲存使用者資料                          │   │
│  │ - 身份驗證: Server Key 或 OAuth ID Token             │   │
│  │ - keepAlive(): 防冷啟動 (5 分鐘觸發一次)             │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Google Sheet - 兩層架構 (雙向相容)                   │   │
│  │ ✓ 新架構: 單一分頁 "課表資料" (userId 為主鍵)       │   │
│  │ ✓ 舊架構: 每個 userId 一個獨立分頁 (向後相容)       │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 資料流程 (Data Flow)

#### 1. 登入 → 自動 GAS 恢復流程
```
使用者登入
    ↓
POST /api/login (驗證)
    ↓
客戶端檢查本地資料
    ├─ 有 → 直接加載
    └─ 無 → 請求後端恢復
        ↓
    GET /api/data/<user_id>
        ↓
    後端檢查本地檔案
    ├─ 有 → 返回
    └─ 無 → 啟動背景 GAS 恢復執行緒
        ↓
    _start_gas_restore_bg() [背景執行緒，25s 超時]
        ↓
    pull_from_gas(user_id)
        ↓
    GAS GET /課表資料?userId=XXX (或舊分頁回溯)
        ↓
    寫入本地 data/<user_id>.json
        ↓
    Socket.IO: 'gas_restore_ready' 事件
        ↓
    前端接收並更新 UI (須確保 mainAppSection 已顯示)
```

---

## 3. 關鍵程式碼位置 (Critical Code Locations)

### 前端 (script.js)

| 功能 | 位置 | 說明 |
|------|------|------|
| GAS 恢復事件監聽 | 行 292-306 | **CRITICAL**: 檢查 mainAppSection 狀態；若隱藏則中止 |
| 恢復橫幅與重試 | 行 1085-1132 | 顯示恢復狀態、自動重試 (30s × 4 次) |
| 版本字串 | 行 (index.html) 133 | 當前: 2026.04.21d |

**關鍵邏輯檢查清單**:
```javascript
socket.on('gas_restore_ready', async (data) => {
    // ⚠️ 如果此時 mainAppSection 被隱藏 → 事件被忽略！
    if (!mainAppSection || mainAppSection.style.display === 'none') {
        console.log('[GAS] User not yet in main app, skipping restore refresh');
        return;  // 靜默返回 = 無法加載資料
    }
    // ... 加載資料
});
```

### 後端 (app.py)

| 功能 | 行號 | 說明 |
|------|------|------|
| 登入驗證 | 706-725 | POST /api/login 驗證帳號/密碼 |
| 資料讀取端點 | 779-810 | GET /api/data/<user_id>；無本地檔案時觸發 GAS 恢復 |
| 背景 GAS 恢復執行緒 | 727-777 | **CRITICAL**: 啟動背景執行緒，25s 超時 |
| GAS 請求函式 | 628-671 | pull_from_gas(user_id)；含 Mozilla User-Agent |
| Socket.IO 事件發送 | 756-762 | 發送 'gas_restore_ready' 事件 |
| 強制恢復端點 | 813-831 | POST /api/gas-restore-force/<user_id> 清除快取並重新啟動 |

**關鍵執行緒檢查清單**:
```python
def _start_gas_restore_bg(user_id, file_path):
    """背景執行緒，25 秒超時。檢查此函數是否被呼叫"""
    # ⚠️ 若此函數從未執行 → 後端日誌無 [GAS/BG] 開頭的訊息
    # ⚠️ 若執行但無法連線 GAS → 超時後返回 None
    thread = threading.Thread(target=_gas_restore_worker, args=(user_id, file_path), daemon=True)
    thread.start()
```

### Google Apps Script (gas_script.gs)

| 功能 | 行號 | 說明 |
|------|------|------|
| GET 端點 | 42-72 | 讀取使用者資料；支援 Server Key 和 OAuth Token |
| POST 端點 | 79-110 | 寫入使用者資料（備份） |
| 新架構讀取 | 212-230 | 從單一 "課表資料" 分頁讀取 |
| 舊架構回溯 | 236-264 | 若新架構找不到，嘗試每 userId 獨立分頁 |
| 保溫函數 | 118-122 | keepAlive()；防 GAS 冷啟動 |

---

## 4. 故障排查 (Troubleshooting)

### 症狀 1: 登入後無法加載課表 (GAS 恢復失敗)

#### 診斷步驟

**步驟 1: 檢查瀏覽器控制台** (F12 → Console)
```javascript
// 應該看到:
[GAS] User not yet in main app, skipping restore refresh  // ✓ 或
[GAS] 恢復成功，更新 UI                                    // ✓ 或
[GAS] 恢復失敗: ...                                        // ✗ 錯誤訊息
```

**步驟 2: 啟用 Preserve Log** (防止登入重新整理時日誌消失)
- Chrome DevTools → Console → 齒輪⚙️ → 勾選 "Preserve log"
- 重新整理頁面，觀察所有日誌

**步驟 3: 檢查 Render 後端日誌**
- Render Dashboard → 應用程式 → Logs
- 搜尋: `POST /api/login` 及 `[GAS/BG]` 前綴
- **關鍵檢查點**:
  ```
  ✓ [GAS/BG] Starting restoration thread for userId=...
  ✓ [GAS/BG] pull_from_gas returned: <type>  (has data: True/False)
  ✓ [GAS/BG] EMITTING gas_restore_ready
  ✗ 若無上述訊息 → 線程未執行或前端連線失敗
  ```

**步驟 4: 檢查 GAS 是否有資料**
- Google Sheet → 開啟對應使用者的分頁 (或 "課表資料" 分頁)
- 確認資料存在且為有效 JSON

**步驟 5: 手動測試 GAS 端點** (使用 curl 或 Postman)
```bash
# Server Key 認證 (後端用)
curl "https://script.google.com/...?userId=Spe for u&serverKey=YOUR_KEY"

# OAuth 認證 (前端用)
curl -H "Authorization: Bearer YOUR_ID_TOKEN" "https://script.google.com/...?userId=Spe for u"
```

#### 常見原因及解決方案

| 症狀 | 原因 | 解決方案 |
|------|------|---------|
| 後端無 [GAS/BG] 日誌 | 線程未啟動或前端未呼叫 /api/data | 檢查: (1) GET /api/data 是否被呼叫？(2) 後端部署版本是否正確？ |
| GAS 返回 401 Unauthorized | Server Key 錯誤或過期 | 檢查 Render 環境變數: GAS_SERVER_KEY 是否與 GAS 專案設定相符 |
| GAS 返回 500 Server Error | GAS 語法錯誤或 Sheet 損壞 | 開啟 GAS 編輯器，檢查執行日誌 |
| 前端收不到 gas_restore_ready 事件 | Socket.IO 連線失敗 或事件發送但前端未監聽 | 檢查: (1) WebSocket 連線狀態 (2) mainAppSection 顯示狀態 |
| 本地檔案無法寫入 | Render 檔案系統權限或路徑錯誤 | 檢查 app.py 中 data 目錄是否存在; Render 重啟會刪除所有本地檔案 |

---

## 5. 環境設定 (Environment Setup)

### Render.com 環境變數

在 Render Dashboard 設定以下環境變數:

| 變數名 | 說明 | 範例 |
|--------|------|------|
| `GAS_WEBHOOK_URL` | Google Apps Script Web App URL | `https://script.google.com/macros/d/XXX/userweb?v=1` |
| `GAS_SERVER_KEY` | GAS 專案設定的 Server Key | `my-secret-key-2026` |
| `ADMIN_PASSWORD` | 後端登入密碼 | `your-secure-password` |
| `FLASK_ENV` | 執行環境 | `production` |

### Google Apps Script 設定

1. **開啟 GAS 專案**
   - 進入 Google Sheet 內嵌的 Apps Script 編輯器

2. **設定指令碼屬性** (Script Properties)
   - 左側「專案設定」 → 「指令碼屬性」
   - 新增以下屬性:
     ```
     SERVER_KEY         | my-secret-key-2026  (與 Render GAS_SERVER_KEY 相同)
     GOOGLE_CLIENT_ID   | (可選) 前端 OAuth Client ID
     ALLOWED_EMAILS     | teacher@gmail.com,admin@school.edu.tw (逗號分隔，可留空)
     ```

3. **部署為 Web 應用程式**
   - 「部署」→ 「管理部署作業」 → 「新增部署」
   - 類型: **Web 應用程式**
   - 執行身分: **我（部署者）**
   - 誰可以存取: **所有人 (Anyone)**
   - 部署後複製 URL → 貼入 Render 環境變數 `GAS_WEBHOOK_URL`

4. **設定保溫觸發器** (防冷啟動)
   - 左側「觸發器」 → 「新增觸發器」
   - 函數: `keepAlive`
   - 時間驅動: 每 5 分鐘
   - 保存

---

## 6. 診斷命令 (Diagnostic Commands)

### 檢查後端日誌 (Render Dashboard)
```bash
# 即時監看日誌
tail -f /path/to/render/logs

# 搜尋特定訊息
grep "[GAS/BG]" /path/to/render/logs
grep "POST /api/login" /path/to/render/logs
grep "GET /api/data" /path/to/render/logs
```

### 檢查前端日誌 (瀏覽器 DevTools)
```javascript
// 篩選 GAS 相關日誌
console.log('%c[GAS]', 'color: red;', '恢復開始');

// 檢查 mainAppSection 狀態
console.log('mainAppSection:', mainAppSection);
console.log('display:', mainAppSection?.style.display);

// 檢查 Socket.IO 連線
console.log('socket.connected:', socket.connected);
```

### 強制恢復 (開發用)
```bash
# 清除本地快取並強制 GAS 恢復
curl -X POST "http://localhost:3000/api/gas-restore-force/Spe for u"
```

---

## 7. 已知問題與解決方案 (Known Issues)

### Issue #1: 登入後 30 秒內 gas_restore_ready 事件無反應
**根本原因**: 登入流程期間 mainAppSection 被隱藏；GAS 恢復完成時，前端已進入主應用，但事件處理器檢查到前端狀態不符而靜默返回。

**臨時解決**:
- 前端加入重試機制 (_bannerAutoRetry 每 30 秒重試一次)
- 使用者點擊「重新加載」按鈕

**根本解決**: (進行中)
- 將 GAS 恢復移至登入流程**前**
- 改變事件觸發時機，不依賴 Socket.IO

### Issue #2: Render 伺服器重啟後所有本地資料遺失
**根本原因**: Render free tier 使用短暫檔案系統；每次重啟 data/ 目錄內容全部遺失。

**設計考量**:
- GAS 是永久備份，登入時自動恢復 ✓
- 本地快取用於加速讀取，並非持久化存儲 ✓
- 若 GAS 恢復失敗 → 資料遺失 ✗

**長期解決**: 遷移至 Render Disk 或 PostgreSQL

### Issue #3: Socket.IO 連線不穩定，WebSocket 初始連線失敗
**根本原因**: Render 跨域連線延遲；Browser 與 Render 伺服器間的 WebSocket 握手失敗。

**臨時解決**:
- 自動重試 (Socket.IO 內建)
- 監控連線狀態日誌

**測試連線**:
```javascript
socket.on('connect', () => console.log('✓ 已連線'));
socket.on('disconnect', () => console.log('✗ 連線中斷'));
socket.on('connect_error', (err) => console.log('✗ 連線錯誤:', err));
```

---

## 8. 開發工作流 (Development Workflow)

### 新增功能步驟

1. **前端新增功能** (script.js + index.html)
   ```bash
   python app.py  # 啟動本地伺服器
   # 在瀏覽器開啟 http://localhost:3000 測試
   # F12 → Console 檢查日誌
   ```

2. **後端新增端點** (app.py)
   ```bash
   # 新增 /api/new-endpoint
   # 在 script.js 呼叫: fetch('/api/new-endpoint')
   # 本地測試
   curl http://localhost:3000/api/new-endpoint
   ```

3. **GAS 同步測試**
   - 本地資料存入 GAS: POST /api/save
   - 清除本地快取: rm data/<user_id>.json
   - 重新登入測試自動恢復

4. **版本更新**
   - 修改 `index.html` 行 133 版本號 (格式: YYYY.MM.DDx)
   - 提交 commit
   - 推送至 Render 自動部署

---

## 9. 部署步驟 (Deployment)

### 推送至 Render (自動)
```bash
git add .
git commit -m "Fix: GAS restoration retry logic"
git push origin main
# Render 自動檢測並重新部署
```

### 檢查部署狀態
- Render Dashboard → 應用程式 → Deploys
- 確認最新版本號與預期相符

### 驗證部署成功
```bash
# 1. 檢查應用程式是否運行
curl https://special-education-curriculum.onrender.com

# 2. 檢查 API 是否可用
curl https://special-education-curriculum.onrender.com/api/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# 3. 檢查後端日誌中是否有部署通知
# Render Dashboard → Logs
```

---

## 10. 檔案結構 (File Structure)

```
特教課表 Special Education Curriculum/
├── app.py                      # Flask 後端主應用
├── index.html                  # 前端 UI
├── script.js                   # 前端邏輯（課程、拖放、Socket.IO）
├── index.css                   # 樣式表
├── requirements.txt            # Python 依賴
├── build_exe.ps1              # 打包 exe 腳本
├── gas_script.gs              # Google Apps Script (複製至 GAS 編輯器)
├── data/                      # 本地使用者資料 (JSON) - 短暫儲存
│   └── <user_id>.json
└── CLAUDE.md                  # 本專案指南
```

---

## 11. 聯繫與反饋 (Support)

### 報告問題
1. 啟用「Preserve log」，重現問題
2. 截圖前端控制台日誌
3. 提供 Render 後端日誌 (搜尋 [GAS/BG] 或 POST /api/login)
4. 提供操作步驟與預期結果

### 常見問題 (FAQ)

**Q: 為什麼登入後等待很久才加載課表？**
A: GAS 可能因冷啟動而延遲。確保:
- GAS 設定了 keepAlive 觸發器
- Render 環境變數 GAS_WEBHOOK_URL 正確
- 後端日誌顯示 "pull_from_gas returned" 訊息

**Q: 若使用者資料永久遺失怎麼辦？**
A: 根本原因是 GAS 恢復失敗。恢復步驟:
- 檢查 GAS Sheet 是否有資料
- 檢查 GAS 是否有過期 OAuth token
- 使用 "強制恢復" 端點: POST /api/gas-restore-force/<user_id>

**Q: 本地開發與生產環境有什麼差異？**
A: 本地:
- `data/` 為永久資料夾 (開發機上)
- GAS 仍為備份，但優先用本地快取

生產 (Render):
- `data/` 每次重啟丟失
- GAS 恢復為必須 (唯一持久化儲存)

---

**最後更新**: 2026-04-21 (v2026.04.21d)
**文件版本**: 2.0 (完整架構與故障排查指南)
