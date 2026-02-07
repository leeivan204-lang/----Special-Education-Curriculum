# 更新日誌 - 2025-12-08

## 版本資訊
- **日期**: 2025-12-08
- **備份版本**: 20251208_1606
- **狀態**: 穩定版本

---

## 🎯 主要更新

### 總課表列印格式重構
**更新時間**: 14:00 - 16:00

#### 變更內容
1. **雙表格架構**
   - 新增 `.web-only` 表格（網頁顯示用）
   - 新增 `.print-only` 表格（列印專用）
   - 使用 CSS 控制顯示/隱藏

2. **列印佈局優化**
   - 欄位順序：星期五 → 星期一，節次在右
   - 2x2 Grid 佈局，從右到左填充
   - 使用 `direction: rtl` + `grid-auto-flow: row dense`
   - 區塊內文字保持 LTR 方向

3. **分頁控制**
   - 新增 `page-break-inside: avoid` 防止區塊跨頁
   - 新增 `break-inside: avoid` 防止表格列跨頁

#### 修改檔案
- `index.html` (L146-L178): 新增 print-only 表格結構
- `index.css` (L1637-L1672): 新增列印模式 CSS
- `script.js` (L1574-L1684): 更新 `renderMasterSchedule` 函數

---

### 分組管理資料修復
**更新時間**: 14:17 - 14:45

#### 問題描述
- 學生池顯示「所有學生已分配」但實際未分配
- 部分學生在分組資料中「消失」

#### 根本原因
1. `renderGroupingWorkspace` 初始化後未儲存到 localStorage
2. 舊的分組名稱（幽靈分組）殘留在 assignments 資料中
3. 資料結構驗證不完整

#### 解決方案
```javascript
// 1. 初始化後立即儲存
if (!assignments[courseId]) {
    assignments[courseId] = {};
    course.groups.forEach(g => assignments[courseId][g] = []);
    localStorage.setItem('assignments', JSON.stringify(assignments));
}

// 2. 清理幽靈分組
const assignedGroups = Object.keys(assignments[courseId]);
assignedGroups.forEach(g => {
    if (!course.groups.includes(g)) {
        delete assignments[courseId][g];
        needsCleanup = true;
    }
});
```

#### 修改檔案
- `script.js` (L848-L895): 更新 `renderGroupingWorkspace` 函數

---

### 語法錯誤修復
**更新時間**: 14:45

#### 問題
- IDE 報告 `script.js:2639` 語法錯誤
- 「必須是宣告或陳述式」

#### 原因
- `renderGroupingWorkspace` 函數的 `if` 區塊未正確閉合
- 缺少對應的 `}` 和 `else` 區塊

#### 解決
- 補齊缺失的大括號
- 恢復完整的 `else` 區塊邏輯

---

## 🐛 已修復的 Bug

1. ✅ 總課表列印格式異常（表格壓縮成細條）
2. ✅ 數學課程學生池顯示錯誤
3. ✅ 體育課程學生消失
4. ✅ script.js 語法錯誤
5. ✅ 分組資料結構損壞

---

## 🔧 技術改進

### 程式碼品質
- 新增詳細的 console.log 調試輸出
- 改善錯誤處理機制
- 新增資料驗證邏輯

### 效能優化
- 減少不必要的 DOM 操作
- 優化表格渲染邏輯

### 可維護性
- 函數職責更明確
- 註解更完整
- 程式碼結構更清晰

---

## 📝 已知限制

1. **瀏覽器相容性**
   - 列印功能在 Chrome/Edge 表現最佳
   - Firefox 可能有細微差異
   - Safari 未完整測試

2. **資料儲存**
   - 依賴 localStorage，有容量限制（約 5-10MB）
   - 清除瀏覽器資料會遺失所有內容

3. **列印佈局**
   - 依賴瀏覽器列印引擎
   - 不同瀏覽器可能有細微差異

---

## 🔜 未來改進方向

1. **資料匯出/匯入**
   - JSON 格式匯出
   - 從檔案匯入資料

2. **雲端同步**
   - 考慮整合雲端儲存
   - 多裝置同步

3. **進階功能**
   - 課表衝突檢測
   - 自動排課建議
   - 統計報表

---

## 📚 相關文件

- `BACKUP_SUMMARY_20251208_FINAL.md` - 完整備份總結
- `FEATURE_DOCUMENTATION_20251208.md` - 功能說明文件
- `BACKUP_LOG_20251208.md` - 備份歷史紀錄

---

**文件建立時間**: 2025-12-08 16:06  
**最後更新**: 2025-12-08 16:06
