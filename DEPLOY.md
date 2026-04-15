# 部署指南 — Render.com（免費）+ Google Sheet 備份

本專案採「Render 跑伺服器 + GAS 寫 Google Sheet 做永久備份」的雙層架構。
Render 免費方案 15 分鐘無流量會休眠，冷啟動時會自動從 GAS 還原資料，資料不會遺失。

---

## 一、準備工作（一次性）

### 1. 確認 GAS Webhook 可用
- Sheet：https://docs.google.com/spreadsheets/d/1WZoL4Z0uRXzvpJeDKl-s7rmU1KWOb4O3VjII1xvNX-w/edit
- 預設 Webhook URL 已寫入 `app.py`（`GAS_WEBHOOK_URL`）。
- 若日後要換 GAS，改環境變數 `GAS_WEBHOOK_URL` 即可，無需改程式碼。

### 2. 決定管理員密碼
- 之後在 Render Dashboard 設定環境變數 `ADMIN_PASSWORD`。
- 這組密碼用於「強制搶回編輯權」功能，請自行保管，不要提交到 Git。

---

## 二、推送程式碼到 GitHub

```bash
git add app.py script.js index.css index.html requirements.txt Procfile render.yaml DEPLOY.md
git commit -m "feat: add Render deployment + GAS sync + editor lock system"
git push origin claude/busy-ritchie
```

之後在 GitHub 上把 `claude/busy-ritchie` 合併到 `main`（或直接用此分支部署也可）。

---

## 三、Render.com 部署步驟

### 1. 註冊 / 登入
- 前往 https://render.com
- 用 GitHub 帳號登入（免費）

### 2. 建立 Web Service
- 右上角 **New +** → **Web Service**
- 選 **Build and deploy from a Git repository**
- 連接本專案的 GitHub repo
- Render 會自動偵測 `render.yaml`，一鍵套用設定

### 3. 設定環境變數（Secret）
在 Service 的 **Environment** 頁籤新增：

| Key | Value | 說明 |
|---|---|---|
| `ADMIN_PASSWORD` | （自訂強密碼） | 強制搶回編輯權的密碼 |
| `GAS_WEBHOOK_URL` | （可留空用預設） | 若要換新的 GAS 端點才填 |
| `RENDER` | `1` | 啟用 eventlet monkey_patch（若 Render 未自動注入此變數） |

> 註：Render 其實會自動注入 `RENDER=true`，但保險起見手動加上 `RENDER=1` 也可。

### 4. 部署
- 按 **Create Web Service**
- 等 2–5 分鐘建置完成
- 取得 URL，格式如：`https://special-ed-schedule.onrender.com`

### 5. 驗證
瀏覽器打開 URL，應看到登入頁。
用任一 `userId` 登入，測試：
- 新增課程 → F5 重新整理，資料仍在
- 打開第二個分頁登入同一 userId → 第二個分頁顯示「目前編輯者：分頁 A」並可申請編輯權

---

## 四、防止休眠（UptimeRobot）

Render 免費方案 15 分鐘無流量會休眠，冷啟動約 30–60 秒。
免費方案每月有 750 小時額度，24/7 恰好用完（720 小時），實務上仍建議每 10 分鐘 ping 一次以避免上課時遇到冷啟動。

### 步驟
1. 前往 https://uptimerobot.com 註冊
2. **Add New Monitor**
3. 設定：
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: Special Ed Schedule
   - **URL**: `https://special-ed-schedule.onrender.com/api/editor/status/_ping`
   - **Monitoring Interval**: 10 minutes
4. 儲存

---

## 五、提供給組內同事

把 Render 提供的網址（如 `https://special-ed-schedule.onrender.com`）分享給同事即可。

### 同事使用流程
1. 打開網址
2. 輸入共用的 `userId`（例如 `team-a`）
3. 系統自動從 GAS 還原該 userId 的最新備份
4. 最先登入者為「編輯者」，其餘為「檢視者」
5. 檢視者可按「申請編輯權」，編輯者同意後換手
6. 每次存檔會自動同步到 Google Sheet

### 管理員強制搶回
若編輯者卡住（斷線但 5 分鐘自動釋放前），任一裝置可按「管理員接管」→ 輸入 `ADMIN_PASSWORD`。

---

## 六、疑難排解

| 問題 | 對策 |
|---|---|
| 部署後 WebSocket 連不上 | 確認 `RENDER=1` 環境變數已設，或檢查 Logs 中 eventlet 是否成功載入 |
| 冷啟動後資料空白 | 確認 `GAS_WEBHOOK_URL` 可訪問；查看 Logs 中 `[GAS] Restore` 訊息 |
| 編輯者換手無反應 | 重新整理頁面；檢查 socket 是否斷線 |
| 想換 Render URL | Settings → Custom Domain（免費方案亦可用自己的網域） |

---

## 七、本機開發仍可用

部署到 Render 不影響本機使用，本機仍以 `python app.py` 啟動，資料存於 `data/` 資料夾。
兩邊資料透過 GAS 互通（如需同步，可各自以相同 userId 登入線上版）。
