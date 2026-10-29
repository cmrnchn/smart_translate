# SmartTranslate

Scriptable app for bidirectional translation with optional conversation transcripts.

**New user on iPhone only?** See **[GET-STARTED-IPHONE.md](GET-STARTED-IPHONE.md)** — Scriptable install, no computer or Cursor required.

**Sending to a friend?** Copy **[SHIP-TO-FRIEND.txt](SHIP-TO-FRIEND.txt)** (add your DeepL key in the private message only — never commit it to git).

## Install (easiest — installer script)

1. On your iPhone, open the installer raw link in [`scripts/dist/LINKS.md`](scripts/dist/LINKS.md) (`install-smarttranslate.js`).
2. In **Scriptable**, create one new script (any name), paste the installer, and **run it once**.
3. Choose **Install SmartTranslate 1.2.0-standalone** (v1) or **Install SmartTranslate Pro 1.2.0-pro-standalone**. (The labels show the bundle version from `scripts/dist/`.)

The installer downloads the bundle, saves it as a real Scriptable script with the correct name, **removes itself**, and opens the app. Next time, run `SmartTranslate` or `SmartTranslatePro` directly from your script list.

### Generic installer for other scripts

[`scripts/ScriptInstall.js`](scripts/ScriptInstall.js) is a reusable installer — edit `INSTALLER.items` with any `scriptName` and download `url`, paste into Scriptable, run once. Rebuild preconfigured installers with `node tools/build-installer.mjs` (see `scripts/installers/*.json`).

## Install (manual — one script)

1. Open **Scriptable**.
2. Create one new script (any name, e.g. `SmartTranslate`).
3. Paste the entire contents of [`scripts/dist/SmartTranslate.js`](scripts/dist/SmartTranslate.js).
4. Run it and complete setup (DeepL key required).

For Pro, paste [`scripts/dist/SmartTranslatePro.js`](scripts/dist/SmartTranslatePro.js) instead.

Rebuild standalones after editing modular sources:

```bash
node tools/bundle.mjs
```

Run automated checks (bundler, installers, WebView HTML, blank-screen regression):

```bash
node tools/test-smarttranslate.mjs
```

## Install (modular — multiple scripts)

`importModule` only works if each dependency exists as its **own Scriptable script** with the **exact** name (no spaces, matching capitalization). Scriptable does **not** load modules from this git repo folder automatically.

### v1 (4 scripts)

Create these scripts and paste the matching `scripts/*.js` files:

1. `SmartTranslateShared`
2. `SmartTranslateConversation`
3. `SmartTranslateUI`
4. `SmartTranslate` ← run this one

### Pro (5 scripts)

1. `SmartTranslateShared`
2. `SmartTranslateConversation`
3. `SmartTranslateProKit`
4. `SmartTranslateUI`
5. `SmartTranslatePro` ← run this one

If any of these is missing (for example you only paste `SmartTranslate.js`), the app shows a **Missing Scriptable Modules** alert listing the exact script names it needs, then stops.

## Scripts

| Script | Role |
|--------|------|
| `scripts/dist/SmartTranslate.js` | **Recommended** — single-file v1 |
| `scripts/dist/SmartTranslatePro.js` | **Recommended** — single-file Pro |
| `SmartTranslateShared.js` | Shared config, iCloud storage, DeepL, TTS |
| `SmartTranslateConversation.js` | Conversation Mode engine |
| `SmartTranslateUI.js` | WebView screens (home, settings, prompts) |
| `SmartTranslate.js` | Modular v1 entry |
| `SmartTranslateProKit.js` | Pro intelligence + export |
| `SmartTranslatePro.js` | Modular Pro entry |

## v1 Menu (Quick screen)

Bottom tabs: **Quick** · **Talk**.

| Action | What it does |
|--------|----------------|
| Input box | Type or edit the text to translate |
| **Paste** | Fill the input from the clipboard |
| **Transcribe** | Speech → input box (edit before sending) |
| **Send** | Translate the current input → speak |
| **Dictate** | Speech → translate immediately → speak |
| **Copy** / **Share** | Copy or share the last translation |
| **Talk** | Two people, one phone: tap the mic to speak, **Switch** (or tap a panel) to change who is talking |
| **Library** | Past conversations |
| **Settings** | Languages, API keys, speech engine |

