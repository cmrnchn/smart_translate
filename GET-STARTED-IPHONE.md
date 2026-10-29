# SmartTranslate — iPhone setup (no computer, no Cursor)

Give this page to anyone who only has an iPhone. They do **not** need a Mac, GitHub account, or Cursor.

**Time:** about 10 minutes the first time (mostly installing Scriptable and getting a free DeepL key).

---

## What you need

| Item | Required? | Notes |
|------|-----------|--------|
| iPhone (iOS) | Yes | iPad works too |
| Internet | Yes | To download the app and translate |
| [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) | Yes | Free from the App Store |
| [DeepL API key](https://www.deepl.com/your-account/keys) | Yes | Free tier is fine (key ends in `:fx`) |
| iCloud (signed in) | Recommended | Syncs conversations and settings. Without iCloud, SmartTranslate saves them on this iPhone only (Scriptable's local Documents folder). |

---

## Step 1 — Install Scriptable

1. On your iPhone, open the **App Store**.
2. Search for **Scriptable** (by Simon Støvring).
3. Tap **Get** / **Install** (the app is free).
4. Open **Scriptable** once so it can finish setup.

**App Store link:** https://apps.apple.com/app/scriptable/id1405459188

---

## Step 2 — Copy the SmartTranslate installer

The installer is a small script you paste into Scriptable **once**. It downloads SmartTranslate for you and then deletes itself.

### On iPhone (Safari)

1. Open **Safari** and go to this link:

   **https://raw.githubusercontent.com/CMRNCHN/smart_translate/cursor/scriptable-only-bundler/scripts/dist/install-smarttranslate.js**

2. Wait for the page to load (you will see JavaScript code).
3. Tap anywhere on the code, then **Select All** → **Copy**.

   *Tip: If “Select All” is hard to find, tap and hold until the text is selected, drag the handles to cover everything, then Copy.*

### On a computer (optional)

If copying on the phone is awkward, open the same link on a Mac/PC, copy the whole file, and **AirDrop** or **Messages** it to the iPhone. Then copy from Notes/Messages into Scriptable.

---

## Step 3 — Paste into Scriptable and run once

1. Open **Scriptable**.
2. Tap **+** (top right) to create a **new script**.
3. Name it anything (e.g. `Installer`) — this script will remove itself later.
4. **Delete** the default `// Your script goes here` text.
5. **Paste** the installer code you copied.
6. Tap the **▶ Run** button (bottom right).

---

## Step 4 — Choose which app to install

When the installer runs, pick one:

| Option | Best for |
|--------|----------|
| **SmartTranslate (v1)** | Translate, speak, and conversation mode |
| **SmartTranslate Pro** | Same plus library, people, and export features |

The installer will:

1. Download the app from GitHub  
2. Save it as **SmartTranslate** or **SmartTranslatePro** in your script list  
3. **Delete the installer** script  
4. Open the app you chose  

**Next time:** run **SmartTranslate** or **SmartTranslatePro** directly from Scriptable — not the installer.

---

## Step 5 — Add your DeepL API key (one time)

SmartTranslate needs a DeepL key to translate. You only enter it once; it stays in your iPhone Keychain.

**In the app:** open **Settings → API Keys** for the setup wizard. You can view masked keys, copy them back to the clipboard, replace them, test them, or open the DeepL / ElevenLabs sign-up pages.

**If a friend sent you a key in a private message:** paste that when the app asks.

**Otherwise:**
1. Get a free key: https://www.deepl.com/your-account/keys  
   - Sign up if needed.  
   - Free keys usually end with **`:fx`** — that is normal.
2. When SmartTranslate asks for your **DeepL API key**, paste the key and save.
3. You can change it later in the app: **Settings → API Keys**.

**Optional:** ElevenLabs voice — only if you want premium text-to-speech. Skip it and use Apple’s built-in voice.

---

## Step 6 — Use the app

Open **Scriptable** → tap **SmartTranslate** (or **SmartTranslatePro**) → **Run**.

From the home screen you can:

- **Type** or **Paste** text to translate and hear it spoken  
- **Dictate** with your voice  
- **Conversation** for back-and-forth with someone  
- **Settings** for languages and speech  

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| “Could not download” / network error | Check Wi‑Fi or cellular; try again. |
| Installer page won’t copy in Safari | Use a computer to copy the file and AirDrop it, or use **manual install** below. |
| DeepL key rejected | Make sure you copied the full key. Free keys end in `:fx`. |
| Script missing after install | Look in Scriptable for **SmartTranslate** or **SmartTranslatePro** (exact names). |
| “No file to import at SmartTranslateShared” | You used a modular file by mistake — use the **installer** or the **single-file** links below. |

### Manual install (if the installer fails)

1. Open Scriptable → **+** new script.  
2. Name it **SmartTranslate** (exactly).  
3. Paste the **entire** contents of one of these links, then Run:

   - **v1:** https://raw.githubusercontent.com/CMRNCHN/smart_translate/cursor/scriptable-only-bundler/scripts/dist/SmartTranslate.js  
   - **Pro:** https://raw.githubusercontent.com/CMRNCHN/smart_translate/cursor/scriptable-only-bundler/scripts/dist/SmartTranslatePro.js  

---

## Quick links (bookmark on your phone)

| What | Link |
|------|------|
| Scriptable (App Store) | https://apps.apple.com/app/scriptable/id1405459188 |
| DeepL API keys | https://www.deepl.com/your-account/keys |
| SmartTranslate installer | https://raw.githubusercontent.com/CMRNCHN/smart_translate/cursor/scriptable-only-bundler/scripts/dist/install-smarttranslate.js |
| SmartTranslate v1 (manual) | https://raw.githubusercontent.com/CMRNCHN/smart_translate/cursor/scriptable-only-bundler/scripts/dist/SmartTranslate.js |
| SmartTranslate Pro (manual) | https://raw.githubusercontent.com/CMRNCHN/smart_translate/cursor/scriptable-only-bundler/scripts/dist/SmartTranslatePro.js |

---

## Privacy note

- Your DeepL key is stored in **Scriptable Keychain** on your device.  
- Conversation data is stored in **iCloud** under the SmartTranslate folder when iCloud is enabled, otherwise in Scriptable's **local** Documents folder on this device.  
- Translation requests go to **DeepL’s servers** (and optionally ElevenLabs if you add that key).
