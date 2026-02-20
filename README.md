# QR Attendance System - Teacher App (v1.5.0)

This is the React Native (Expo) mobile application for the Android-based Teacher Attendance System.

### 📥 Download the App

Download the latest compiled **v1.5.0 APK directly onto your Android device** using the official Expo Cloud Build link:
👉 [Download Teacher APK (v1.5.0)](https://expo.dev/accounts/ignisight/projects/attendance-system/builds/7d45fc2d-09de-4f2c-9e83-2596c85908bd)

---

### v1.5.0 Features
- **Concurrent Master Sessions:** Effortlessly track multiple independent 10-minute sessions in the background simultaneously without them ever trampling on each other.
- **Smart GPS Bypass:** Completely handles Android High-Accuracy timeout bugs indoors, silently falling back to Wi-Fi triangulation to gracefully save attendance.
- **Location Bypassing:** Stripped rigid OS GPS blockers completely so every student’s submission will smoothly log without OS interference.
- **Google Lens Webview Defender:** Visually slaps Lens/WebView scanners with a bright red UI popup permanently enforcing "Open in Chrome".
- **Real-Time Visual Capping:** A pristine 10m limit visually enforced with automatic `🔴 End:` injection the second time expires locally without needing server pull-to-refresh resets.

### Requirements:
- Android 9.0+
- The server backend must be active (This builds targets your deployed Render node server).
