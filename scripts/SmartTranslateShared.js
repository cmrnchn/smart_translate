// SmartTranslateShared.js
//
// Shared config, storage, DeepL, Keychain, and TTS for SmartTranslate v1.
// Imported by SmartTranslate.js and SmartTranslateConversation.js.
//
// Version: 1.0.0

const APP_DIRECTORY = "SmartTranslate";
const CONFIG_FILE = "config.json";
const PEOPLE_FILE = "people.json";
const ACTIVE_SESSION_FILE = "active_session.json";
const CONVERSATIONS_DIRECTORY = "conversations";

const DEEPL_KEYCHAIN_KEY = "SMART_TRANSLATE_DEEPL_API_KEY";
const ELEVENLABS_KEYCHAIN_KEY = "SMART_TRANSLATE_ELEVENLABS_API_KEY";

const DEEPL_TIMEOUT = 15;
const ELEVENLABS_TIMEOUT = 30;

const MAX_INPUT_LENGTH = 5000;
const MAX_VOICE_RESULTS = 50;

const DEFAULT_CONFIG = {
  version: 1,
  languages: {
    primary: "EN-US",
    conversation: "ES",
    defaultTarget: "EN-US"
  },
  input: {
    dictationLanguage: "auto"
  },
  speech: {
    engine: "apple",
    apple: {
      rate: 0.45,
      pitch: 1.0
    },
    elevenlabs: {
      enabled: false,
      modelId: "eleven_multilingual_v2",
      voices: {}
    }
  }
};

const LANGUAGE_OPTIONS = [
  { code: "AR", name: "Arabic" },
  { code: "ZH", name: "Chinese (Simplified)" },
  { code: "NL", name: "Dutch" },
  { code: "EN-US", name: "English (US)" },
  { code: "EN-GB", name: "English (UK)" },
  { code: "FR", name: "French" },
  { code: "DE", name: "German" },
  { code: "HE", name: "Hebrew" },
  { code: "IT", name: "Italian" },
  { code: "JA", name: "Japanese" },
  { code: "KO", name: "Korean" },
  { code: "PL", name: "Polish" },
  { code: "PT-PT", name: "Portuguese" },
  { code: "PT-BR", name: "Portuguese (Brazil)" },
  { code: "RU", name: "Russian" },
  { code: "ES", name: "Spanish" },
  { code: "TR", name: "Turkish" },
  { code: "UK", name: "Ukrainian" }
];

// ============================================================
// iCLOUD STORAGE
// ============================================================

function getFileManager() {
  return FileManager.iCloud();
}

function getAppDirectory() {
  const fm = getFileManager();
  const directory = fm.joinPath(fm.documentsDirectory(), APP_DIRECTORY);
  if (!fm.fileExists(directory)) {
    fm.createDirectory(directory, true);
  }
  return directory;
}

function getConversationsDirectory() {
  const fm = getFileManager();
  const directory = fm.joinPath(getAppDirectory(), CONVERSATIONS_DIRECTORY);
  if (!fm.fileExists(directory)) {
    fm.createDirectory(directory, true);
  }
  return directory;
}

function resolveAppPath(filenameOrPath) {
  if (filenameOrPath.startsWith("/")) {
    return filenameOrPath;
  }
  return getFileManager().joinPath(getAppDirectory(), filenameOrPath);
}

async function ensureDownloaded(path) {
  const fm = getFileManager();
  if (!fm.fileExists(path)) {
    return false;
  }
  if (fm.isFileStoredIniCloud(path) && !fm.isFileDownloaded(path)) {
    await fm.downloadFileFromiCloud(path);
  }
  return true;
}

async function loadJSON(filenameOrPath) {
  const fm = getFileManager();
  const path = resolveAppPath(filenameOrPath);
  if (!(await ensureDownloaded(path))) {
    return null;
  }
  try {
    return JSON.parse(fm.readString(path));
  } catch {
    return null;
  }
}

async function saveJSON(filenameOrPath, value) {
  const fm = getFileManager();
  const path = resolveAppPath(filenameOrPath);
  const parent = path.substring(0, path.lastIndexOf("/"));
  if (parent && !fm.fileExists(parent)) {
    fm.createDirectory(parent, true);
  }
  fm.writeString(path, JSON.stringify(value, null, 2));
}

async function deleteFile(filenameOrPath) {
  const fm = getFileManager();
  const path = resolveAppPath(filenameOrPath);
  if (await ensureDownloaded(path)) {
    fm.remove(path);
  }
}

async function listConversationFiles() {
  const fm = getFileManager();
  const directory = getConversationsDirectory();
  if (fm.isFileStoredIniCloud(directory) && !fm.isFileDownloaded(directory)) {
    await fm.downloadFileFromiCloud(directory);
  }
  const names = fm.listContents(directory) || [];
  const paths = [];
  for (const name of names) {
    if (!name.endsWith(".json")) {
      continue;
    }
    const path = fm.joinPath(directory, name);
    await ensureDownloaded(path);
    paths.push(path);
  }
  return paths;
}

