/**
 * 特教課表管理系統 - Google Apps Script 後端
 * =====================================================
 * 【部署前設定步驟】
 *
 * 1. 開啟此 Apps Script 專案
 * 2. 點擊左側「專案設定」(齒輪圖示) → 「指令碼屬性」→「新增屬性」，設定以下項目：
 *
 *    屬性名稱              | 值（範例）
 *    ----------------------|-----------------------------------------------
 *    ALLOWED_EMAILS        | teacher@gmail.com,admin@school.edu.tw
 *                          | （逗號分隔，留空則不限制 email）
 *    GOOGLE_CLIENT_ID      | 123456789-xxxx.apps.googleusercontent.com
 *                          | （與 script.js 中的 GOOGLE_CLIENT_ID 相同，可留空）
 *    SERVER_KEY            | 任意自訂密鑰，例如 my-secret-2026
 *                          | （與 Render 環境變數 GAS_SERVER_KEY 相同）
 *
 * 3. 點擊「部署」→「管理部署作業」→「新增部署」：
 *    - 類型：Web 應用程式
 *    - 執行身分：我（部署者）
 *    - 誰可以存取：所有人（Anyone）
 *    - 部署後複製 Web 應用程式網址，貼到 Render 環境變數 GAS_WEBHOOK_URL
 *
 * 4. 設定 Keepalive 觸發器（防止 GAS 冷啟動）：
 *    - 點擊左側「觸發器」(鬧鐘圖示)
 *    - 新增觸發器：函數 keepAlive、時間驅動、每 5 分鐘
 *
 * =====================================================
 */

// ===== 常數 =====
var SHEET_NAME = '課表資料';

// ===== 主要進入點 =====

/**
 * 處理 GET 請求（讀取使用者資料）
 * 呼叫方式：GET ?userId=XXX&idToken=YYY
 *         或 GET ?userId=XXX&serverKey=ZZZ  （後端伺服器使用）
 *         或 GET ?ping=1                    （保溫用，快速回應）
 */
function doGet(e) {
  // --- Ping / 保溫快速回應 ---
  if (e.parameter && e.parameter.ping) {
    return jsonResponse({ status: 'ok', ts: new Date().toISOString() });
  }

  var userId    = (e.parameter && e.parameter.userId)    ? e.parameter.userId    : null;
  var idToken   = (e.parameter && e.parameter.idToken)   ? e.parameter.idToken   : null;
  var serverKey = (e.parameter && e.parameter.serverKey) ? e.parameter.serverKey : null;

  // --- 身分驗證：Server Key 優先，其次 OAuth Token ---
  var auth = verifyAccess(idToken, serverKey);
  if (!auth.valid) {
    return jsonResponse({ success: false, status: 'error', error: '身分驗證失敗：' + auth.reason });
  }

  if (!userId || !isValidUserId(userId)) {
    return jsonResponse({ success: false, status: 'error', error: '無效的 userId' });
  }

  try {
    var data = readUserData(userId);
    if (data) {
      return jsonResponse({ success: true, status: 'success', data: data });
    } else {
      return jsonResponse({ success: true, status: 'success', data: null, message: '此 userId 尚無備份資料' });
    }
  } catch (err) {
    return jsonResponse({ success: false, status: 'error', error: '讀取失敗：' + err.toString() });
  }
}

/**
 * 處理 POST 請求（寫入使用者資料 / 雲端備份）
 * 請求 body 為 JSON 字串：{ userId, idToken, ...課表資料 }
 *                     或：{ userId, serverKey, ...課表資料 }
 */
function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, status: 'error', error: '無效的 JSON 格式' });
  }

  var idToken   = body.idToken   || null;
  var serverKey = body.serverKey || null;
  var userId    = body.userId    || null;

  // --- 身分驗證：Server Key 優先，其次 OAuth Token ---
  var auth = verifyAccess(idToken, serverKey);
  if (!auth.valid) {
    return jsonResponse({ success: false, status: 'error', error: '身分驗證失敗：' + auth.reason });
  }

  if (!userId || !isValidUserId(userId)) {
    return jsonResponse({ success: false, status: 'error', error: '無效的 userId' });
  }

  try {
    // 儲存前移除認證欄位（不寫入 Sheet）
    delete body.idToken;
    delete body.serverKey;
    writeUserData(userId, body);
    return jsonResponse({ success: true, status: 'success', message: '備份成功', timestamp: new Date().toISOString() });
  } catch (err) {
    return jsonResponse({ success: false, status: 'error', error: '寫入失敗：' + err.toString() });
  }
}

// ===== 保溫 Keepalive（設定時間觸發器每 5 分鐘執行一次）=====

/**
 * 保溫函數：設定時間觸發器後，每 5 分鐘自動執行，防止 GAS 冷啟動。
 * 設定方式：觸發器 → 新增 → 函數 keepAlive → 時間驅動 → 每 5 分鐘
 */
function keepAlive() {
  Logger.log('[keepAlive] ' + new Date().toISOString() + ' - GAS script is warm.');
  // 讀取一次 ScriptProperties 以確保服務被初始化（加速後續請求）
  PropertiesService.getScriptProperties().getProperty('SERVER_KEY');
}

// ===== 身分驗證 =====

