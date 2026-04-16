# 📅 Gmail Leave Tracker — Chrome Extension

> Automatically count your leave days this year by scanning your Gmail inbox for leave-approval emails. Fully configurable subject keywords and sender filters.

---

## ✨ Features

- 🔍 Scans Gmail using the official Gmail API (read-only)  
- 📋 Fully configurable subject keyword list — update when HR changes the email format  
- 👤 Optional sender filter (e.g. only match emails from `hr@company.com`)  
- 🔢 Live badge count on the extension icon  
- 🕐 Shows last refreshed time in the popup  
- 💾 All settings stored locally in `chrome.storage.local`  
- 🔒 Read-only Gmail access — the extension never mutates your emails  

---

## 📥 Installation

### 1. Get the Code
You can get the extension code by downloading the ZIP or using Git:
- **Download ZIP**: Click the green **"<> Code"** button at the top of this GitHub repository and select **"Download ZIP"**. Extract the downloaded ZIP file to a folder on your computer.
- **Git Clone**: Run `git clone https://github.com/bdhamithkumara/Gmail-Leave-Tracker.git` in your terminal.

### 2. Add to Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** by clicking the toggle in the top-right corner.
3. Click the **"Load unpacked"** button that appears in the top-left.
4. Select the `Gmail-Leave-Tracker` folder you extracted/cloned in step 1.
5. The extension will now appear in your list! Pin it to your toolbar by clicking the puzzle piece icon 🧩 in Chrome.

> **Note:** To actually connect it to your Gmail, you must follow the Setup Guide below to create a Google Cloud Project and get an OAuth Client ID.

---

## 📁 File Structure

```
leave-tracker/
├── manifest.json         ← Extension config (Manifest V3)
├── background.js         ← Service worker (Gmail API logic)
├── popup.html            ← Extension popup UI
├── popup.js              ← Popup logic
├── options.html          ← Settings / Options page UI
├── options.js            ← Settings page logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## 🚀 Setup Guide (Step-by-Step)

### Step 1 — Create a Google Cloud Project

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **"New Project"**
3. Name it something like `leave-tracker-extension`
4. Click **Create** and wait for it to be ready

---

### Step 2 — Enable the Gmail API

1. In the left sidebar, go to **"APIs & Services" → "Library"**
2. Search for **"Gmail API"**
3. Click it, then click **"Enable"**

---

### Step 3 — Configure the OAuth Consent Screen

1. Go to **"APIs & Services" → "OAuth consent screen"**
2. Select **"External"** → Click **Create**
3. Fill in the required fields:
   - **App name**: `Leave Tracker`
   - **User support email**: your email
   - **Developer contact email**: your email
4. Click **"Save and Continue"**
5. On the **Scopes** screen, click **"Add or Remove Scopes"**
6. Search for `gmail.readonly` and add:
   ```
   https://www.googleapis.com/auth/gmail.readonly
   ```
7. Click **"Update"** → **"Save and Continue"**
8. On the **Test Users** screen, click **"+ Add Users"** and add your Gmail address
9. Click **"Save and Continue"** → **"Back to Dashboard"**

> ⚠️ **Important**: The app will stay in "Testing" mode. Only accounts you add as Test Users can use it. For personal use, this is perfectly fine.

---

### Step 4 — Create an OAuth 2.0 Client ID

1. Go to **"APIs & Services" → "Credentials"**
2. Click **"+ Create Credentials" → "OAuth client ID"**
3. Application type: select **"Chrome Extension"**
4. Name: `Leave Tracker Extension`
5. Under **"Item ID"**, you need your extension ID. See Step 5 first, then come back.

---

### Step 5 — Load the Extension (to get its ID)

*If you already followed the Installation section, you just need to grab the Extension ID:*
1. Open Chrome and navigate to `chrome://extensions`
2. Ensure **"Developer mode"** is enabled.
3. Find the "Gmail Leave Tracker" in your list of extensions.
4. Copy the **Extension ID** shown under the extension name.

   Example: `abcdefghijklmnopqrstuvwxyz123456`

---

### Step 6 — Finish Creating the OAuth Client ID

