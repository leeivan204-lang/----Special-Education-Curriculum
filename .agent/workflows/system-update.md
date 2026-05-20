---
description: 系統功能更新後的檢查與部署流程
---

扮演一位系統維護專家，依照以下步驟進行系統更新的完整檢查與驗證：

## STEP 1: 更新所有 .md 資料內容

**目的**: 確保文檔與實際功能同步，避免記錄不存在的功能或遺漏新增功能

**檢查清單**:
- [ ] `CLAUDE.md` — 系統架構圖、功能說明、故障排查指南
- [ ] `README.md` — 專案簡介、安裝與使用說明
- [ ] `CHANGELOG.md` — 版本更新日誌（記錄本次變更）
- [ ] `/docs` 目錄內所有文檔
- [ ] `/doc/test` 測試相關文檔

**執行方式**:
1. 逐一審視本次的功能變更清單
2. 刪除已移除或棄用功能的說明文字
3. 補充新增功能的詳細說明與範例
4. 更新系統架構圖（若涉及架構改動）
5. 更新故障排查章節（若有新的常見問題）
6. 確認所有內部連結與參考資料仍然有效

**驗證方式**: 
- 逐一開啟 .md 檔案，檢視變更是否準確反映實際代碼
- 確認沒有記錄已刪除的功能或函數
- 確認新增功能已有完整說明

---

## STEP 2: 設置 .env 隱私檔案存放區

**目的**: 保護 API key、密碼、Server Key 等敏感資訊，避免暴露在版本控制中

**安全檢查清單**:
- [ ] 所有 API key、密碼已從源代碼中移除
- [ ] 敏感資訊已改用環境變數引用 (`process.env.XXX` 或 `os.getenv('XXX')`)
- [ ] `.env.example` 已更新（顯示必填欄位，但不含實際值）
- [ ] `.gitignore` 包含 `.env` 和 `.env.local`
- [ ] 無敏感資訊在 git commit 歷史中
- [ ] Render/部署環境的環境變數正確設置

**需保護的環境變數**:
```
GAS_SERVER_KEY=xxx
ADMIN_PASSWORD=xxx
GOOGLE_CLIENT_ID=xxx
DATABASE_URL=xxx
API_SECRET_KEY=xxx
```

**驗證方式**:
- 搜尋代碼：確認無硬編碼的 API key 或密碼
- 檢查 `.env.example`：確認只包含欄位名，不含實際值
- 檢查 `.gitignore`：確認 `.env` 檔案被忽略
- 檢查 Render Dashboard：確認環境變數正確設置

---

## STEP 3: 更新網頁介面的版本日期

**目的**: 讓使用者清楚知道目前使用的版本，便於追蹤更新

**更新位置 1**: `script.js` (~46 行)
```javascript
const VERSION_NUMBER = 'YYYY.MM.DDx';  // x = a/b/c (同日多次更新時遞增)
const VERSION_DATE = 'Mon DD, YYYY';
```

**更新位置 2**: `index.html` (~52 行)
```html
<p class="version-info" id="sidebar-version">vYYYY.MM.DDx</p>
```

**版本號規則**:
- 格式: `YYYY.MM.DD` + 後綴字母 (a → b → c...)
- 範例: 
  - `2026.05.20a` ← 5 月 20 日首次更新
  - `2026.05.20b` ← 同日第二次更新
  - `2026.05.21a` ← 隔日回到 a
- **每日重置字母**

**驗證方式**:
- 檢查兩個檔案的版本號是否相同
- 確認日期格式與預期相符
- 檢查側邊欄版本顯示是否正確

---

## STEP 4: 提交與推送變更

**執行指令**:
```bash
# 1. 查看變更內容
git status

# 2. 提交所有變更
git add .
git commit -m "chore: Update version to YYYY.MM.DDx"
# 或依實際內容選擇更具體的訊息：
# "refactor: ..." (代碼重構)
# "feat: ..." (新功能)
# "fix: ..." (bug修復)
# "docs: ..." (文檔更新)

# 3. 推送到 main
git push origin [current-branch]:main --force-with-lease
```

**驗證方式**:
- 確認 commit 訊息清晰、描述準確
- 確認推送成功（無 error 訊息）

---

## STEP 5: 驗證部署成功

**驗證位置**: Render Dashboard → Logs

**檢查項目**:
- [ ] 部署已啟動（日誌顯示部署開始）
- [ ] 無 error 或 critical warning
- [ ] 應用程式已成功啟動（port 3000 或相應端口）
- [ ] 前端可正常訪問 (http://localhost:3000 或部署 URL)
- [ ] 版本號已更新至最新

**如發現問題**:
- 檢查 Render 日誌中的具體錯誤訊息
- 若為環境變數問題，檢查 Render Dashboard 環境變數設置
- 若為代碼語法問題，修復後重新 commit 與 push

---

## 快速檢查清單

在完成所有步驟後，確認以下項目：

- [ ] 所有 .md 文檔已更新並驗證無誤
- [ ] 無敏感資訊在代碼或 commit 中
- [ ] .env 環境變數已正確配置
- [ ] `script.js` 版本號已更新
- [ ] `index.html` 版本號已更新
- [ ] Git commit 訊息清晰且準確
- [ ] Render 部署成功（查看日誌確認）
- [ ] 應用程式可正常訪問
- [ ] 版本號在頁面上正確顯示

---

## 重要提醒

⚠️ **NEVER**:
- 提交 `.env` 檔案或包含敏感資訊的檔案
- 硬編碼 API key 或密碼
- 記錄已移除的功能（應在文檔中刪除，不是標記為「已棄用」）

✅ **ALWAYS**:
- 在更新文檔後仔細檢查拼寫和內容準確性
- 使用清楚的 git commit 訊息
- 驗證部署成功後再通知使用者

---

**工作流程狀態**: 初始化  
**最後更新**: 2026-05-20
