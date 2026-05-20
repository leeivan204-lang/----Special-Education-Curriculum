# 🔄 系統更新檢查清單

> ⚠️ **每次系統有功能更新或重大改動時，必須執行以下三項檢查**

---

## ✅ 1️⃣ 更新所有 .md 資料內容

確保文檔與實際功能同步，避免記錄不存在的功能或遺漏新增功能。

**檢查清單**:
- [ ] `CLAUDE.md` — 架構圖、功能說明、故障排查
- [ ] `README.md` — 使用說明、快速開始
- [ ] `CHANGELOG.md` — 版本更新日誌
- [ ] `/docs` 目錄所有文檔
- [ ] `/doc/test` 測試相關文檔

**方法**:
1. 逐一審視本次變更的功能
2. 刪除已移除或棄用的功能說明
3. 補充新增功能的詳細說明
4. 更新系統架構圖（若適用）
5. 更新故障排查章節

---

## 🔐 2️⃣ 設置 .env 隱私檔案存放區

保護 API key、密碼、Server Key 等敏感資訊，避免暴露在版本控制中。

**安全檢查清單**:
- [ ] 所有 API key 已從代碼中移除
- [ ] 敏感資訊改用環境變數引用 (`process.env.XXX`, `os.getenv('XXX')`)
- [ ] `.env.example` 已更新（顯示必填欄位，但不含實際值）
- [ ] `.gitignore` 包含 `.env` 和 `.env.local`
- [ ] 無敏感資訊在 commit 歷史中
- [ ] Render/部署環境的環境變數正確設置

**保護的環境變數範例**:
```
GAS_SERVER_KEY=xxx
ADMIN_PASSWORD=xxx
GOOGLE_CLIENT_ID=xxx
DATABASE_URL=xxx
API_SECRET_KEY=xxx
```

---

## 📅 3️⃣ 更新網頁介面的版本日期

讓使用者清楚知道目前使用的版本。

**更新位置**:

### 位置 1: `script.js` (~46 行)
```javascript
const VERSION_NUMBER = 'YYYY.MM.DDx';  // x = a/b/c (同日多次更新時遞增)
const VERSION_DATE = 'Mon DD, YYYY';
```

**範例**:
```javascript
const VERSION_NUMBER = '2026.05.20a';
const VERSION_DATE = 'May 20, 2026';
```

### 位置 2: `index.html` (~52 行)
```html
<p class="version-info" id="sidebar-version">vYYYY.MM.DDx</p>
```

**版本號規則**:
- 格式: `YYYY.MM.DD` + 後綴字母 (a → b → c...)
- 範例: 
  - `2026.05.20a` ← 5 月 20 日首次更新
  - `2026.05.20b` ← 同日第二次更新
  - `2026.05.21a` ← 隔日回到 a
- 每日重置字母

---

## 📋 執行步驟 (更新後)

```bash
# 1. 更新所有文檔
# (編輯 .md 檔案)

# 2. 檢查環境變數設置
# (驗證 .env 和 .gitignore)

# 3. 更新版本號
# (修改 script.js 和 index.html)

# 4. 提交變更
git add .
git commit -m "chore: Update version to 2026.05.20a"

# 5. 推送到 main
git push origin [branch]:main --force-with-lease

# 6. 驗證部署
# (檢查 Render Dashboard → Logs)
```

---

## ⚡ 快速檢查清單

- [ ] 所有 .md 文檔已更新並驗證無誤
- [ ] 無敏感資訊在代碼或 commit 中
- [ ] .env 環境變數已正確配置
- [ ] `script.js` 版本號已更新
- [ ] `index.html` 版本號已更新
- [ ] Git commit 訊息清晰
- [ ] Render 部署成功

---

**上次檢查**: 2026-05-20  
**下次預定**: 下次功能更新時
