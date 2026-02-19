// =====================================================
// Attendance System — Self-Contained Apps Script
// NO Google Forms needed! This script IS the form.
// =====================================================
//
// SETUP (one-time, 2 minutes):
//   1. Go to script.google.com → New Project
//   2. Paste this entire code
//   3. Click Run → select "initialSetup" → Authorize
//   4. Deploy → New deployment → Web app
//      - Execute as: Me
//      - Who has access: Anyone
//   5. Copy the Web App URL → paste into the teacher app config.ts
//   Done!
//
// =====================================================

// Auto-created on first run
let SHEET_ID = '';

function getProps() { return PropertiesService.getScriptProperties(); }

// ==========================================
// INITIAL SETUP — Run this once manually
// ==========================================
function initialSetup() {
  // Create the main attendance sheet
  const ss = SpreadsheetApp.create('Attendance Records');
  const sheet = ss.getSheets()[0];
  sheet.setName('Attendance');
  sheet.getRange(1, 1, 1, 6).setValues([[
    'Email', 'Roll Number', 'Session Name', 'Date', 'Time', 'Timestamp'
  ]]);
  // Auto-size columns
  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 300);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 100);
  sheet.setColumnWidth(6, 200);
  // Bold header
  sheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#4285f4').setFontColor('white');
  
  // Create roll map sheet
  const rollSS = SpreadsheetApp.create('Roll Number Map');
  const rollSheet = rollSS.getSheets()[0];
  rollSheet.setName('RollMap');
  rollSheet.getRange(1, 1, 1, 2).setValues([['Email', 'RollNumber']]);
  rollSheet.getRange(2, 1, 2, 2).setValues([
    ['student1@college.edu', '21ME001'],
    ['student2@college.edu', '21ME002'],
  ]);
  rollSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#4285f4').setFontColor('white');
  rollSheet.setColumnWidth(1, 250);
  rollSheet.setColumnWidth(2, 120);

  // Save IDs
  const props = getProps();
  props.setProperty('SHEET_ID', ss.getId());
  props.setProperty('ROLL_MAP_ID', rollSS.getId());

  Logger.log('✅ Setup complete!');
  Logger.log('📊 Attendance Sheet: ' + ss.getUrl());
  Logger.log('📋 Roll Map Sheet: ' + rollSS.getUrl());
  Logger.log('');
  Logger.log('👉 Now add your student emails & roll numbers to the Roll Map sheet.');
  Logger.log('👉 Then Deploy this as a Web App and copy the URL to your teacher app.');
}

// ==========================================
// HTTP HANDLERS
// ==========================================

// GET = serve HTML form to students OR handle API calls
function doGet(e) {
  const action = e.parameter.action;
  
  if (action) {
    // API calls from teacher app
    if (action === 'getResponses') return jsonResponse(getResponses(e.parameter.sessionName));
    if (action === 'getStatus') return jsonResponse(getStatus());
    if (action === 'ping') return jsonResponse({ status: 'ok' });
    return jsonResponse({ error: 'Unknown action' });
  }
  
  // Serve attendance form to students
  return serveStudentForm();
}

