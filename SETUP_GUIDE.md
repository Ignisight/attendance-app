# 🚀 Attendance System — Complete Setup Guide

Follow these steps **in order** to get the entire system working.

---

## Step 1: Create the Roll Map Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) → Create a **new blank spreadsheet**
2. Name it: **"Roll Number Map"**
3. In **Row 1**, add headers:
   | A | B |
   |---|---|
   | Email | RollNumber |
4. Fill in student data starting from Row 2:
   | Email | RollNumber |
   |---|---|
   | student1@college.edu | 21ME001 |
   | student2@college.edu | 21ME002 |
5. **Copy the Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/THIS_IS_THE_SHEET_ID/edit
   ```

---

## Step 2: Create the Google Form Template

1. Go to [Google Forms](https://forms.google.com) → Create a **new blank form**
2. Set the **title** to: `Attendance`
3. Set the **description** to: `Submit to mark your attendance`
4. **Delete all questions** — the form should have NO questions (submission = present)
5. Go to **Settings** (gear icon) and configure:
   - ✅ **Collect email addresses** → Yes
   - ✅ **Limit to 1 response** → Yes
   - ✅ **Requires sign in** → Yes
   - ✅ **Restrict to users in [your organization]** → Yes (if using Google Workspace)
6. **Copy the Form ID** from the URL:
   ```
   https://docs.google.com/forms/d/THIS_IS_THE_FORM_ID/edit
   ```

---

## Step 3: Create a Google Drive Folder

1. In Google Drive, create a new folder: **"Attendance Sessions"**
2. **Copy the Folder ID** from the URL:
   ```
   https://drive.google.com/drive/folders/THIS_IS_THE_FOLDER_ID
   ```

---

## Step 4: Deploy the Google Apps Script

1. Go to [Google Apps Script](https://script.google.com) → Create a **new project**
2. Name the project: **"Attendance System API"**
3. Delete the default code and paste the **entire contents** of:
   ```
   e:\AG\AttendanceSystem\apps-script\Code.gs
   ```
4. **Update the CONFIG** at the top of the file with your IDs:
   ```javascript
   const CONFIG = {
     TEMPLATE_FORM_ID: 'your_form_id_from_step_2',
     ROLL_MAP_SHEET_ID: 'your_sheet_id_from_step_1',
     FOLDER_ID: 'your_folder_id_from_step_3',
   };
   ```
5. Click **Deploy** → **New deployment**
6. Settings:
   - Type: **Web app**
   - Execute as: **Me** (your account)
   - Who has access: **Anyone**
7. Click **Deploy** → **Authorize access** → Allow all permissions
8. **Copy the Web App URL** (looks like `https://script.google.com/macros/s/.../exec`)

---

## Step 5: Configure the Teacher App

1. Open `e:\AG\AttendanceSystem\src\config.ts`
2. Replace `YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with the URL from Step 4:
   ```typescript
   export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/.../exec';
   ```
3. Optionally change the teacher PIN (default is `1234`):
   ```typescript
   export const TEACHER_PIN = '1234';
   ```

---

## Step 6: Run the App (Development)

```powershell
cd e:\AG\AttendanceSystem
npx expo start
```

Then scan the QR code with **Expo Go** on your Android phone, or press `a` to open in an Android emulator.

---

## Step 7: Build APK (Production)

### Option A: EAS Build (Recommended — Cloud Build)

```powershell
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure build
eas build:configure

# Build APK
eas build -p android --profile preview
```

> After the build completes (~10 min), download the `.apk` from the link provided.

### Option B: Local Build (No Expo Account Needed)

```powershell
# Create the Android build locally
npx expo prebuild --platform android
cd android
.\gradlew.bat assembleRelease
```

The APK will be at: `android\app\build\outputs\apk\release\app-release.apk`

---

## Step 8: Test the Full Flow

1. ✅ Open the app → Login with PIN `1234`
2. ✅ Enter a session name (e.g., "Test Session")
3. ✅ Tap "Start Attendance" → QR code appears
4. ✅ Scan QR with another phone → Google Form opens
5. ✅ Sign in with college Gmail → Submit
6. ✅ Check "View Responses" in app → student should appear
7. ✅ Check "Open Live Sheet" → Google Sheet should have all columns filled
8. ✅ Tap "Export Excel" → `.xlsx` file downloads
9. ✅ Wait for timer or tap "Terminate" → form stops accepting responses

---

## Troubleshooting

| Issue | Solution |
|---|---|
| "Connection Error" when starting session | Check that `APPS_SCRIPT_URL` in config.ts is correct |
| Form doesn't require sign-in | Re-check Form Settings → Require sign in → ON |
| Roll Number shows "NOT FOUND" | Add the student's email to the Roll Map sheet |
| Apps Script authorization error | Re-deploy and re-authorize permissions |
| QR code not scannable | Increase screen brightness, ensure phone camera can focus |