// ============================================================
// CONFIG
// ============================================================

async function loadConfig() {
  const stored = await loadJSON(CONFIG_FILE);
  if (!stored) {
    return null;
  }
  return deepMerge(DEFAULT_CONFIG, stored);
}

async function saveConfig(config) {
  await saveJSON(CONFIG_FILE, config);
}

// ============================================================
// KEYCHAIN
// ============================================================

function getRequiredKey(keychainKey, serviceName) {
  if (!Keychain.contains(keychainKey)) {
    throw new Error(
      `${serviceName} API key is missing.\n\nOpen Settings → API Keys to save it once.\nKeychain entry:\n${keychainKey}`
    );
  }
  const key = Keychain.get(keychainKey);
  if (!key || !key.trim()) {
    throw new Error(`${serviceName} API key is empty.`);
  }
  return key.trim();
}

function hasSecret(keychainKey) {
  if (!Keychain.contains(keychainKey)) {
    return false;
  }
  const key = Keychain.get(keychainKey);
  return !!(key && key.trim());
}

function getOptionalKey(keychainKey) {
  if (!hasSecret(keychainKey)) {
    return null;
  }
  return Keychain.get(keychainKey).trim();
}

function maskSecret(value) {
  const key = String(value || "").trim();
  if (!key) {
    return "(none)";
  }
  if (key.length <= 8) {
    return "••••";
  }
  return `••••${key.slice(-4)}`;
}

/**
 * Ensure a Keychain secret exists.
 * - If already saved: return it without prompting (unless forcePrompt).
 * - If missing: prompt once, save to Keychain, return it.
 */
async function ensureSecret(title, keychainKey, message, options = {}) {
  const forcePrompt = !!options.forcePrompt;
  const existing = getOptionalKey(keychainKey);

  if (existing && !forcePrompt) {
    return existing;
  }

  const value = await configureSecret(title, keychainKey, message, {
    allowKeepExisting: !!existing
  });
  if (value) {
    Keychain.set(keychainKey, value);
  }
  return value;
}

async function configureSecret(title, keychainKey, message, options = {}) {
  const existing = getOptionalKey(keychainKey) || "";
  const allowKeepExisting =
    options.allowKeepExisting !== undefined
      ? options.allowKeepExisting
      : !!existing;

  const alert = new Alert();
  alert.title = title;
  alert.message = existing
    ? `${message}\n\nSaved key: ${maskSecret(existing)}\nLeave the field blank and tap Keep Existing to reuse it.`
    : message;
  alert.addSecureTextField(
    existing ? "Paste new key to replace…" : "Paste API key here…",
    ""
  );
  alert.addAction(existing ? "Replace Key" : "Save Key");
  if (existing && allowKeepExisting) {
    alert.addAction("Keep Existing");
  }
  alert.addCancelAction("Cancel");

  const choice = await alert.presentAlert();
  if (choice === -1) {
    return null;
  }
  if (existing && allowKeepExisting && choice === 1) {
    return existing;
  }

  const newKey = alert.textFieldValue(0).trim();
  if (!newKey) {
    if (existing && allowKeepExisting) {
      return existing;
    }
    await showError(`${title} cannot be empty.`);
    return null;
  }
  // Do not Keychain.set here — callers that verify (saveApiKey) must write only after verify succeeds.
  return newKey;
}

// ============================================================
// API KEY WIZARD
// ============================================================

const API_KEY_SERVICES = {
  deepl: {
    id: "deepl",
    label: "DeepL",
    keychainKey: DEEPL_KEYCHAIN_KEY,
    required: true,
    signupUrl: "https://www.deepl.com/your-account/keys",
    hint: "Required for all translations. Free keys often end with :fx."
  },
  elevenlabs: {
    id: "elevenlabs",
    label: "ElevenLabs",
    keychainKey: ELEVENLABS_KEYCHAIN_KEY,
    required: false,
    signupUrl: "https://elevenlabs.io/app/settings/api-keys",
    hint: "Optional. Enables premium AI voices instead of Apple speech."
  }
};

function clearSecret(keychainKey) {
  if (typeof Keychain.remove === "function") {
    Keychain.remove(keychainKey);
    return;
  }
  Keychain.set(keychainKey, "");
}

function getApiKeyStatus() {
  const build = (service) => {
    const saved = hasSecret(service.keychainKey);
    const value = saved ? getOptionalKey(service.keychainKey) : null;
    return {
      id: service.id,
      label: service.label,
      keychainKey: service.keychainKey,
      signupUrl: service.signupUrl,
      hint: service.hint,
      required: !!service.required,
      saved,
      masked: saved ? maskSecret(value) : "(not set)",
      maskedLabel: saved ? `Saved ${maskSecret(value)}` : "Not set"
    };
  };

  return {
    deepl: build(API_KEY_SERVICES.deepl),
    elevenlabs: build(API_KEY_SERVICES.elevenlabs)
  };
}