// POST = handle form submissions OR API calls
function doPost(e) {
  try {
    const contentType = e.postData ? e.postData.type : '';
    
    // Form submission from student
    if (contentType.indexOf('application/x-www-form-urlencoded') >= 0) {
      return handleStudentSubmission(e);
    }
    
    // API call from teacher app (JSON)
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    if (action === 'startSession') return jsonResponse(startSession(data.sessionName));
    if (action === 'stopSession') return jsonResponse(stopSession());
    return jsonResponse({ error: 'Unknown action: ' + action });
    
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// STUDENT FORM — Served as HTML
// ==========================================

function serveStudentForm() {
  const session = getSessionState();
  const isActive = session && session.active;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Attendance</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: #0f172a;
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .card {
      background: #1e293b;
      border-radius: 20px;
      padding: 32px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 8px 32px rgba(99, 102, 241, 0.15);
      border: 1px solid #334155;
    }
    .icon { font-size: 48px; text-align: center; margin-bottom: 16px; }
    h1 { text-align: center; font-size: 24px; margin-bottom: 4px; }
    .session-name {
      text-align: center;
      color: #6366f1;
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 24px;
    }
    .closed-msg {
      text-align: center;
      color: #ef4444;
      font-size: 16px;
      padding: 20px 0;
    }
    .field {
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #cbd5e1;
      margin-bottom: 6px;
    }
    input[type="email"], input[type="text"] {
      width: 100%;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1.5px solid #334155;
      background: #0f172a;
      color: #f1f5f9;
      font-size: 16px;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus { border-color: #6366f1; }
    .note {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }
    .btn {
      width: 100%;
      padding: 16px;
      border: none;
      border-radius: 14px;
      background: #6366f1;
      color: white;
      font-size: 17px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 8px;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .success {
      text-align: center;
      padding: 20px 0;
    }
    .success .check { font-size: 64px; }
    .success h2 { color: #22c55e; margin: 12px 0 4px; }
    .success p { color: #94a3b8; font-size: 14px; }
    #error { color: #ef4444; text-align: center; margin-top: 12px; font-size: 14px; display: none; }
  </style>
</head>
<body>
  <div class="card">
    ${isActive ? \`
      <div class="icon">📋</div>
      <h1>Mark Attendance</h1>
      <div class="session-name">\${escapeHtml(session.sessionName)}</div>
      
      <form id="attendanceForm" onsubmit="return submitForm(event)">
        <div class="field">
          <label>College Email</label>
          <input type="email" id="email" name="email" required 
                 placeholder="yourname@college.edu"
                 pattern=".*@.*\\\\..*">
          <div class="note">Use your official college email</div>
        </div>
        
        <div class="field">
          <label>Full Name</label>
          <input type="text" id="name" name="name" required 
                 placeholder="Your full name">
        </div>
        
        <button type="submit" class="btn" id="submitBtn">✅ Submit Attendance</button>
        <div id="error"></div>
      </form>
      
      <div id="successMsg" style="display:none">
        <div class="success">
          <div class="check">✅</div>
          <h2>Attendance Recorded!</h2>
          <p>Your attendance has been marked for this session.</p>
        </div>
      </div>
    \` : \`
      <div class="icon">🚫</div>
      <h1>Attendance</h1>
      <div class="closed-msg">
        This attendance session is currently closed.<br><br>
        Please wait for your teacher to start a session.
      </div>
    \`}
  </div>

  ${isActive ? \`
  <script>
    function submitForm(e) {
      e.preventDefault();
      var btn = document.getElementById('submitBtn');
      var errDiv = document.getElementById('error');
      btn.disabled = true;
      btn.textContent = '⏳ Submitting...';
      errDiv.style.display = 'none';
      
      var email = document.getElementById('email').value.trim();
      var name = document.getElementById('name').value.trim();
      
      var formData = new URLSearchParams();
      formData.append('email', email);
      formData.append('name', name);
      formData.append('submit', 'true');
      
      fetch(window.location.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          document.getElementById('attendanceForm').style.display = 'none';
          document.getElementById('successMsg').style.display = 'block';
        } else {
          errDiv.textContent = data.error || 'Submission failed';
          errDiv.style.display = 'block';
          btn.disabled = false;
          btn.textContent = '✅ Submit Attendance';
        }
      })
      .catch(function(err) {
        errDiv.textContent = 'Network error. Please try again.';
        errDiv.style.display = 'block';
        btn.disabled = false;
        btn.textContent = '✅ Submit Attendance';
      });
      
      return false;
    }
  </script>
  \` : ''}
</body>
</html>`;
  
  return HtmlService.createHtmlOutput(html)
    .setTitle('Attendance')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==========================================
// HANDLE STUDENT SUBMISSION
// ==========================================

function handleStudentSubmission(e) {
  const params = e.parameter;
  const email = (params.email || '').trim().toLowerCase();
  const name = (params.name || '').trim();
  
  // Validate
  if (!email || !name) {
    return jsonResponse({ error: 'Email and name are required' });
  }
  
  // Check session is active
  const session = getSessionState();
  if (!session || !session.active) {
    return jsonResponse({ error: 'Session is closed' });
  }
  
  // Check for duplicate submission
  const sheetId = getProps().getProperty('SHEET_ID');
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName('Attendance');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase() === email && 
        data[i][2] === session.sessionName) {
      return jsonResponse({ error: 'You have already submitted for this session' });
    }
  }
  
  // Look up roll number
  const rollNumber = lookupRollNumber(email);
  
  // Get date/time
  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');
  
  // Append row
  sheet.appendRow([
    email,
    rollNumber,
    session.sessionName,
    dateStr,
    timeStr,
    now.toISOString()
  ]);
  
  return jsonResponse({ success: true, message: 'Attendance recorded' });
}

// ==========================================
// SESSION MANAGEMENT
// ==========================================

function getSessionState() {
  const state = getProps().getProperty('currentSession');
  return state ? JSON.parse(state) : null;
}

function setSessionState(state) {
  if (state) {
    getProps().setProperty('currentSession', JSON.stringify(state));
  } else {
    getProps().deleteProperty('currentSession');
  }
}

function startSession(sessionName) {
  if (!sessionName || sessionName.trim() === '') {
    return { error: 'Session name is required' };
  }
  
  // Verify sheet exists
  const sheetId = getProps().getProperty('SHEET_ID');
  if (!sheetId) {
    return { error: 'Run initialSetup() first from the script editor' };
  }
  
  setSessionState({
    sessionName: sessionName.trim(),
    startedAt: new Date().toISOString(),
    active: true,
  });

  // Get sheet URL
  let sheetUrl = '';
  try {
    sheetUrl = SpreadsheetApp.openById(sheetId).getUrl();
  } catch (e) {
    sheetUrl = 'https://docs.google.com/spreadsheets/d/' + sheetId;
  }

  return {
    success: true,
    sessionName: sessionName.trim(),
    sheetUrl: sheetUrl,
  };
}

function stopSession() {
  const session = getSessionState();
  setSessionState({ ...session, active: false });
  
  return {
    success: true,
    message: 'Session stopped',
    sessionName: session ? session.sessionName : 'unknown',
  };
}

function getStatus() {
  return { session: getSessionState() };
}

function getResponses(sessionFilter) {
  const sheetId = getProps().getProperty('SHEET_ID');
  if (!sheetId) return { error: 'Sheet not set up' };
  
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Attendance');
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return { success: true, headers: data[0] || [], responses: [], count: 0 };
    }
    
    const headers = data[0];
    const sessionCol = headers.indexOf('Session Name');
    const responses = [];
    
    for (let i = 1; i < data.length; i++) {
      if (sessionFilter && sessionCol >= 0 && data[i][sessionCol] !== sessionFilter) {
        continue;
      }
      const row = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = data[i][j];
      }
      responses.push(row);
    }
    
    return { success: true, headers: headers, responses: responses, count: responses.length };
  } catch (err) {
    return { error: err.toString() };
  }
}

// ==========================================
// ROLL NUMBER LOOKUP
// ==========================================

function lookupRollNumber(email) {
  try {
    const rollMapId = getProps().getProperty('ROLL_MAP_ID');
    if (!rollMapId) return 'NO MAP';
    
    const ss = SpreadsheetApp.openById(rollMapId);
    const data = ss.getSheets()[0].getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString().toLowerCase().trim() === email) {
        return data[i][1].toString();
      }
    }
    return 'NOT FOUND';
  } catch (err) {
    return 'LOOKUP ERROR';
  }
}