**People** and **Search** are Pro features; in v1 they show a "This is in Pro" note pointing to the Pro script. If the WebView fails, a native list menu shows Type / Paste / Transcribe / Send / Dictate / Talk / Settings.

One-shot modes do **not** save translation history.

### Talk (free)

Talk has one panel for **You** (your primary language) and one for **Them** (your conversation language). The panel marked **SPEAKING** is the person whose turn it is:

1. Tap the mic and speak. Dictation listens in that person's language.
2. DeepL translates it into the other person's language. The panel shows the original text and a **Means:** line with the translation.
3. The translation is read out loud with ElevenLabs if that is set up, otherwise with Apple speech.
4. The turn then passes to the other person. **Switch**, or tapping a panel, changes the speaker by hand. **Type** is the keyboard fallback.

Talk is kept in memory only and is not saved. Saved chats and People are Pro (the SmartTranslatePro script keeps its named-person sessions).

### Free vs Pro gating

Free = **Quick** + **Talk**. Pro = **Library**, **People**, **Search**.

Gating is a flag and ships **off**, because Pro is still free in the public installer. Nobody loses anything today. The flag resolves in this order:

1. The `SmartTranslatePro` script is always Pro.
2. `config.flags.proGating: true` turns the locks on for this device. In SmartTranslate, this is **Settings → Preview Free Tier**.
3. `config.flags.proGating: false` keeps this device unlocked.
4. Otherwise `PRO_GATING_ENABLED` in `SmartTranslateShared.js` decides. It is `false` today.

When the locks are on, Library, People and Search in the free script's top bar are dimmed and get a **PRO** tag. They can still be tapped and show a "This is in Pro" note. To turn gating on for everyone at launch, set `PRO_GATING_ENABLED = true` and run `node tools/bundle.mjs`.

## Pro Menu (lean)

| Action | What it does |
|--------|----------------|
| **Type** / **Paste** / **Dictate** | Quick actions: translate → speak |
| **Continue** | Resume an interrupted conversation (only shown when one exists) |
| **Library** | Search, favorites, browse, export |
| **People** | Profiles and past chats |
| **Conversation** | Multi-turn session + short save summary |
| **Settings** | Languages, API keys, speech |

Home stays open until you dismiss it. If the WebView fails, Pro falls back to a native list (**Translate ›** for Type / Paste / Dictate, then Conversation, Library, People, Settings). Post-session only shows a short summary + optional favorite.

**Not in lean Pro UI:** Timeline, Statistics, Learning, Voice Profiles menu, OpenAI summaries, memory prompts, long tag/purpose wizards.

## Storage (iCloud, local fallback)

Files live in Scriptable's iCloud Documents folder. If iCloud Drive is off for Scriptable, they are saved in Scriptable's local (on-device) Documents folder instead and do not sync.

```
SmartTranslate/
├── config.json
├── people.json
├── active_session.json
├── conversations/
│   └── session_<uuid>.json
└── exports/                    # Pro exports
    └── Person_sessionid.md
```

## Keychain

| Key | Purpose |
|-----|---------|
| `SMART_TRANSLATE_DEEPL_API_KEY` | DeepL (use `:fx` for free tier) |
| `SMART_TRANSLATE_ELEVENLABS_API_KEY` | Optional ElevenLabs TTS |

## Conversation Mode (v1 contract)

- Start / continue / end a session with a named person
- Optional title, context, notes (no automatic location)
- Each turn: capture → choose **Me** or **Person** → translate → **save** → speak
- Turns are written to `active_session.json` **before** speech
- After each turn: Continue / End / Pause
- History lists completed conversations
- Interrupted sessions resume from `active_session.json`

## Intentionally not included

Speaker diarization, embeddings / semantic vector search, SQLite, offline on-device models, always-on mic, audio archive, live custom chat UI.

## Translation behavior

DeepL two-pass: translate toward `defaultTarget`; if the source is already that language, translate to the other language in the pair (`primary` ↔ `conversation`).