function openApiKeySignup(serviceId) {
  const service = API_KEY_SERVICES[serviceId];
  if (!service?.signupUrl) {
    return;
  }
  Safari.open(service.signupUrl);
}

async function verifyDeepLKey(apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) {
    throw new Error("DeepL API key is empty.");
  }
  const host = key.endsWith(":fx")
    ? "https://api-free.deepl.com"
    : "https://api.deepl.com";
  const request = new Request(`${host}/v2/usage`);
  request.method = "GET";
  request.timeoutInterval = DEEPL_TIMEOUT;
  request.headers = { Authorization: `DeepL-Auth-Key ${key}` };
  await request.load();
  const status = request.response?.statusCode;
  if (status === 200) {
    return true;
  }
  throw new Error(`DeepL rejected the key (HTTP ${status}).`);
}

async function verifyElevenLabsKey(apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) {
    throw new Error("ElevenLabs API key is empty.");
  }
  await fetchElevenLabsVoices(key);
  return true;
}

async function verifyApiKey(serviceId, apiKey) {
  if (serviceId === "deepl") {
    return verifyDeepLKey(apiKey);
  }
  if (serviceId === "elevenlabs") {
    return verifyElevenLabsKey(apiKey);
  }
  throw new Error(`Unknown API key service: ${serviceId}`);
}

async function promptForSecureApiKey(service, options = {}) {
  const ui = getUIModule();
  if (ui?.presentSecurePrompt) {
    try {
      const value = await ui.presentSecurePrompt(
        `${service.label} API Key`,
        options.message ||
          `Paste your ${service.label} API key. It is stored in Scriptable Keychain on this iPhone only.`,
        "Paste API key here…"
      );
      if (value) {
        return value;
      }
      return null;
    } catch (error) {
      console.error(`Secure WebView prompt failed: ${error.message}`);
    }
  }

  return await configureSecret(
    `${service.label} API Key`,
    service.keychainKey,
    options.message ||
      `Paste your ${service.label} API key once. It stays in Scriptable Keychain.`,
    { allowKeepExisting: false }
  );
}

async function copySecretToClipboard(serviceId) {
  const service = API_KEY_SERVICES[serviceId];
  const key = getOptionalKey(service.keychainKey);
  if (!key) {
    await showError(`No ${service.label} key is saved.`);
    return false;
  }

  const shouldCopy = await confirm(
    `Copy ${service.label} Key`,
    `Copy the full API key to your clipboard?\n\nMasked: ${maskSecret(key)}\n\nOnly copy on a device you trust.`
  );
  if (!shouldCopy) {
    return false;
  }

  Pasteboard.copy(key);
  await showSuccess(
    "Copied",
    `${service.label} API key copied to clipboard.\n\nPaste it only where you need it, then clear your clipboard if you want.`
  );
  return true;
}

async function testSavedApiKey(serviceId) {
  const service = API_KEY_SERVICES[serviceId];
  const key = getOptionalKey(service.keychainKey);
  if (!key) {
    await showError(`No ${service.label} key is saved.`);
    return false;
  }

  try {
    await verifyApiKey(serviceId, key);
    await showSuccess(
      `${service.label} Key OK`,
      `Your saved ${service.label} key works.\n\nMasked: ${maskSecret(key)}`
    );
    return true;
  } catch (error) {
    await showError(
      `${service.label} Test Failed`,
      error?.message || "The saved key could not be verified."
    );
    return false;
  }
}

async function saveApiKey(serviceId, apiKey, options = {}) {
  const service = API_KEY_SERVICES[serviceId];
  const trimmed = String(apiKey || "").trim();
  if (!trimmed) {
    throw new Error(`${service.label} API key cannot be empty.`);
  }
  if (options.verify !== false) {
    await verifyApiKey(serviceId, trimmed);
  }
  Keychain.set(service.keychainKey, trimmed);
  return trimmed;
}

async function presentApiKeyDetailAction(serviceId) {
  const service = API_KEY_SERVICES[serviceId];
  const status = getApiKeyStatus()[serviceId];
  const ui = getUIModule();

  if (ui?.presentApiKeyDetail) {
    try {
      return await ui.presentApiKeyDetail(status);
    } catch (error) {
      console.error(`API key detail UI failed: ${error.message}`);
    }
  }

  const rows = [];
  if (status.saved) {
    rows.push(
      { id: "copy", title: "Copy Full Key", subtitle: status.masked, symbol: "doc.on.clipboard" },
      { id: "paste", title: "Replace Key", symbol: "pencil" },
      { id: "test", title: "Test Key", symbol: "checkmark.seal" },
      { id: "remove", title: "Remove Key", symbol: "trash" }
    );
  } else {
    rows.push({ id: "paste", title: "Paste API Key", symbol: "key" });
  }
  rows.push(
    { id: "signup", title: `Get ${service.label} Key`, symbol: "globe" },
    { id: "back", title: "Back", symbol: "chevron.left" }
  );

  return presentTableMenu({
    title: `${service.label} API Key`,
    subtitle: status.saved ? status.masked : "Not saved on this iPhone",
    sections: [{ rows }]
  });
}

