/**
 * 特教課表管理系統 - Google Apps Script 後端
 * =====================================================
 * 【部署前設定步驟】
 *
 * 1. 開啟此 Apps Script 專案
 * 2. 點擊左側「專案設定」(齒輪圖示) → 「指令碼屬性」→「新增屬性」，設定以下兩項：
 *
 *    屬性名稱              | 值（範例）
 *    ----------------------|-----------------------------------------------
 *    ALLOWED_EMAILS        | teacher@gmail.com,admin@school.edu.tw
 *                          | （逗號分隔，只有這些 Google 帳號可存取資料）
 *    GOOGLE_CLIENT_ID      | 123456789-xxxx.apps.googleusercontent.com
 *                          | （與 script.js 中的 GOOGLE_CLIENT_ID 相同）
 *
 * 3. 點擊「部署」→「管理部署作業」→「新增部署」：
 *    - 類型：Web 應用程式
 *    - 執行身分：我（部署者）
 *    - 誰可以存取：所有人（Anyone）← 必須設為 Anyone 才能接收外部請求
 *    - 部署後複製 Web 應用程式網址，貼到 script.js 的 GAS_API_URL
 *
 * =====================================================
 */

// ===== 常數 =====
var SHEET_NAME = '課表資料';

// ===== 主要進入點 =====

/**
 * 處理 GET 請求（讀取使用者資料）
 * 呼叫方式：GET ?userId=XXX&idToken=YYY
 */
function doGet(e) {
  var userId = (e.parameter && e.parameter.userId) ? e.parameter.userId : null;
  var idToken = (e.parameter && e.parameter.idToken) ? e.parameter.idToken : null;

  // 身分驗證
  var auth = verifyToken(idToken);
  if (!auth.valid) {
    return jsonResponse({ success: false, error: '身分驗證失敗：' + auth.reason });
  }

  if (!userId || !isValidUserId(userId)) {
    return jsonResponse({ success: false, error: '無效的 userId' });
  }

  try {
    var data = readUserData(userId);
    return jsonResponse({ success: true, data: data });
  } catch (err) {
    return jsonResponse({ success: false, error: '讀取失敗：' + err.toString() });
  }
}

/**
 * 處理 POST 請求（寫入使用者資料 / 雲端備份）
 * 請求 body 為 JSON 字串：{ userId, idToken, ...課表資料 }
 */
function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, error: '無效的 JSON 格式' });
  }

  var idToken = body.idToken || null;
  var userId  = body.userId  || null;

  // 身分驗證
  var auth = verifyToken(idToken);
  if (!auth.valid) {
    return jsonResponse({ success: false, error: '身分驗證失敗：' + auth.reason });
  }

  if (!userId || !isValidUserId(userId)) {
    return jsonResponse({ success: false, error: '無效的 userId' });
  }

  try {
    // 儲存前移除 idToken（不將 token 寫入 Sheet）
    delete body.idToken;
    writeUserData(userId, body);
    return jsonResponse({ success: true, message: '備份成功', timestamp: new Date().toISOString() });
  } catch (err) {
    return jsonResponse({ success: false, error: '寫入失敗：' + err.toString() });
  }
}

// ===== OAuth Token 驗證 =====

/**
 * 呼叫 Google tokeninfo 端點驗證 ID token
 * @param {string} idToken - 前端傳來的 Google ID Token (JWT)
 * @returns {{ valid: boolean, email?: string, reason?: string }}
 */
function verifyToken(idToken) {
  if (!idToken) {
    return { valid: false, reason: '未提供 token' };
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

    // 檢查 token 是否過期
    if (!payload.exp || parseInt(payload.exp) < Math.floor(Date.now() / 1000)) {
      return { valid: false, reason: 'token 已過期' };
    }

    // 驗證 audience（client_id）：防止其他應用的 token 被濫用
    if (expectedClientId && payload.aud !== expectedClientId) {
      return { valid: false, reason: '無效的 audience' };
    }

    // 驗證 email 是否在允許清單中
    var allowedEmails = getAllowedEmails();
    if (allowedEmails.length > 0 && allowedEmails.indexOf(payload.email) === -1) {
      return { valid: false, reason: '此帳號未獲授權：' + payload.email };
    }

    return { valid: true, email: payload.email };

  } catch (err) {
    return { valid: false, reason: '驗證過程發生錯誤：' + err.toString() };
  }
}

/**
 * 從指令碼屬性讀取允許存取的 email 清單
 * @returns {string[]}
 */
function getAllowedEmails() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('ALLOWED_EMAILS') || '';
  return raw.split(',').map(function(e) { return e.trim(); }).filter(function(e) { return e !== ''; });
}

// ===== 資料讀寫 =====

/**
 * 取得或建立資料 Sheet
 */
function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['userId', 'data', 'updatedAt']);
    sheet.setFrozenRows(1);
    // 設定欄寬
    sheet.setColumnWidth(1, 120);
    sheet.setColumnWidth(2, 600);
    sheet.setColumnWidth(3, 180);
  }
  return sheet;
}

/**
 * 讀取指定 userId 的資料
 * @param {string} userId
 * @returns {Object|null}
 */
function readUserData(userId) {
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
  return null; // 新使用者，無資料
}

/**
 * 寫入或更新指定 userId 的資料
 * @param {string} userId
 * @param {Object} dataObj
 */
function writeUserData(userId, dataObj) {
  var sheet = getOrCreateSheet();
  var values = sheet.getDataRange().getValues();
  var now = new Date().toISOString();
  var jsonStr = JSON.stringify(dataObj);

  // 找到已存在的列並更新
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === userId) {
      sheet.getRange(i + 1, 2).setValue(jsonStr);
      sheet.getRange(i + 1, 3).setValue(now);
      return;
    }
  }

  // 新使用者，新增一列
  sheet.appendRow([userId, jsonStr, now]);
}

// ===== 工具函式 =====

/**
 * 驗證 userId 格式（防止注入或異常輸入）
 * @param {string} userId
 * @returns {boolean}
 */
function isValidUserId(userId) {
  // 只允許長度 1-64 的字串，不允許路徑分隔符
  return typeof userId === 'string' && userId.length >= 1 && userId.length <= 64 &&
    !/[\/\\<>]/.test(userId);
}

/**
 * 回傳 JSON 格式的 ContentService 輸出
 * @param {Object} obj
 * @returns {ContentService.TextOutput}
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