/**
 * 統一身分驗證入口：Server Key 優先（後端伺服器使用），否則驗證 OAuth Token
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyAccess(idToken, serverKey) {
  // 方式一：Server Key（後端伺服器使用，不需 OAuth）
  if (serverKey) {
    var props = PropertiesService.getScriptProperties();
    var expectedKey = props.getProperty('SERVER_KEY') || '';
    if (!expectedKey) {
      // 尚未設定 SERVER_KEY → 為向下相容，允許通過（可在設定後啟用限制）
      return { valid: true, reason: 'no-key-configured' };
    }
    if (serverKey === expectedKey) {
      return { valid: true };
    }
    return { valid: false, reason: 'Server Key 錯誤' };
  }

  // 方式二：Google OAuth ID Token（前端使用者使用）
  return verifyToken(idToken);
}

/**
 * 呼叫 Google tokeninfo 端點驗證 ID token
 */
function verifyToken(idToken) {
  if (!idToken) {
    return { valid: false, reason: '未提供 token 或 serverKey' };
  }

  var props = PropertiesService.getScriptProperties();
  var expectedClientId = props.getProperty('GOOGLE_CLIENT_ID') || '';

  try {
    var url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + idToken;
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    if (resp.getResponseCode() !== 200) {
      return { valid: false, reason: 'tokeninfo 回應異常 (' + resp.getResponseCode() + ')' };
    }

    var payload = JSON.parse(resp.getContentText());

    if (!payload.exp || parseInt(payload.exp) < Math.floor(Date.now() / 1000)) {
      return { valid: false, reason: 'token 已過期' };
    }

    if (expectedClientId && payload.aud !== expectedClientId) {
      return { valid: false, reason: '無效的 audience' };
    }

    var allowedEmails = getAllowedEmails();
    if (allowedEmails.length > 0 && allowedEmails.indexOf(payload.email) === -1) {
      return { valid: false, reason: '此帳號未獲授權：' + payload.email };
    }

    return { valid: true, email: payload.email };

  } catch (err) {
    return { valid: false, reason: '驗證過程發生錯誤：' + err.toString() };
  }
}

function getAllowedEmails() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('ALLOWED_EMAILS') || '';
  return raw.split(',').map(function(e) { return e.trim(); }).filter(function(e) { return e !== ''; });
}

// ===== 資料讀寫 =====

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['userId', 'data', 'updatedAt']);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 120);
    sheet.setColumnWidth(2, 600);
    sheet.setColumnWidth(3, 180);
  }
  return sheet;
}

function readUserData(userId) {
  // 主要位置：「課表資料」單一工作表，以 userId 為主鍵（新架構）
  var sheet = getOrCreateSheet();
  var values = sheet.getDataRange().getValues();

  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === userId) {
      try {
        return JSON.parse(values[i][1]);
      } catch (err) {
        return null;
      }
    }
  }

  // 回溯相容：若「課表資料」找不到，嘗試讀取「以 userId 命名的分頁」
  // （舊架構：每個 userId 一個獨立分頁，每次備份 append 成一列）
  return readLegacyUserTab(userId);
}

/**
 * 讀取舊版格式：以 userId 命名的分頁，取最後一列的 JSON 內容
 * 支援多種欄位位置：最新資料通常在 B 欄（JSON 直接存入）或 E 欄（舊格式附 metadata）
 */
function readLegacyUserTab(userId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var legacySheet = ss.getSheetByName(userId);
  if (!legacySheet) return null;

  var lastRow = legacySheet.getLastRow();
  if (lastRow < 2) return null;  // 只有 header，沒有資料列

  // 讀取最後一列的所有欄位，掃描第一個可解析為 JSON 的儲存格
  var lastCol = Math.min(legacySheet.getLastColumn(), 10);
  var row = legacySheet.getRange(lastRow, 1, 1, lastCol).getValues()[0];

  for (var j = 0; j < row.length; j++) {
    var val = row[j];
    if (typeof val === 'string' && val.trim().length > 2 && val.trim().charAt(0) === '{') {
      try {
        var parsed = JSON.parse(val);
        // 驗證這看起來像使用者資料（有 courses/students/teachers 任一欄位）
        if (parsed && (parsed.courses || parsed.students || parsed.teachers || parsed.timestamp)) {
          Logger.log('[readLegacyUserTab] Found data for ' + userId + ' in col ' + (j+1) + ' of row ' + lastRow);
          return parsed;
        }
      } catch (err) {
        // 繼續嘗試下一欄
      }
    }
  }
  return null;
}

function writeUserData(userId, dataObj) {
  var sheet = getOrCreateSheet();
  var values = sheet.getDataRange().getValues();
  var now = new Date().toISOString();
  var jsonStr = JSON.stringify(dataObj);

  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === userId) {
      sheet.getRange(i + 1, 2).setValue(jsonStr);
      sheet.getRange(i + 1, 3).setValue(now);
      return;
    }
  }

  sheet.appendRow([userId, jsonStr, now]);
}

// ===== 工具函式 =====

function isValidUserId(userId) {
  return typeof userId === 'string' && userId.length >= 1 && userId.length <= 64 &&
    !/[\/\\<>]/.test(userId);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