async function runApiKeyServiceWizard(serviceId, options = {}) {
  const service = API_KEY_SERVICES[serviceId];
  const required = options.required ?? !!service.required;

  while (true) {
    const action = await presentApiKeyDetailAction(serviceId);
    if (!action || action === "back") {
      return hasSecret(service.keychainKey) ? getOptionalKey(service.keychainKey) : null;
    }

    if (action === "signup") {
      openApiKeySignup(serviceId);
      continue;
    }

    if (action === "copy") {
      await copySecretToClipboard(serviceId);
      continue;
    }

    if (action === "test") {
      await testSavedApiKey(serviceId);
      continue;
    }

    if (action === "remove") {
      const shouldRemove = await confirm(
        `Remove ${service.label} Key?`,
        "This deletes the saved key from Scriptable Keychain on this iPhone."
      );
      if (shouldRemove) {
        clearSecret(service.keychainKey);
        await showSuccess(
          "Key Removed",
          `${service.label} key removed from Keychain.`
        );
      }
      continue;
    }

    if (action === "paste") {
      const newKey = await promptForSecureApiKey(service, options);
      if (!newKey) {
        if (required) {
          await showError(`${service.label} key is required.`);
          continue;
        }
        return null;
      }

      try {
        await saveApiKey(serviceId, newKey);
        await showSuccess(
          `${service.label} Key Saved`,
          `Stored as ${maskSecret(newKey)} in Scriptable Keychain.\n\nKeychain entry:\n${service.keychainKey}`
        );
        return newKey;
      } catch (error) {
        await showError(
          `${service.label} Key Not Saved`,
          error?.message || "Could not verify the key."
        );
      }
    }
  }
}

async function runApiKeyWizard(options = {}) {
  const mode = options.mode || "hub";

  if (mode === "deepl") {
    return !!(await runApiKeyServiceWizard("deepl", {
      required: options.required !== false
    }));
  }

  if (mode === "elevenlabs") {
    const result = await runApiKeyServiceWizard("elevenlabs", {
      required: !!options.required
    });
    return result;
  }

  if (options.isFirstRun) {
    await showSuccess(
      "API Keys",
      "SmartTranslate stores API keys in Scriptable Keychain on your iPhone.\n\nDeepL is required. ElevenLabs is optional."
    );
  }

  while (true) {
    const status = getApiKeyStatus();
    const ui = getUIModule();
    let action = null;

    if (ui?.presentApiKeyWizardHub) {
      try {
        action = await ui.presentApiKeyWizardHub(status);
      } catch (error) {
        console.error(`API key hub UI failed: ${error.message}`);
      }
    }

    if (!action) {
      action = await presentTableMenu({
        title: "API Keys",
        subtitle: "Stored in Scriptable Keychain on this iPhone",
        sections: [
          {
            rows: [
              {
                id: "deepl_manage",
                title: "DeepL",
                subtitle: status.deepl.maskedLabel,
                symbol: "key"
              },
              {
                id: "eleven_manage",
                title: "ElevenLabs",
                subtitle: status.elevenlabs.maskedLabel,
                symbol: "key"
              },
              { id: "done", title: "Done", symbol: "checkmark.circle" }
            ]
          }
        ]
      });
    }

    if (!action || action === "done") {
      if (options.requireDeepL && !hasSecret(DEEPL_KEYCHAIN_KEY)) {
        await showError("DeepL key is required before you can translate.");
        continue;
      }
      return hasSecret(DEEPL_KEYCHAIN_KEY);
    }

    if (action === "deepl_manage" || action === "deepl") {
      await runApiKeyServiceWizard("deepl", { required: false });
      continue;
    }

    if (action === "eleven_manage" || action === "elevenlabs") {
      await runApiKeyServiceWizard("elevenlabs", { required: false });
      continue;
    }

    if (action === "deepl_signup") {
      openApiKeySignup("deepl");
      continue;
    }

    if (action === "eleven_signup") {
      openApiKeySignup("elevenlabs");
      continue;
    }
  }
}

// ============================================================
// DEEPL
// ============================================================

async function translateWithDeepL(text, apiKey, languages) {
  const initialTarget = languages.defaultTarget;
  const firstResult = await requestDeepLTranslation(text, initialTarget, apiKey);
  const detectedLanguage = firstResult.translations[0].detected_source_language;

  let finalTranslation = firstResult.translations[0].text;
  let finalTarget = initialTarget;

  if (
    normalizeLanguage(detectedLanguage) === normalizeLanguage(initialTarget)
  ) {
    const alternateTarget = getAlternateTarget(languages);
    if (
      alternateTarget &&
      normalizeLanguage(alternateTarget) !== normalizeLanguage(detectedLanguage)
    ) {
      const secondResult = await requestDeepLTranslation(
        text,
        alternateTarget,
        apiKey
      );
      finalTranslation = secondResult.translations[0].text;
      finalTarget = alternateTarget;
    }
  }

  return {
    translation: finalTranslation,
    detectedLanguage,
    targetLanguage: finalTarget
  };
}

