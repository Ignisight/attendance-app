/**
 * =============================================
 * Google Attendance System — Automated Setup
 * =============================================
 * 
 * This script automates the entire Google setup:
 * 1. Creates a Google Form template (no questions, collect email, limit 1 response)
 * 2. Creates a Roll Map Google Sheet
 * 3. Creates a Google Drive folder for sessions
 * 4. Creates & deploys a Google Apps Script project
 * 5. Updates config.ts with the deployed URL
 * 
 * HOW TO RUN:
 *   1. Go to https://console.cloud.google.com
 *   2. Create a new project (or select existing)
 *   3. Enable these APIs: Google Forms API, Google Sheets API, Google Drive API, Apps Script API
 *   4. Create OAuth 2.0 credentials (Desktop App type)
 *   5. Download the credentials JSON → save as "credentials.json" in this folder
 *   6. Run: node setup.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');

// ==========================================
// CONFIG
// ==========================================
const CREDENTIALS_FILE = path.join(__dirname, 'credentials.json');
const TOKEN_FILE = path.join(__dirname, 'token.json');
const CONFIG_FILE = path.join(__dirname, 'src', 'config.ts');

const SCOPES = [
    'https://www.googleapis.com/auth/forms',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/script.projects',
    'https://www.googleapis.com/auth/script.deployments',
];

// ==========================================
// MAIN
// ==========================================
async function main() {
    console.log('\n🚀 Attendance System — Automated Setup\n');

    // 1. Load credentials
    if (!fs.existsSync(CREDENTIALS_FILE)) {
        console.log('❌ credentials.json not found!\n');
        console.log('Follow these steps to get it:');
        console.log('  1. Go to https://console.cloud.google.com');
        console.log('  2. Create/select a project');
        console.log('  3. Go to "APIs & Services" → "Enabled APIs"');
        console.log('     Enable: Google Forms API, Google Sheets API, Google Drive API, Apps Script API');
        console.log('  4. Go to "APIs & Services" → "Credentials"');
        console.log('  5. Click "+ CREATE CREDENTIALS" → "OAuth client ID"');
        console.log('  6. Application type: "Desktop app"');
        console.log('  7. Download JSON → save as "credentials.json" in:');
        console.log(`     ${__dirname}`);
        console.log('\n  Then re-run: node setup.js\n');
        process.exit(1);
    }

    const creds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
    const { client_id, client_secret, redirect_uris } = creds.installed || creds.web || {};

    if (!client_id || !client_secret) {
        console.log('❌ Invalid credentials.json format');
        process.exit(1);
    }

    // 2. Get access token
    const token = await getAccessToken(client_id, client_secret);
    console.log('✅ Authenticated with Google\n');

    // 3. Create Drive folder
    console.log('📁 Creating Drive folder...');
    const folderId = await createDriveFolder(token);
    console.log(`   Folder ID: ${folderId}\n`);

    // 4. Create Google Form template
    console.log('📋 Creating Google Form template...');
    const formId = await createFormTemplate(token);
    console.log(`   Form ID: ${formId}\n`);

    // Move form to folder
    await moveToFolder(token, formId, folderId);
    console.log('   ✓ Moved form to folder\n');

    // 5. Create Roll Map Sheet
    console.log('📊 Creating Roll Map Sheet...');
    const rollMapSheetId = await createRollMapSheet(token);
    console.log(`   Sheet ID: ${rollMapSheetId}\n`);

    // Move sheet to folder
    await moveToFolder(token, rollMapSheetId, folderId);
    console.log('   ✓ Moved sheet to folder\n');

    // 6. Create Apps Script project
    console.log('⚡ Creating Apps Script project...');
    const { scriptId, webAppUrl } = await createAppsScript(token, formId, rollMapSheetId, folderId);
    console.log(`   Script ID: ${scriptId}`);
    console.log(`   Web App URL: ${webAppUrl}\n`);

    // 7. Update config.ts
    console.log('⚙️  Updating config.ts...');
    updateConfig(webAppUrl);
    console.log('   ✓ config.ts updated\n');

    // 8. Summary
    console.log('═══════════════════════════════════════');
    console.log('   ✅ SETUP COMPLETE!');
    console.log('═══════════════════════════════════════\n');
    console.log('  Form ID:       ', formId);
    console.log('  Roll Map Sheet:', rollMapSheetId);
    console.log('  Folder ID:     ', folderId);
    console.log('  Script ID:     ', scriptId);
    console.log('  Web App URL:   ', webAppUrl);
    console.log('\n  📱 Next: Run the app with "npx expo start"');
    console.log('  📱 Or build APK: "npx -y eas-cli build -p android --profile preview"\n');
}

// ==========================================
// AUTH — Local OAuth2 flow (opens browser)
// ==========================================
async function getAccessToken(clientId, clientSecret) {
    // Check for cached token
    if (fs.existsSync(TOKEN_FILE)) {
        const cached = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
        if (cached.access_token && cached.expiry && Date.now() < cached.expiry) {
            return cached.access_token;
        }
        // Try refresh
        if (cached.refresh_token) {
            try {
                const refreshed = await refreshToken(clientId, clientSecret, cached.refresh_token);
                return refreshed;
            } catch (e) {
                // Fall through to re-auth
            }
        }
    }

    // Local redirect URI
    const REDIRECT_PORT = 3847;
    const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(SCOPES.join(' '))}` +
        `&access_type=offline` +
        `&prompt=consent`;

    console.log('🔐 Opening browser for Google sign-in...\n');
    console.log('   If the browser doesn\'t open, visit this URL:\n');
    console.log(`   ${authUrl}\n`);

    // Open browser
    const { exec } = require('child_process');
    exec(`start "" "${authUrl}"`);

    // Wait for callback
    const code = await new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
            const code = url.searchParams.get('code');
            if (code) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('<html><body style="background:#0f172a;color:#22c55e;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0"><h1>✅ Authenticated! You can close this tab.</h1></body></html>');
                server.close();
                resolve(code);
            } else {
                res.writeHead(400);
                res.end('Missing code parameter');
            }
        });
        server.listen(REDIRECT_PORT, () => {
            console.log('   Waiting for sign-in...');
        });
        server.on('error', reject);
    });

    // Exchange code for token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
        }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
        throw new Error(`Token error: ${tokenData.error_description || tokenData.error}`);
    }

    // Cache token
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expiry: Date.now() + (tokenData.expires_in * 1000) - 60000,
    }, null, 2));

    return tokenData.access_token;
}

async function refreshToken(clientId, clientSecret, refreshTok) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshTok,
            grant_type: 'refresh_token',
        }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    fs.writeFileSync(TOKEN_FILE, JSON.stringify({
        access_token: data.access_token,
        refresh_token: refreshTok,
        expiry: Date.now() + (data.expires_in * 1000) - 60000,
    }, null, 2));

    return data.access_token;
}

// ==========================================
// Google Drive — Create Folder
// ==========================================
async function createDriveFolder(token) {
    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: 'Attendance Sessions',
            mimeType: 'application/vnd.google-apps.folder',
        }),
    });
    const data = await res.json();
    if (data.error) throw new Error(JSON.stringify(data.error));
    return data.id;
}

async function moveToFolder(token, fileId, folderId) {
    // Get current parents
    const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    const fileData = await getRes.json();
    const previousParents = (fileData.parents || []).join(',');

    // Move to new folder
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${folderId}&removeParents=${previousParents}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
    });
}

// ==========================================
// Google Forms — Create Template
// ==========================================
async function createFormTemplate(token) {
    // Create form
    const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            info: {
                title: 'Attendance',
                documentTitle: 'Attendance',
            },
        }),
    });
    const form = await createRes.json();
    if (form.error) throw new Error(JSON.stringify(form.error));
    const formId = form.formId;

    // Update form description and settings
    await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            requests: [
                {
                    updateFormInfo: {
                        info: {
                            description: 'Submit to mark your attendance',
                        },
                        updateMask: 'description',
                    },
                },
                {
                    updateSettings: {
                        settings: {
                            quizSettings: {
                                isQuiz: false,
                            },
                        },
                        updateMask: 'quizSettings.isQuiz',
                    },
                },
            ],
        }),
    });

    console.log('   ⚠️  NOTE: You must manually enable these Form settings:');
    console.log(`      Open: https://docs.google.com/forms/d/${formId}/edit`);
    console.log('      Settings → Collect email addresses: ON');
    console.log('      Settings → Limit to 1 response: ON');
    console.log('      Settings → Restrict to organization users: ON');

    return formId;
}

// ==========================================
// Google Sheets — Create Roll Map
// ==========================================
async function createRollMapSheet(token) {
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            properties: {
                title: 'Roll Number Map',
            },
            sheets: [{
                properties: {
                    title: 'Sheet1',
                },
                data: [{
                    startRow: 0,
                    startColumn: 0,
                    rowData: [
                        {
                            values: [
                                { userEnteredValue: { stringValue: 'Email' } },
                                { userEnteredValue: { stringValue: 'RollNumber' } },
                            ],
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: 'student1@college.edu' } },
                                { userEnteredValue: { stringValue: '21ME001' } },
                            ],
                        },
                        {
                            values: [
                                { userEnteredValue: { stringValue: 'student2@college.edu' } },
                                { userEnteredValue: { stringValue: '21ME002' } },
                            ],
                        },
                    ],
                }],
            }],
        }),
    });
    const sheet = await createRes.json();
    if (sheet.error) throw new Error(JSON.stringify(sheet.error));
    return sheet.spreadsheetId;
}

// ==========================================
// Apps Script — Create & Deploy
// ==========================================
async function createAppsScript(token, templateFormId, rollMapSheetId, folderId) {
    // Read the Code.gs file
    const codeGsPath = path.join(__dirname, 'apps-script', 'Code.gs');
    let codeContent = fs.readFileSync(codeGsPath, 'utf8');

    // Replace placeholder IDs
    codeContent = codeContent.replace('YOUR_TEMPLATE_FORM_ID_HERE', templateFormId);
    codeContent = codeContent.replace('YOUR_ROLL_MAP_SHEET_ID_HERE', rollMapSheetId);
    codeContent = codeContent.replace('YOUR_FOLDER_ID_HERE', folderId);

    // Also save the updated Code.gs
    fs.writeFileSync(codeGsPath, codeContent, 'utf8');
    console.log('   ✓ Updated Code.gs with actual IDs');

    // Create Apps Script project
    const createRes = await fetch('https://script.googleapis.com/v1/projects', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            title: 'Attendance System API',
        }),
    });
    const project = await createRes.json();
    if (project.error) throw new Error(JSON.stringify(project.error));
    const scriptId = project.scriptId;

    // Upload the code
    const updateRes = await fetch(`https://script.googleapis.com/v1/projects/${scriptId}/content`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            files: [
                {
                    name: 'Code',
                    type: 'SERVER_JS',
                    source: codeContent,
                },
                {
                    name: 'appsscript',
                    type: 'JSON',
                    source: JSON.stringify({
                        timeZone: 'Asia/Kolkata',
                        dependencies: {},
                        exceptionLogging: 'STACKDRIVER',
                        runtimeVersion: 'V8',
                        webapp: {
                            executeAs: 'USER_DEPLOYING',
                            access: 'ANYONE_ANONYMOUS',
                        },
                        oauthScopes: [
                            'https://www.googleapis.com/auth/forms',
                            'https://www.googleapis.com/auth/spreadsheets',
                            'https://www.googleapis.com/auth/drive',
                            'https://www.googleapis.com/auth/script.external_request',
                        ],
                    }),
                },
            ],
        }),
    });
    const updateData = await updateRes.json();
    if (updateData.error) throw new Error(JSON.stringify(updateData.error));
    console.log('   ✓ Code uploaded to Apps Script');

    // Deploy as web app
    const deployRes = await fetch(`https://script.googleapis.com/v1/projects/${scriptId}/deployments`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            versionNumber: 1,
            manifestFileName: 'appsscript',
            description: 'Attendance System API v1',
        }),
    });
    const deployment = await deployRes.json();

    // Create a version first if deployment fails
    let webAppUrl = '';
    if (deployment.error) {
        // Create version first
        const versionRes = await fetch(`https://script.googleapis.com/v1/projects/${scriptId}/versions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ description: 'v1' }),
        });
        const version = await versionRes.json();

        // Try deployment again with version
        const retryRes = await fetch(`https://script.googleapis.com/v1/projects/${scriptId}/deployments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                versionNumber: version.versionNumber || 1,
                manifestFileName: 'appsscript',
                description: 'Attendance System API v1',
            }),
        });
        const retryData = await retryRes.json();
        if (retryData.error) {
            console.log('\n   ⚠️  Auto-deployment failed. Deploy manually:');
            console.log(`      Open: https://script.google.com/d/${scriptId}/edit`);
            console.log('      Click Deploy → New deployment → Web App');
            console.log('      Execute as: Me | Access: Anyone');
            console.log('      Copy the URL and paste into src/config.ts\n');
            webAppUrl = `MANUAL_DEPLOY_NEEDED_${scriptId}`;
        } else {
            webAppUrl = retryData.entryPoints?.find(e => e.entryPointType === 'WEB')?.url
                || `https://script.google.com/macros/s/${retryData.deploymentId}/exec`;
        }
    } else {
        webAppUrl = deployment.entryPoints?.find(e => e.entryPointType === 'WEB')?.url
            || `https://script.google.com/macros/s/${deployment.deploymentId}/exec`;
    }

    return { scriptId, webAppUrl };
}

// ==========================================
// Update config.ts
// ==========================================
function updateConfig(webAppUrl) {
    if (webAppUrl.startsWith('MANUAL_DEPLOY_NEEDED')) {
        console.log('   ⚠️  Skipping config update — manual deploy needed');
        return;
    }

    let config = fs.readFileSync(CONFIG_FILE, 'utf8');
    config = config.replace('YOUR_APPS_SCRIPT_WEB_APP_URL_HERE', webAppUrl);
    fs.writeFileSync(CONFIG_FILE, config, 'utf8');
}

// ==========================================
// RUN
// ==========================================
main().catch(err => {
    console.error('\n❌ Setup failed:', err.message || err);
    process.exit(1);
});