1. Go back to the Google Cloud Console → **"Create OAuth client ID"**
2. Paste your **Extension ID** into the "Item ID" field
3. Click **Create**
4. A dialog will appear with your **Client ID** — it looks like:
   ```
   123456789012-abcdefghijklmnop.apps.googleusercontent.com
   ```
5. Copy it

---

### Step 7 — Add the Client ID to the Extension

1. Open `manifest.json` in the `leave-tracker` folder
2. Find this line:
   ```json
   "client_id": "YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com"
   ```
3. Replace it with your actual Client ID:
   ```json
   "client_id": "123456789012-abcdefghijklmnop.apps.googleusercontent.com"
   ```
4. Save the file

---

### Step 8 — Reload & Test

1. Go back to `chrome://extensions`
2. Find "Gmail Leave Tracker" and click the **🔄 refresh icon** (reload)
3. Click the extension icon in the toolbar
4. Click **"Refresh Now"** — Chrome will ask you to sign in to Google
5. Grant permission → the extension will scan your Gmail and show your leave count!

---

## ⚙️ Configuring Keywords

### Opening Settings
- Click the extension icon → **"Configure Keywords & Senders"**
- Or right-click the extension icon → **"Options"**

### Default Subject Keywords
The extension comes with these defaults:
```
Leave Approved
Annual Leave Granted
Leave Request Approved
Your leave is approved
Casual Leave Approved
Sick Leave Approved
```

### Editing the List
- **Add**: Type a new keyword in the text box and click **Add** (or press Enter)
- **Edit**: Click directly on any keyword in the list and type your change
- **Delete**: Hover over any item and click the 🗑️ trash icon that appears
- **Save**: Always click **"Save Changes"** after editing

### Sender Filters (Optional)
Leave the sender list empty to match emails from anyone.  
Add HR/manager email addresses to narrow the results, e.g.:
```
hr@yourcompany.com
manager@yourcompany.com
```

---

## 🔑 Permissions Explained

| Permission | Why It's Needed |
|---|---|
| `identity` | To authenticate with your Google account securely via OAuth |
| `storage` | To save your keyword list and leave count locally on your device |
| `gmail.readonly` | Read-only access to search your Gmail — the extension **cannot** read email content, only metadata (subject, sender, date) |

---

## 🔧 Troubleshooting

### "Could not connect to background service"
- Go to `chrome://extensions`, find the extension, and click **"Service Worker"** → then **"Inspect"** to see console errors
- Try reloading the extension

### Count shows 0 but you have leave emails
- Check that the subject keywords exactly match your leave approval emails (case-insensitive match is used)
- Open the Options page and verify your keyword list
- Try adding partial keywords (e.g. just `"Approved"`) to test

### Authentication popup doesn't appear
- Make sure your Google account is added as a Test User in the OAuth consent screen (Step 3)
- Check that the Extension ID in the OAuth client matches your loaded extension ID

### Token expired errors
- The extension handles token refresh automatically
- If issues persist, go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions) and revoke the extension's access, then retry

---

## 🛠️ How the Gmail Search Works

The extension builds a Gmail search query like this:

```
subject:("Leave Approved" OR "Annual Leave Granted" OR "Sick Leave Approved")
after:2026/01/01 before:2027/01/01
from:(hr@company.com OR manager@company.com)
```

- It scans **all matching emails** (not just unread)  
- Each matching email = **1 leave day**  
- Results are limited to the **current calendar year**  
- Pagination is handled automatically (up to 100 emails per API request)

---

## 📝 Commit History

| Commit | Description |
|---|---|
| `feat: initial extension scaffold` | Created project structure with Manifest V3 |
| `feat: gmail api integration` | Added Gmail API search with OAuth2 via chrome.identity |
| `feat: popup ui` | Built popup with gradient header, animated count card, refresh button |
| `feat: options page` | Added configurable subject keywords and sender filter UI |
| `feat: badge count` | Extension icon badge shows live leave count |
| `feat: pagination support` | Handle Gmail API pagination for >100 results |
| `feat: token refresh handling` | Auto-retry with fresh token on 401 responses |
| `feat: storage persistence` | All config and results stored in chrome.storage.local |
| `feat: default subjects on install` | Seeds 6 default subject keywords on first install |
| `docs: add readme` | Complete setup guide with OAuth walkthrough |

---

## 📄 License

MIT — free to use, modify, and share for personal or company use.