async function requestDeepLTranslation(text, targetLanguage, apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) {
    throw new Error("DeepL API key is empty.");
  }

  const target = String(targetLanguage || "")
    .trim()
    .toUpperCase();
  if (!target) {
    throw new Error("DeepL target language is missing.");
  }

  // Prefer the host that matches the key type, but fall back if DeepL
  // says "Wrong endpoint" (common when Free vs paid host is mixed up).
  const primary = key.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
  const fallback = key.endsWith(":fx")
    ? "https://api.deepl.com/v2/translate"
    : "https://api-free.deepl.com/v2/translate";

  try {
    return await postDeepLTranslate(primary, text, target, key);
  } catch (error) {
    const message = String(error?.message || error);
    if (/wrong endpoint|404|403|Forbidden|Not Found/i.test(message)) {
      return await postDeepLTranslate(fallback, text, target, key);
    }
    throw error;
  }
}

async function postDeepLTranslate(url, text, targetLanguage, apiKey) {
  const request = new Request(url);
  request.method = "POST";
  request.timeoutInterval = DEEPL_TIMEOUT;
  request.headers = {
    Authorization: `DeepL-Auth-Key ${apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "SmartTranslate/1.1 (Scriptable)"
  };
  request.body = JSON.stringify({
    text: [text],
    target_lang: targetLanguage
  });

  let response;
  try {
    response = await request.loadJSON();
  } catch (error) {
    const status = request.response?.statusCode;
    throw new Error(
      formatDeepLError(
        status,
        null,
        `Could not parse DeepL response.${error?.message ? ` ${error.message}` : ""}`
      )
    );
  }

  const status = request.response?.statusCode;
  if (status && status >= 400) {
    throw new Error(formatDeepLError(status, response));
  }

  if (!response?.translations?.[0]?.text) {
    throw new Error(formatDeepLError(status, response, "DeepL returned no translation."));
  }

  return response;
}

function formatDeepLError(statusCode, response, fallbackMessage) {
  const apiMessage =
    response?.message ||
    response?.error ||
    response?.detail ||
    (typeof response === "string" ? response : null);

  if (statusCode === 403) {
    return (
      "DeepL rejected the API key (403).\n\n" +
      "Check Account → API Keys & Limits:\n" +
      "https://www.deepl.com/your-account/keys\n\n" +
      "Use an API plan key (not a normal Translator login).\n" +
      (apiMessage ? `\nDeepL: ${apiMessage}` : "")
    );
  }
  if (statusCode === 456) {
    return (
      "DeepL quota exceeded (456).\n\n" +
      "Your character limit is used up for this billing period." +
      (apiMessage ? `\n\nDeepL: ${apiMessage}` : "")
    );
  }
  if (statusCode === 400) {
    return (
      "DeepL rejected the request (400).\n\n" +
      "Often a bad target language code." +
      (apiMessage ? `\n\nDeepL: ${apiMessage}` : "")
    );
  }
  if (statusCode === 404 || /wrong endpoint/i.test(String(apiMessage || ""))) {
    return (
      "DeepL wrong endpoint (404).\n\n" +
      "Free keys (:fx) use api-free.deepl.com.\n" +
      "Paid/Developer keys use api.deepl.com." +
      (apiMessage ? `\n\nDeepL: ${apiMessage}` : "")
    );
  }

  const parts = [];
  if (statusCode) {
    parts.push(`HTTP ${statusCode}`);
  }
  if (apiMessage) {
    parts.push(String(apiMessage));
  } else if (fallbackMessage) {
    parts.push(fallbackMessage);
  } else {
    parts.push("DeepL returned an invalid response.");
  }
  return parts.join(" — ");
}

function getAlternateTarget(languages) {
  const { primary, conversation, defaultTarget } = languages;
  if (normalizeLanguage(primary) !== normalizeLanguage(defaultTarget)) {
    return primary;
  }
  if (normalizeLanguage(conversation) !== normalizeLanguage(defaultTarget)) {
    return conversation;
  }
  return null;
}

// ============================================================
// TTS
// ============================================================

function pauseMs(ms) {
  return new Promise((resolve) => {
    Timer.schedule(ms / 1000, false, () => {
      resolve();
    });
  });
}

function audioDataByteLength(audioData) {
  if (!audioData) {
    return 0;
  }
  if (typeof audioData.getBytes === "function") {
    try {
      const bytes = audioData.getBytes();
      return bytes?.length || 0;
    } catch (error) {
      return 0;
    }
  }
  if (typeof audioData.byteLength === "number") {
    return audioData.byteLength;
  }
  if (typeof audioData.toBase64String === "function") {
    try {
      return audioData.toBase64String().length > 0 ? 1 : 0;
    } catch (error) {
      return 0;
    }
  }
  return 0;
}

async function playMpegWithWebView(audioData) {
  if (typeof WebView === "undefined") {
    throw new Error("WebView is required to play ElevenLabs audio on Scriptable.");
  }
  if (typeof audioData.toBase64String !== "function") {
    throw new Error("ElevenLabs audio Data is missing toBase64String().");
  }
  const b64 = audioData.toBase64String();
  if (!b64) {
    throw new Error("Received empty audio data from ElevenLabs.");
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      background: #0b0b0f;
      color: #f5f5f7;
      font: 16px -apple-system, BlinkMacSystemFont, sans-serif;
    }
    audio { width: min(92vw, 420px); }
    button {
      font: 600 16px -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 12px 20px;
      border-radius: 12px;
      border: 0;
      background: #0a84ff;
      color: #fff;
    }
  </style>
</head>
<body>
  <p>Playing translation</p>
  <audio id="player" controls autoplay src="data:audio/mpeg;base64,${b64}"></audio>
  <button type="button" id="done">Done</button>
</body>
</html>`;

  const webView = new WebView();
  await webView.loadHTML(html);
  const dismissPromise = webView.present(false);
  await pauseMs(300);
  const resultPromise = webView.evaluateJavaScript(
    `(function () {
      var player = document.getElementById("player");
      var done = document.getElementById("done");
      function finish(reason) {
        completion(String(reason || "done"));
      }
      if (!player) {
        finish("missing");
        return;
      }
      player.addEventListener("ended", function () { finish("ended"); });
      player.addEventListener("error", function () { finish("error"); });
      if (done) {
        done.addEventListener("click", function () { finish("done"); });
      }
      try { player.play(); } catch (error) {}
    })();`,
    true
  );
  const result = await Promise.race([resultPromise, dismissPromise]);
  if (String(result) === "error") {
    throw new Error("WebView audio playback failed.");
  }
}

async function speakTranslation(text, targetLanguage, config) {
  if (
    config.speech.engine === "elevenlabs" &&
    config.speech.elevenlabs.enabled
  ) {
    const voice = config.speech.elevenlabs.voices[targetLanguage];
    if (voice?.voiceId) {
      try {
        const elevenLabsKey = getRequiredKey(
          ELEVENLABS_KEYCHAIN_KEY,
          "ElevenLabs"
        );
        await speakWithElevenLabs(text, voice.voiceId, elevenLabsKey, config);
        return;
      } catch (error) {
        console.error(
          `ElevenLabs failed: ${error.message}. Falling back to Apple speech.`
        );
        await showError(
          `ElevenLabs speech failed.

${error?.message || "Unknown error."}

Falling back to Apple speech.`
        );
      }
    }
  }
  await speakWithApple(text, targetLanguage, config);
}

async function speakWithApple(text, targetLanguage, config) {
  // Official API is Speech.speak(text) only (sync, no Promise). Rate/language
  // options are not documented; keep rate in config for ElevenLabs parity.
  Speech.speak(text);
  // Hold before callers re-present the home WebView over in-flight speech.
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const ms = Math.min(30000, Math.max(1500, words * 400 + 500));
  await pauseMs(ms);
}

async function speakWithElevenLabs(text, voiceId, apiKey, config) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
  const request = new Request(url);
  request.method = "POST";
  request.timeoutInterval = ELEVENLABS_TIMEOUT;
  request.headers = {
    "xi-api-key": apiKey,
    "Content-Type": "application/json",
    Accept: "audio/mpeg"
  };
  request.body = JSON.stringify({
    text,
    model_id: config.speech.elevenlabs.modelId
  });

  const audioData = await request.load();
  const status = request.response?.statusCode;
  if (status && status >= 400) {
    throw new Error(`ElevenLabs TTS failed (HTTP ${status}).`);
  }
  if (!audioData || audioDataByteLength(audioData) === 0) {
    throw new Error("Received empty audio data from ElevenLabs.");
  }

  await playMpegWithWebView(audioData);
}

async function fetchElevenLabsVoices(apiKey) {
  const request = new Request("https://api.elevenlabs.io/v1/voices");
  request.method = "GET";
  request.timeoutInterval = ELEVENLABS_TIMEOUT;
  request.headers = { "xi-api-key": apiKey };
  const response = await request.loadJSON();
  if (!response?.voices) {
    throw new Error("ElevenLabs returned an invalid voice list.");
  }
  return response.voices;
}

// ============================================================
// ONE-SHOT TRANSLATE
// ============================================================

async function runOneShot(text, config) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    await showError("Please enter some text to translate.");
    return null;
  }
  if (trimmed.length > MAX_INPUT_LENGTH) {
    await showError(
      `Input is too long.\n\nMaximum: ${MAX_INPUT_LENGTH.toLocaleString()} characters.`
    );
    return null;
  }

  try {
    const deeplKey = getRequiredKey(DEEPL_KEYCHAIN_KEY, "DeepL");
    const result = await translateWithDeepL(
      trimmed,
      deeplKey,
      config.languages
    );
    Script.setShortcutOutput(result.translation);
    await speakTranslation(result.translation, result.targetLanguage, config);
    return result;
  } catch (error) {
    await showError(
      `Translation failed.\n\n${error?.message || "Unknown error."}`
    );
    return null;
  }
}

async function dictateText(config) {
  // Official Scriptable API is Dictation.start(locale), not Speech.dictate.
  // Locale should be a language id like "en" or "es" (not DeepL codes like EN-US).
  if (config.input.dictationLanguage === "auto") {
    return await Dictation.start();
  }
  const locale = normalizeLanguage(config.input.dictationLanguage).toLowerCase();
  return await Dictation.start(locale);
}

// ============================================================
// UI HELPERS
// ============================================================

function getUIModule() {
  try {
    if (typeof UI !== "undefined" && UI) {
      return UI;
    }
  } catch (error) {
    // Ignore — UI may not exist in modular installs.
  }
  try {
    return importModule("SmartTranslateUI");
  } catch (error) {
    return null;
  }
}

async function showError(message) {
  const ui = getUIModule();
  if (ui?.presentMessage) {
    try {
      await ui.presentMessage("SmartTranslate Error", message, {
        variant: "error"
      });
      return;
    } catch (error) {
      console.error(`WebView error UI failed: ${error.message}`);
    }
  }
  const alert = new Alert();
  alert.title = "SmartTranslate Error";
  alert.message = message;
  alert.addAction("OK");
  await alert.presentAlert();
}

async function showSuccess(title, message) {
  const ui = getUIModule();
  if (ui?.presentMessage) {
    try {
      await ui.presentMessage(title, message, { variant: "success" });
      return;
    } catch (error) {
      console.error(`WebView success UI failed: ${error.message}`);
    }
  }
  const alert = new Alert();
  alert.title = title;
  alert.message = message;
  alert.addAction("OK");
  await alert.presentAlert();
}

/**
 * Sleek sectioned menu using UITable.
 *
 * sections: [
 *   {
 *     header?: string,
 *     rows: [{ id, title, subtitle?, symbol? }]
 *   }
 * ]
 *
 * Returns the selected row id, or null if dismissed.
 */
async function presentTableMenu(options) {
  const ui = getUIModule();
  if (ui?.presentTableMenu) {
    try {
      return await ui.presentTableMenu(options);
    } catch (error) {
      console.error(`WebView menu failed: ${error.message}`);
    }
  }
  return presentTableMenuNative(options);
}

async function presentTableMenuNative({ title, subtitle, sections }) {
  let selectedId = null;
  const table = new UITable();
  table.showSeparators = true;

  if (title || subtitle) {
    const header = new UITableRow();
    header.isHeader = true;
    header.height = subtitle ? 52 : 40;
    const titleCell = UITableCell.text(title || "Menu", subtitle || "");
    titleCell.leftAligned();
    titleCell.widthWeight = 100;
    header.addCell(titleCell);
    table.addRow(header);
  }

  for (const section of sections || []) {
    if (section.header) {
      const sectionHeader = new UITableRow();
      sectionHeader.isHeader = true;
      sectionHeader.height = 32;
      const cell = UITableCell.text(section.header.toUpperCase());
      cell.leftAligned();
      cell.widthWeight = 100;
      sectionHeader.addCell(cell);
      table.addRow(sectionHeader);
    }

    for (const item of section.rows || []) {
      const row = new UITableRow();
      row.dismissOnSelect = true;
      row.height = item.subtitle ? 56 : 48;
      row.cellSpacing = 10;

      if (item.symbol && typeof SFSymbol !== "undefined") {
        try {
          const symbol = SFSymbol.named(item.symbol);
          if (symbol && symbol.image) {
            const imageCell = UITableCell.image(symbol.image);
            imageCell.widthWeight = 12;
            imageCell.centerAligned();
            row.addCell(imageCell);
          }
        } catch (error) {
          // Fall through without icon.
        }
      }

      const textCell = UITableCell.text(item.title, item.subtitle || "");
      textCell.leftAligned();
      textCell.widthWeight = item.symbol ? 78 : 90;
      row.addCell(textCell);

      if (item.disclosure) {
        const chevron = UITableCell.text("›");
        chevron.rightAligned();
        chevron.widthWeight = 10;
        row.addCell(chevron);
      }

      row.onSelect = () => {
        selectedId = item.id;
      };
      table.addRow(row);
    }
  }

  await table.present(false);
  return selectedId;
}

async function promptForText(title, message, defaultText = "") {
  const ui = getUIModule();
  if (ui?.presentPrompt) {
    try {
      return await ui.presentPrompt(title, message, defaultText);
    } catch (error) {
      console.error(`WebView prompt failed: ${error.message}`);
    }
  }
  const alert = new Alert();
  alert.title = title;
  alert.message = message;
  alert.addTextField("Enter text...", defaultText);
  alert.addAction("Continue");
  alert.addCancelAction("Cancel");
  const choice = await alert.presentAlert();
  return choice === -1 ? null : alert.textFieldValue(0).trim();
}

async function confirm(title, message) {
  const ui = getUIModule();
  if (ui?.presentConfirm) {
    try {
      return await ui.presentConfirm(title, message);
    } catch (error) {
      console.error(`WebView confirm failed: ${error.message}`);
    }
  }
  const alert = new Alert();
  alert.title = title;
  alert.message = message;
  alert.addAction("Yes");
  alert.addAction("No");
  return (await alert.presentAlert()) === 0;
}

async function chooseFromList(title, items, message = null) {
  const ui = getUIModule();
  if (ui?.presentPicker) {
    try {
      return await ui.presentPicker(title, items, message);
    } catch (error) {
      console.error(`WebView picker failed: ${error.message}`);
    }
  }
  const alert = new Alert();
  alert.title = title;
  if (message) {
    alert.message = message;
  }
  for (const item of items) {
    alert.addAction(item);
  }
  alert.addCancelAction("Cancel");
  return await alert.presentSheet();
}

async function chooseBoolean(title, message, currentValue) {
  const ui = getUIModule();
  if (ui?.presentBoolean) {
    try {
      return await ui.presentBoolean(title, message, currentValue);
    } catch (error) {
      console.error(`WebView boolean picker failed: ${error.message}`);
    }
  }
  const alert = new Alert();
  alert.title = title;
  alert.message = message;
  alert.addAction(currentValue ? "Yes (Keep Enabled)" : "Yes (Enable)");
  alert.addAction(currentValue ? "No (Disable)" : "No (Keep Disabled)");
  alert.addCancelAction("Cancel");
  const choice = await alert.presentAlert();
  if (choice === -1) {
    return currentValue;
  }
  return choice === 0;
}

async function chooseSlider(title, currentValue, min, max) {
  const alert = new Alert();
  alert.title = title;
  alert.message = `Current value: ${currentValue.toFixed(2)}. Enter a new value between ${min} and ${max}.`;
  alert.addTextField("New value", String(currentValue));
  alert.addAction("Set");
  alert.addCancelAction("Cancel");
  const choice = await alert.presentAlert();
  if (choice === -1) {
    return currentValue;
  }

  const newValue = parseFloat(alert.textFieldValue(0));
  if (isNaN(newValue) || newValue < min || newValue > max) {
    await showError(
      `Invalid value. Please enter a number between ${min} and ${max}.`
    );
    return currentValue;
  }
  return newValue;
}

async function chooseLanguage(title, message, currentCode, excludedCodes = []) {
  const available = LANGUAGE_OPTIONS.filter(
    (lang) => !excludedCodes.includes(lang.code)
  );
  const labels = available.map((lang) => lang.name);
  const choice = await chooseFromList(title, labels, message);
  return choice === -1 ? null : available[choice].code;
}

// ============================================================
// UTILITIES
// ============================================================

function deepMerge(defaults, overrides) {
  const result = JSON.parse(JSON.stringify(defaults));
  for (const key in overrides) {
    if (!Object.prototype.hasOwnProperty.call(overrides, key)) {
      continue;
    }
    if (
      overrides[key] &&
      typeof overrides[key] === "object" &&
      !Array.isArray(overrides[key]) &&
      result[key] &&
      typeof result[key] === "object"
    ) {
      result[key] = deepMerge(result[key], overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

function normalizeLanguage(language) {
  return String(language || "")
    .toUpperCase()
    .split("-")[0];
}

function getLanguageDisplayName(code, includeCode = false) {
  const language = LANGUAGE_OPTIONS.find((item) => item.code === code);
  if (!language) {
    return code;
  }
  return includeCode ? `${language.name} (${language.code})` : language.name;
}

function unique(values) {
  return [...new Set(values.filter((v) => v))];
}

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

module.exports = {
  APP_DIRECTORY,
  CONFIG_FILE,
  PEOPLE_FILE,
  ACTIVE_SESSION_FILE,
  CONVERSATIONS_DIRECTORY,
  DEEPL_KEYCHAIN_KEY,
  ELEVENLABS_KEYCHAIN_KEY,
  MAX_INPUT_LENGTH,
  MAX_VOICE_RESULTS,
  DEFAULT_CONFIG,
  LANGUAGE_OPTIONS,
  getFileManager,
  getAppDirectory,
  getConversationsDirectory,
  loadJSON,
  saveJSON,
  deleteFile,
  listConversationFiles,
  loadConfig,
  saveConfig,
  getRequiredKey,
  hasSecret,
  getOptionalKey,
  maskSecret,
  ensureSecret,
  configureSecret,
  getApiKeyStatus,
  runApiKeyWizard,
  copySecretToClipboard,
  testSavedApiKey,
  verifyDeepLKey,
  verifyElevenLabsKey,
  openApiKeySignup,
  clearSecret,
  translateWithDeepL,
  speakTranslation,
  fetchElevenLabsVoices,
  runOneShot,
  dictateText,
  showError,
  showSuccess,
  presentTableMenu,
  promptForText,
  confirm,
  chooseFromList,
  chooseBoolean,
  chooseSlider,
  chooseLanguage,
  deepMerge,
  normalizeLanguage,
  getLanguageDisplayName,
  unique,
  generateUUID,
  formatDate,
  formatDuration
};
