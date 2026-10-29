#!/usr/bin/env node
/**
 * Automated checks for SmartTranslate (runs in Cursor Cloud / CI).
 *
 * Cannot run Scriptable on-device APIs here — validates bundler output,
 * installers, WebView HTML, and present()/evaluateJavaScript ordering.
 *
 * Usage: node tools/test-smarttranslate.mjs
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import { loadScriptableModule } from "./load-scriptable-module.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

let passed = 0;
let failed = 0;

function ok(name) {
  console.log(`  ✓ ${name}`);
  passed += 1;
}

function fail(name, message) {
  console.error(`  ✗ ${name}: ${message}`);
  failed += 1;
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assertIncludes(name, haystack, needle) {
  if (!haystack.includes(needle)) {
    fail(name, `expected to include ${JSON.stringify(needle)}`);
    return false;
  }
  ok(name);
  return true;
}

function assertNotIncludes(name, haystack, needle) {
  if (haystack.includes(needle)) {
    fail(name, `expected to omit ${JSON.stringify(needle)}`);
    return false;
  }
  ok(name);
  return true;
}

function syntaxCheck(rel) {
  const file = path.join(root, rel);
  try {
    execSync(`node --check --input-type=module < "${file}"`, {
      stdio: "pipe",
      shell: "/bin/bash"
    });
    ok(`syntax ${rel}`);
    return true;
  } catch (error) {
    fail(`syntax ${rel}`, error.stderr?.toString() || error.message);
    return false;
  }
}

function testBundlerDeterministic() {
  console.log("\nBundler");
  const before = {
    v1: read("scripts/dist/SmartTranslate.js"),
    pro: read("scripts/dist/SmartTranslatePro.js")
  };
  execSync("node tools/bundle.mjs", { cwd: root, stdio: "pipe" });
  const afterV1 = read("scripts/dist/SmartTranslate.js");
  const afterPro = read("scripts/dist/SmartTranslatePro.js");
  if (before.v1 === afterV1 && before.pro === afterPro) {
    ok("bundle.mjs is deterministic (dist unchanged)");
  } else {
    fail(
      "bundle.mjs is deterministic",
      "dist/ changed after bundle — commit regenerated files"
    );
  }
}

function testInstallerBuild() {
  console.log("\nInstallers");
  execSync("node tools/build-installer.mjs", { cwd: root, stdio: "pipe" });
  const required = [
    "scripts/dist/install-smarttranslate.js",
    "scripts/dist/ScriptInstall.js",
    "scripts/installers/smarttranslate.install.js"
  ];
  for (const rel of required) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      fail(`installer output ${rel}`, "file missing");
      continue;
    }
    const size = fs.statSync(abs).size;
    if (size < 500) {
      fail(`installer output ${rel}`, `too small (${size} bytes)`);
      continue;
    }
    ok(`installer output ${rel} (${size} bytes)`);
  }

  const config = JSON.parse(read("scripts/installers/smarttranslate.json"));
  for (const item of config.items || []) {
    if (!item.url?.includes("scripts/dist/")) {
      fail(`installer url ${item.scriptName}`, "unexpected download URL");
      continue;
    }
    ok(`installer url ${item.scriptName}`);
  }
}

function testWebViewHtml() {
  console.log("\nWebView HTML");
  const UI = loadScriptableModule("scripts/SmartTranslateUI.js");

  const proHtml = UI.buildProHomeHTML({
    primaryLang: "English (US)",
    conversationLang: "Spanish",
    primaryFlag: "🇺🇸",
    conversationFlag: "🇪🇸",
    engine: "Apple Voice",
    libraryMeta: "3 chats",
    peopleMeta: "2 profiles"
  });

  assertIncludes("Pro home has Quick actions", proHtml, "Quick actions");
  assertIncludes("Pro home has type tile", proHtml, 'data-action="type"');
  assertIncludes("Pro home has settings", proHtml, 'data-action="settings"');
  assertIncludes("Pro home has library", proHtml, 'data-action="library"');
  assertIncludes("Pro home background fallback", proHtml, "#070b14");
  assertIncludes("Pro home boot script", proHtml, "data-action");
  assertIncludes("Pro home uses abstract SVG icons", proHtml, 'class="ui-icon"');
  assertIncludes("Pro home SVG stroke icons", proHtml, "<svg viewBox");
  assertIncludes("Pro home DOCTYPE", proHtml, "<!DOCTYPE html>");

  if (proHtml.length < 4000) {
    fail("Pro home HTML size", `suspiciously small (${proHtml.length} bytes)`);
  } else {
    ok(`Pro home HTML size (${proHtml.length} bytes)`);
  }

  const v1Html = UI.buildV1HomeHTML({
    primaryCode: "EN",
    conversationCode: "ES",
    resultText: "¿Nos vemos mañana?",
    meansText: "See you tomorrow?"
  });
  assertIncludes("v1 home has Quick tab", v1Html, ">Quick</span>");
  assertIncludes("v1 home has Talk tab", v1Html, ">Talk</span>");
  assertIncludes("v1 home has paste stack action", v1Html, 'data-action="paste"');
  assertIncludes("v1 home has transcribe stack action", v1Html, 'data-action="transcribe"');
  assertIncludes("v1 home has send stack action", v1Html, 'data-action="send"');
  assertIncludes("v1 home has result label", v1Html, "RESULT");
  assertIncludes("v1 home empty input has placeholder", v1Html, "Translation appears here");
  assertNotIncludes("v1 home empty input hides stale result", v1Html, "¿Nos vemos mañana?");
  assertNotIncludes("v1 home empty input hides stale source line", v1Html, "See you tomorrow?");
  assertIncludes("v1 home has copy result action", v1Html, 'data-action="copy"');
  assertIncludes("v1 home has dictate result action", v1Html, 'data-action="dictate"');
  assertIncludes("v1 home has share result action", v1Html, 'data-action="share"');
  assertIncludes("v1 home has Talk action", v1Html, 'data-action="conversation"');
  assertIncludes("v1 home has settings", v1Html, 'data-action="settings"');

  const v1TranslatedHtml = UI.buildV1HomeHTML({
    primaryCode: "EN",
    conversationCode: "ES",
    inputText: "See you tomorrow?",
    resultText: "¿Nos vemos mañana?",
    meansText: "See you tomorrow?"
  });
  assertIncludes("v1 home real input shows source text", v1TranslatedHtml, "See you tomorrow?");
  assertIncludes("v1 home real translation is primary result", v1TranslatedHtml, '<div class="quick-result-main">¿Nos vemos mañana?</div>');
  assertIncludes("v1 home real translation labels original", v1TranslatedHtml, "Original: See you tomorrow?");
  if (v1Html.includes("Walkie")) {
    fail("v1 home omits Walkie", "Walkie appears in Quick chrome or tabs");
  } else {
    ok("v1 home omits Walkie");
  }
}

async function testWebViewPresentOrder() {
  console.log("\nWebView present order (blank-screen regression)");

  const calls = [];

  class MockWebView {
    constructor() {
      this.html = "";
    }

    async loadHTML(html) {
      calls.push("loadHTML");
      this.html = html;
    }

    present(fullscreen) {
      calls.push(`present:${fullscreen}`);
      return new Promise(() => {});
    }

    async evaluateJavaScript(_script, _useCallback) {
      calls.push("evaluateJavaScript");
      return "settings";
    }
  }

  const UI = loadUIWithMockWebView(MockWebView);

  const action = await UI.presentProHome({
    primaryLang: "English",
    conversationLang: "Spanish",
    engine: "Apple Voice"
  });

  const presentIndex = calls.findIndex((entry) => entry.startsWith("present:"));
  const evalIndex = calls.indexOf("evaluateJavaScript");

  if (presentIndex === -1 || evalIndex === -1) {
    fail("WebView call trace", `unexpected trace: ${calls.join(" → ")}`);
    return;
  }

  if (presentIndex < evalIndex) {
    ok(`present() before evaluateJavaScript (${calls.join(" → ")})`);
  } else {
    fail(
      "WebView call trace",
      `evaluateJavaScript ran before present(): ${calls.join(" → ")}`
    );
  }

  if (calls.includes("present:false")) {
    ok("uses sheet presentation present(false)");
  } else {
    fail("WebView presentation mode", "expected present(false)");
  }

  if (action === "settings") {
    ok("mock tap returns menu action");
  } else {
    fail("mock tap action", `expected settings, got ${action}`);
  }
}

function loadUIWithMockWebView(MockWebView) {
  const UI = loadScriptableModule("scripts/SmartTranslateUI.js", {
    WebView: MockWebView,
    Timer: {
      schedule(_seconds, _repeating, callback) {
        callback();
      }
    }
  });
  UI.resetSession();
  return UI;
}

async function testV1SendPayload() {
  console.log("\nQuick send payload");

  class MockWebView {
    async loadHTML(_html) {}

    present(_fullscreen) {
      return new Promise(() => {});
    }

    async evaluateJavaScript(_script, _useCallback) {
      return JSON.stringify({ a: "send", v: "See you tomorrow?" });
    }
  }

  const UI = loadUIWithMockWebView(MockWebView);

  const action = await UI.presentV1Home({
    primaryCode: "EN",
    conversationCode: "ES"
  });

  if (action?.action === "send" && action?.text === "See you tomorrow?") {
    ok("v1 send returns edited input text");
  } else {
    fail("v1 send returns edited input text", `unexpected payload: ${JSON.stringify(action)}`);
  }
}

async function testV1EditedActionPayload() {
  console.log("\nQuick edited action payload");

  class MockWebView {
    async loadHTML(_html) {}

    present(_fullscreen) {
      return new Promise(() => {});
    }

    async evaluateJavaScript(_script, _useCallback) {
      return JSON.stringify({ a: "copy", v: "Edited draft" });
    }
  }

  const UI = loadUIWithMockWebView(MockWebView);

  const action = await UI.presentV1Home({
    primaryCode: "EN",
    conversationCode: "ES",
    inputText: "Old draft",
    resultText: "Traduccion anterior",
    meansText: "Old draft"
  });

  if (action?.action === "copy" && action?.text === "Edited draft") {
    ok("v1 non-send actions return edited input text");
  } else {
    fail("v1 non-send actions return edited input text", `unexpected payload: ${JSON.stringify(action)}`);
  }
}

function testBundleRegressionGuards() {
  console.log("\nBundle regression guards");
  const uiSource = read("scripts/SmartTranslateUI.js");
  assertIncludes("UI defines pauseMs", uiSource, "function pauseMs");
  assertIncludes("UI uses present(false)", uiSource, "present(false)");
  assertIncludes("UI tap handler uses completion()", uiSource, "completion(String(action))");
  assertIncludes("Pro has WebView fallback", read("scripts/SmartTranslatePro.js"), "showMainMenuFallback");
}

async function testBundleTailCompletes() {
  console.log("\nBundle tail (main throws)");
  for (const rel of ["scripts/dist/SmartTranslate.js", "scripts/dist/SmartTranslatePro.js"]) {
    const code = `(async()=>{ ${read(rel)} })()`;
    let completed = false;
    const alerts = [];
    class Alert {
      addAction() {}
      async presentAlert() { alerts.push(`${this.title} | ${this.message}`); return 0; }
    }
    const ctx = {
      console: { ...console, error() {} },
      Alert,
      Script: { complete() { completed = true; }, setShortcutOutput() {} },
      FileManager: {
        iCloud() { throw new Error("iCloud is not enabled for Scriptable"); },
        local() { throw new Error("boom from main"); }
      }
    };
    let rejected = null;
    try {
      await vm.runInNewContext(code, ctx);
    } catch (error) {
      rejected = error;
    }
    if (rejected) {
      fail(`${rel} main() error is caught`, rejected.message);
    } else {
      ok(`${rel} main() error is caught`);
    }
    if (completed) ok(`${rel} Script.complete runs when main throws`);
    else fail(`${rel} Script.complete runs when main throws`, "not called");
    if (alerts.length === 1 && alerts[0].startsWith("SmartTranslate hit an error | Check your connection and keys") &&
      alerts[0].endsWith("\n\nboom from main")) ok(`${rel} shows error alert`);
    else fail(`${rel} shows error alert`, JSON.stringify(alerts));
  }
}

function makeFm(kind) {
  return {
    kind,
    documentsDirectory() { return `/${kind}/Documents`; },
    joinPath(a, b) { return `${a}/${b}`; },
    fileExists() { return true; },
    createDirectory() {}
  };
}

function testFileManagerFallback() {
  console.log("\nStorage fallback (iCloud → local)");
  const cases = [
    ["scripts/SmartTranslateShared.js", (g) => loadScriptableModule("scripts/SmartTranslateShared.js", g).getFileManager()],
    ["scripts/ScriptInstall.runtime.js", (g) => {
      const code = read("scripts/ScriptInstall.runtime.js").replace(/try \{\s*await main\(\);[\s\S]*$/, "");
      const ctx = { ...g, INSTALLER: { items: [] } };
      vm.runInNewContext(code + "\nthis.__fm = getFileManager();", ctx);
      return ctx.__fm;
    }]
  ];
  for (const [rel, getFm] of cases) {
    const available = getFm({ FileManager: { iCloud: () => makeFm("icloud"), local: () => makeFm("local") } });
    if (available?.kind === "icloud") ok(`${rel} uses iCloud when available`);
    else fail(`${rel} uses iCloud when available`, `got ${available?.kind}`);
    const throwing = getFm({ FileManager: { iCloud: () => { throw new Error("iCloud is not enabled"); }, local: () => makeFm("local") } });
    if (throwing?.kind === "local") ok(`${rel} falls back to local when iCloud throws`);
    else fail(`${rel} falls back to local when iCloud throws`, `got ${throwing?.kind}`);
    const noDocs = getFm({ FileManager: { iCloud: () => ({ ...makeFm("icloud"), documentsDirectory() { throw new Error("no iCloud docs"); } }), local: () => makeFm("local") } });
    if (noDocs?.kind === "local") ok(`${rel} falls back to local when iCloud docs unavailable`);
    else fail(`${rel} falls back to local when iCloud docs unavailable`, `got ${noDocs?.kind}`);
  }
}

// Scriptable Request mock: each call consumes the next scripted reply.
// reply = { offline: true } | { status, body, headers }
function makeRequestMock(replies) {
  const calls = [];
  class Request {
    constructor(url) { this.url = url; this.method = "GET"; this.headers = {}; this.response = undefined; }
    _next() {
      calls.push({ method: this.method, url: this.url, body: this.body });
      const reply = replies.length > 1 ? replies.shift() : replies[0];
      if (reply.offline) {
        throw new Error("The Internet connection appears to be offline.");
      }
      this.response = { statusCode: reply.status, headers: reply.headers || {} };
      return reply.body ?? "";
    }
    async loadJSON() { return JSON.parse(this._next()); }
    async loadString() { return this._next(); }
    async load() { const t = this._next(); return { toRawString: () => t }; }
  }
  return { Request, calls };
}

function loadSharedWithRequests(replies) {
  const mock = makeRequestMock(replies);
  const waits = [];
  const Shared = loadScriptableModule("scripts/SmartTranslateShared.js", {
    Request: mock.Request,
    Timer: { schedule(seconds, _repeat, cb) { waits.push(seconds); cb(); return {}; } }
  });
  return { Shared, calls: mock.calls, waits };
}

async function deeplCase(replies, key = "k:fx") {
  const { Shared, calls, waits } = loadSharedWithRequests(replies);
  let message = null;
  try {
    await Shared.translateWithDeepL("hola", key, { primary: "EN", conversation: "ES", defaultTarget: "EN" });
  } catch (error) {
    message = error.message;
  }
  return { message, posts: calls.filter((c) => c.method === "POST"), waits };
}

function check(name, condition, detail) {
  if (condition) ok(name);
  else fail(name, detail);
}

async function testDeepLErrorPaths() {
  console.log("\nDeepL error paths (mocked HTTP)");
  const okBody = JSON.stringify({ translations: [{ detected_source_language: "ES", text: "hello" }] });

  const forbidden = await deeplCase([{ status: 403, body: JSON.stringify({ message: "Forbidden" }) }]);
  check("403 makes exactly one POST", forbidden.posts.length === 1, `POSTs: ${forbidden.posts.length}`);
  check("403 says the key is bad", /rejected the API key \(403\)/.test(forbidden.message || ""), forbidden.message);

  const wrong = await deeplCase([{ status: 404, body: "" }, { status: 200, body: okBody }]);
  check("404 falls back to the other server", wrong.message === null && wrong.posts.length === 2 &&
    wrong.posts[0].url.includes("api-free.deepl.com") && wrong.posts[1].url.includes("://api.deepl.com"),
    JSON.stringify(wrong));

  const offline = await deeplCase([{ offline: true }]);
  const html429 = await deeplCase([{ status: 429, body: "<html>Too Many Requests</html>" }]);
  const empty503 = await deeplCase([{ status: 503, body: "" }]);
  const messages = [offline.message, html429.message, empty503.message];
  check("offline gives a connection message", /Could not reach DeepL/.test(offline.message || ""), offline.message);
  check("503 empty body gives an unavailable message", /temporarily unavailable\. Try again in a minute\.\n\nCode 503$/.test(empty503.message || ""), empty503.message);
  check("429 HTML body gives a rate-limit message", /^DeepL is rate-limiting, try again in a minute\.\n\nCode 429$/.test(html429.message || ""), html429.message);
  check("offline/503/429 never say parse error", messages.every((m) => m && !/Could not parse/.test(m)), JSON.stringify(messages));
  check("offline/503/429 messages are distinct", new Set(messages).size === 3, JSON.stringify(messages));
  check("offline/503 make one POST, no fallback", offline.posts.length === 1 && empty503.posts.length === 1,
    `${offline.posts.length}/${empty503.posts.length}`);

  check("429 twice = 2 POSTs on same server", html429.posts.length === 2 &&
    html429.posts.every((c) => c.url === html429.posts[0].url), JSON.stringify(html429.posts));
  check("429 without Retry-After waits 2s", JSON.stringify(html429.waits) === "[2]", JSON.stringify(html429.waits));

  const retryOk = await deeplCase([{ status: 429, body: "{}", headers: { "Retry-After": "3" } }, { status: 200, body: okBody }]);
  check("429 then 200 succeeds on retry", retryOk.message === null && retryOk.posts.length === 2, JSON.stringify(retryOk));
  check("429 honors Retry-After seconds", JSON.stringify(retryOk.waits) === "[3]", JSON.stringify(retryOk.waits));

  const longWait = await deeplCase([{ status: 429, body: "", headers: { "retry-after": "60" } }, { status: 200, body: okBody }]);
  check("Retry-After 60 = exactly 1 POST", longWait.posts.length === 1, `POSTs: ${longWait.posts.length}`);
  check("Retry-After 60 does not wait", longWait.waits.length === 0, JSON.stringify(longWait.waits));
  check("Retry-After 60 message names the wait", /try again in about 60s\.\n\nCode 429$/.test(longWait.message || ""), longWait.message);

  const retry404 = await deeplCase([{ status: 429, body: "" }, { status: 404, body: "" }, { status: 200, body: okBody }]);
  check("429 never exceeds 2 POSTs (no fallback after retry)", retry404.posts.length === 2, `POSTs: ${retry404.posts.length}`);
}

async function testElevenLabs401() {
  console.log("\nElevenLabs key check (mocked HTTP)");
  const keyInvalid = /^ElevenLabs didn't accept your API key\..*\n\nCode 401$/s;
  const { Shared } = loadSharedWithRequests([{ status: 401, body: JSON.stringify({ detail: { message: "Invalid API key" } }) }]);
  let message = null;
  try { await Shared.verifyElevenLabsKey("bogus"); } catch (error) { message = error.message; }
  check("ElevenLabs 401 says key invalid", keyInvalid.test(message || "") && !/voice list/.test(message || ""), message);

  // TTS runs inside speakTranslation, which reports the error and falls back to Apple speech.
  const ttsMock = makeRequestMock([{ status: 401, body: "" }]);
  const errors = [];
  const ttsShared = loadScriptableModule("scripts/SmartTranslateShared.js", {
    Request: ttsMock.Request,
    console: { ...console, error: (m) => errors.push(String(m)) },
    Keychain: { contains: () => true, get: () => "bogus" },
    importModule() { throw new Error("no UI"); },
    Alert: class { addAction() {} async presentAlert() { return 0; } },
    Speech: { speak() {} },
    Timer: { schedule(_s, _r, cb) { cb(); return {}; } }
  });
  await ttsShared.speakTranslation("hi", "ES", {
    speech: { engine: "elevenlabs", elevenlabs: { enabled: true, modelId: "m", voices: { ES: { voiceId: "v" } } } }
  }).catch(() => {});
  const ttsMessage = (errors.find((m) => m.startsWith("ElevenLabs failed: ")) || "")
    .replace(/^ElevenLabs failed: /, "").replace(/\. Falling back to Apple speech\.$/, "");
  check("ElevenLabs TTS 401 says key invalid", keyInvalid.test(ttsMessage) && !/TTS failed/.test(ttsMessage), JSON.stringify(errors));
}

async function testVerifyDeepLKeyErrors() {
  console.log("\nDeepL key check (mocked HTTP)");
  const offline = loadSharedWithRequests([{ offline: true }]);
  let message = null;
  try { await offline.Shared.verifyDeepLKey("k:fx"); } catch (error) { message = error.message; }
  check("verifyDeepLKey offline gives the friendly message", /^Could not reach DeepL\. Check your internet connection/.test(message || ""), message);

  const forbidden = loadSharedWithRequests([{ status: 403, body: JSON.stringify({ message: "Forbidden" }) }]);
  message = null;
  try { await forbidden.Shared.verifyDeepLKey("k:fx"); } catch (error) { message = error.message; }
  check("verifyDeepLKey 403 says the key is bad", /rejected the API key \(403\)[\s\S]*DeepL: Forbidden/.test(message || ""), message);

  const unavailable = loadSharedWithRequests([{ status: 503, body: "" }]);
  message = null;
  try { await unavailable.Shared.verifyDeepLKey("k:fx"); } catch (error) { message = error.message; }
  check("verifyDeepLKey 503 says temporarily unavailable", /temporarily unavailable[\s\S]*Code 503$/.test(message || ""), message);
}

async function testInstallerNon2xx() {
  console.log("\nInstaller download (mocked HTTP)");
  for (const status of [404, 500]) {
    const { Request } = makeRequestMock([{ status, body: "x".repeat(5000) + " SmartTranslate async function main" }]);
    const writes = [];
    const alerts = [];
    class Alert {
      addAction() {}
      async presentAlert() { alerts.push(`${this.title} | ${this.message}`); return 0; }
    }
    const fm = {
      documentsDirectory: () => "/docs",
      joinPath: (a, b) => `${a}/${b}`,
      fileExists: () => false,
      writeString: (p) => writes.push(p),
      remove() {}
    };
    let completed = false;
    const installer = {
      title: "T", deleteSelf: true, runAfterInstall: false, confirmOverwrite: true,
      items: [{ scriptName: "SmartTranslate", label: "SmartTranslate", url: "https://example.com/SmartTranslate.js", minBytes: 10 }]
    };
    const code = `(async()=>{ const INSTALLER = ${JSON.stringify(installer)};\n${read("scripts/ScriptInstall.runtime.js")} })()`;
    await vm.runInNewContext(code, {
      Request, Alert, console,
      FileManager: { iCloud: () => fm, local: () => fm },
      Script: { name: () => "Installer", complete() { completed = true; } },
      Safari: { open() {} }
    });
    check(`installer HTTP ${status} does not save`, writes.length === 0, JSON.stringify(writes));
    check(`installer HTTP ${status} shows an Install failed alert`,
      alerts.some((a) => a === `Install failed | SmartTranslate download failed. Nothing was saved. Check your connection and run the installer again.\n\nCode ${status}`),
      JSON.stringify(alerts));
    check(`installer HTTP ${status} still completes`, completed, "Script.complete not called");
  }
}

function testOptionalDeepL() {
  console.log("\nDeepL (optional)");
  const key = process.env.DEEPL_API_KEY || "";
  if (!key.trim()) {
    console.log("  ○ skipped (set DEEPL_API_KEY to run live API check)");
    return;
  }
  try {
    execSync("bash tools/check-deepl.sh", {
      cwd: root,
      stdio: "pipe",
      env: { ...process.env, DEEPL_API_KEY: key }
    });
    ok("DeepL live check");
  } catch (error) {
    fail("DeepL live check", error.stderr?.toString() || error.message);
  }
}

// ------------------------------------------------------------
// Free / Pro gating
// ------------------------------------------------------------

function testProGatingFlag() {
  console.log("\nFree/Pro gating flag");
  const Shared = loadScriptableModule("scripts/SmartTranslateShared.js");

  check("gating ships off (PRO_GATING_ENABLED === false)", Shared.PRO_GATING_ENABLED === false);
  check("free script with no flag resolves to pro (nothing locked)", Shared.resolveTier("free", {}) === "pro");
  check("free script with null config resolves to pro", Shared.resolveTier("free", null) === "pro");
  check(
    "config.flags.proGating=true previews free tier",
    Shared.resolveTier("free", { flags: { proGating: true } }) === "free"
  );
  check(
    "config.flags.proGating=false stays unlocked",
    Shared.resolveTier("free", { flags: { proGating: false } }) === "pro"
  );
  check(
    "non-boolean flag is ignored",
    Shared.resolveTier("free", { flags: { proGating: "yes" } }) === "pro"
  );
  check(
    "Pro script is always pro, even with the preview flag on",
    Shared.resolveTier("pro", { flags: { proGating: true } }) === "pro"
  );

  const locked = Shared.getLockedFeatures("free");
  check("free tier locks Library, People, Search", locked.library && locked.people && locked.search, JSON.stringify(locked));
  check(
    "free tier never locks Quick or Talk",
    !Shared.isFeatureLocked("quick", "free") && !Shared.isFeatureLocked("talk", "free")
  );
  const unlocked = Shared.getLockedFeatures("pro");
  check("pro tier locks nothing", !unlocked.library && !unlocked.people && !unlocked.search);

  const original = { version: 1, flags: { other: 1 } };
  const preview = Shared.setProGatingPreview(original, true);
  check(
    "setProGatingPreview sets flag without mutating input or dropping other flags",
    preview.flags.proGating === true && preview.flags.other === 1 && original.flags.proGating === undefined
  );

  for (const feature of ["library", "people", "search"]) {
    const note = Shared.getProNote(feature);
    check(`${feature} Pro note says "This is in Pro" and names the Pro script`,
      note.title === "This is in Pro" && note.message.includes("SmartTranslatePro"), JSON.stringify(note));
  }
  for (const surface of ["library", "people", "search", "favorites"]) {
    const state = Shared.getEmptyState(surface);
    check(`${surface} empty state has a title and how-to copy`, !!state.title && state.message.length > 20);
  }
}

async function testProNoteAndEmptyStateUI() {
  console.log("\nPro note / empty state presentation");
  const shown = [];
  const Shared = loadScriptableModule("scripts/SmartTranslateShared.js", {
    UI: {
      async presentMessage(title, message, options) {
        shown.push({ title, message, variant: options?.variant });
        return "ok";
      }
    }
  });
  await Shared.showProNote("people");
  await Shared.showEmptyState("library");
  check("Pro note uses the pro variant", shown[0]?.variant === "pro" && shown[0]?.title === "This is in Pro", JSON.stringify(shown[0]));
  check(
    "empty state uses info (not error) styling",
    shown[1]?.variant === "info" && shown[1]?.title === "No saved chats yet",
    JSON.stringify(shown[1])
  );

  const UI = loadScriptableModule("scripts/SmartTranslateUI.js");
  const proHtml = UI.buildMessageHTML({ title: "This is in Pro", message: "x", variant: "pro" });
  assertIncludes("pro message card shows PRO kicker", proHtml, 'class="msg-kicker"');
  const infoHtml = UI.buildMessageHTML({ title: "Hi", message: "x", variant: "info" });
  assertNotIncludes("info message card has no PRO kicker", infoHtml, 'class="msg-kicker"');

  const lockedHtml = UI.buildV1HomeHTML({
    primaryCode: "EN",
    conversationCode: "ES",
    locked: { library: true, people: true, search: true }
  });
  const tagCount = (lockedHtml.match(/class="pro-tag"/g) || []).length;
  check("locked home shows 3 PRO tags", tagCount === 3, `got ${tagCount}`);
  assertIncludes("locked Library stays tappable", lockedHtml, 'class="quick-chrome-btn locked" data-action="library"');
  assertIncludes("Settings never locked", lockedHtml, 'class="quick-chrome-btn" data-action="settings"');
  const openHtml = UI.buildV1HomeHTML({ primaryCode: "EN", conversationCode: "ES" });
  assertNotIncludes("unlocked home has no PRO tags", openHtml, 'class="pro-tag"');
}

async function runFreeEntryScript({ config, actions, talkExits: talkExitList }) {
  const talkExits = [...(talkExitList || [])];
  const RealShared = loadScriptableModule("scripts/SmartTranslateShared.js");
  const log = { proNotes: [], emptyStates: [], conversations: [], contexts: [] };
  const queue = [...actions];
  const Shared = Object.assign({}, RealShared, {
    async loadConfig() {
      return config;
    },
    async saveConfig() {},
    async showProNote(feature) {
      log.proNotes.push(feature);
    },
    async showEmptyState(surface) {
      log.emptyStates.push(surface);
    }
  });
  const Conversation = {
    async runConversation(_config, options) {
      log.conversations.push(options?.forceAction || "named-session");
    },
    async runTalk(_config, options) {
      log.conversations.push("talk");
      log.talkOptions = options;
      const next = talkExits.shift() || "quick";
      return { exit: next, state: { marker: log.conversations.length } };
    }
  };
  const UI = {
    async presentV1Home(context) {
      log.contexts.push(context);
      const next = queue.shift();
      return next ? { action: next, text: "" } : null;
    }
  };
  const modules = {
    SmartTranslateShared: Shared,
    SmartTranslateConversation: Conversation,
    SmartTranslateUI: UI
  };
  const sandbox = {
    console,
    importModule: (name) => modules[name],
    Script: { complete() {} },
    Alert: class {
      addAction() {}
      async presentAlert() {
        return 0;
      }
    }
  };
  const code = `(async () => { ${read("scripts/SmartTranslate.js")} })()`;
  await vm.runInNewContext(code, sandbox, { filename: "SmartTranslate.js" });
  return log;
}

async function testFreeScriptGating() {
  console.log("\nFree script top bar (gating off vs preview on)");
  const base = { version: 1, languages: { primary: "EN-US", conversation: "ES", defaultTarget: "EN-US" }, speech: { engine: "apple" } };

  const off = await runFreeEntryScript({ config: base, actions: ["library", "people", "search"] });
  check("gating off: home context has nothing locked",
    off.contexts.length === 4 && off.contexts.every((c) => !c.locked.library && !c.locked.people && !c.locked.search));
  check("gating off: Library opens saved chats like before", off.conversations.join(",") === "history", off.conversations.join(","));
  check("gating off: People and Search point to the Pro script", off.proNotes.join(",") === "people,search", off.proNotes.join(","));

  const on = await runFreeEntryScript({
    config: { ...base, flags: { proGating: true } },
    actions: ["library", "people", "search", "conversation"]
  });
  check("preview on: home context locks all three",
    on.contexts.length === 5 && on.contexts.every((c) => c.locked.library && c.locked.people && c.locked.search));
  check("preview on: Library/People/Search show the Pro note", on.proNotes.join(",") === "library,people,search", on.proNotes.join(","));
  check("preview on: Talk still opens (free)", on.conversations.join(",") === "talk", on.conversations.join(","));
}

async function testProKitEmptyStates() {
  console.log("\nPro first-run empty states");
  const log = { empty: [], menus: 0, errors: [] };
  const RealShared = loadScriptableModule("scripts/SmartTranslateShared.js");
  const Shared = Object.assign({}, RealShared, {
    async showEmptyState(surface) {
      log.empty.push(surface);
    },
    async showError(message) {
      log.errors.push(message);
    },
    async presentTableMenu() {
      log.menus += 1;
      return null;
    },
    async loadJSON() {
      return null;
    }
  });
  const Conversation = { async loadAllSessions() { return []; } };
  const ProKit = loadScriptableModule("scripts/SmartTranslateProKit.js", {
    importModule: (name) => (name === "SmartTranslateShared" ? Shared : Conversation)
  });
  await ProKit.runLibrary({});
  await ProKit.runPeopleDirectory({});
  check("empty Library shows first-run state, not a dead-end menu",
    log.empty[0] === "library" && log.menus === 0, JSON.stringify(log));
  check("empty People shows first-run state", log.empty[1] === "people", JSON.stringify(log));
  check("empty states never use error styling", log.errors.length === 0, log.errors.join(" | "));
}

// ------------------------------------------------------------
// Talk (free): two people, tap to speak, tap to switch speaker
// ------------------------------------------------------------

function talkContext(overrides = {}) {
  return {
    active: "me",
    me: { label: "You", code: "EN-US", text: "", means: "", placeholder: "Tap the mic and speak English." },
    them: { label: "Them", code: "ES", text: "", means: "", placeholder: "Their words show here." },
    error: "",
    locked: {},
    ...overrides
  };
}

function testTalkHtml() {
  console.log("\nTalk screen HTML");
  const UI = loadScriptableModule("scripts/SmartTranslateUI.js");
  const first = UI.buildTalkHTML(talkContext());
  for (const action of ["speak", "switch", "type", "side-me", "side-them", "quick", "settings"]) {
    assertIncludes(`Talk has data-action="${action}"`, first, `data-action="${action}"`);
  }
  assertIncludes("Talk shows tap-to-speak mic", first, "TAP TO<br>SPEAK");
  assertIncludes("first run shows how to start", first, "Tap the mic and speak English.");
  assertIncludes("panel shows YOU · EN", first, "YOU · EN");
  assertIncludes("panel shows THEM · ES", first, "THEM · ES");
  const speakingCount = (first.match(/class="talk-speaking"/g) || []).length;
  check("exactly one SPEAKING indicator", speakingCount === 1, `got ${speakingCount}`);
  assertIncludes("me panel active by default", first, 'class="talk-panel active" data-action="side-me"');
  assertNotIncludes("no Talk tab self-link to the old named-session flow", first, 'data-action="conversation"');

  const flipped = UI.buildTalkHTML(
    talkContext({
      active: "them",
      me: { label: "You", code: "EN-US", text: "See you tomorrow?", means: "¿Nos vemos mañana?" },
      them: { label: "Them", code: "ES", text: "<b>Sí</b>", means: "Yes" },
      error: "DeepL API key is missing."
    })
  );
  assertIncludes("switched: them panel active", flipped, 'class="talk-panel active" data-action="side-them"');
  assertIncludes("switched: mic names the speaker", flipped, 'aria-label="Tap to speak as Them"');
  assertIncludes("shows Means: back-translation", flipped, "Means: ¿Nos vemos mañana?");
  assertIncludes("escapes spoken text", flipped, "&lt;b&gt;Sí&lt;/b&gt;");
  assertIncludes("shows turn error banner", flipped, 'class="talk-error"');
  assertIncludes("ES pill lit when they speak", flipped, '<span class="quick-pill lit">ES</span>');

  const locked = UI.buildTalkHTML(talkContext({ locked: { library: true, people: true, search: true } }));
  check("Talk top bar shows PRO tags when locked", (locked.match(/class="pro-tag"/g) || []).length === 3);
}

async function testTalkPresentSwitch() {
  console.log("\nTalk tap protocol");
  class MockWebView {
    async loadHTML(html) { this.html = html; }
    present() { return new Promise(() => {}); }
    async evaluateJavaScript() { return "switch"; }
  }
  const UI = loadUIWithMockWebView(MockWebView);
  const action = await UI.presentTalk(talkContext());
  check("presentTalk returns tapped action (switch)", action === "switch", String(action));
}

function loadTalkHarness({ dictations = [], typed = [], failKey = false, failTranslate = false } = {}) {
  const RealShared = loadScriptableModule("scripts/SmartTranslateShared.js");
  const log = { dictated: [], translated: [], spoken: [], prompts: 0 };
  const dictationQueue = [...dictations];
  const typedQueue = [...typed];
  const Shared = Object.assign({}, RealShared, {
    getRequiredKey() {
      if (failKey) throw new Error("DeepL API key is missing.\n\nOpen Settings → API Keys to save it once.\nKeychain entry:\nx");
      return "k:fx";
    },
    async dictateInLanguage(code) {
      log.dictated.push(code);
      const next = dictationQueue.shift();
      if (next instanceof Error) throw next;
      return next;
    },
    async promptForText() {
      log.prompts += 1;
      return typedQueue.shift() ?? null;
    },
    async translateToTarget(text, _key, target) {
      if (failTranslate) throw new Error("DeepL quota exceeded.");
      log.translated.push({ text, target });
      return { translation: `[${target}] ${text}`, detectedLanguage: "X", targetLanguage: target };
    },
    async speakTranslation(text, lang) {
      log.spoken.push({ text, lang });
    }
  });
  const Conversation = loadScriptableModule("scripts/SmartTranslateConversation.js", {
    importModule: () => Shared
  });
  return { Conversation, log };
}

const TALK_CONFIG = {
  version: 1,
  languages: { primary: "EN-US", conversation: "ES", defaultTarget: "EN-US" },
  speech: { engine: "apple" }
};

async function testTalkFlow() {
  console.log("\nTalk turn flow (mocked dictation/DeepL/speech)");
  const { Conversation, log } = loadTalkHarness({
    dictations: ["See you tomorrow?", "Sí, a las diez."],
    typed: ["Perfect"]
  });
  const contexts = [];
  const taps = ["speak", "speak", "switch", "switch", "type", "side-them", "quick"];
  const ui = {
    async presentTalk(context) {
      contexts.push(JSON.parse(JSON.stringify(context)));
      return taps.shift();
    }
  };
  const result = await Conversation.runTalk(TALK_CONFIG, { ui, locked: { library: true } });

  check("first screen: You are speaking", contexts[0].active === "me");
  check("first screen: empty-state hint for You", /Tap the mic and speak English/.test(contexts[0].me.placeholder), contexts[0].me.placeholder);
  check("locks passed through to Talk screen", contexts[0].locked.library === true);
  check("You dictate in your language, they in theirs", log.dictated.join(",") === "EN-US,ES", log.dictated.join(","));
  check(
    "each turn translates to the listener's language",
    log.translated.map((t) => t.target).join(",") === "ES,EN-US,ES",
    JSON.stringify(log.translated)
  );
  check(
    "translation is spoken in the listener's language",
    log.spoken.map((s) => s.lang).join(",") === "ES,EN-US,ES" && log.spoken[0].text === "[ES] See you tomorrow?",
    JSON.stringify(log.spoken)
  );
  check("after You speak, turn passes to Them", contexts[1].active === "them");
  check("your panel shows what you said + Means:", contexts[1].me.text === "See you tomorrow?" && contexts[1].me.means === "[ES] See you tomorrow?");
  check("after Them speak, turn passes back to You", contexts[2].active === "me");
  check("Switch flips the speaker", contexts[3].active === "them" && contexts[4].active === "me");
  check("Type works as the keyboard fallback", log.prompts === 1 && contexts[5].me.text === "Perfect");
  check("tapping a panel makes it the speaker", contexts[6].active === "them");
  check("Quick tab exits Talk with state kept", result.exit === "quick" && result.state.turns === 3, JSON.stringify(result.exit));

  const again = await Conversation.runTalk(TALK_CONFIG, {
    ui: { async presentTalk(context) { contexts.push(context); return "quick"; } },
    state: result.state
  });
  check("returning to Talk keeps the last panels", contexts[contexts.length - 1].me.text === "Perfect" && again.exit === "quick");

  const changed = await Conversation.runTalk(
    { ...TALK_CONFIG, languages: { primary: "EN-US", conversation: "FR", defaultTarget: "EN-US" } },
    { ui: { async presentTalk(context) { contexts.push(context); return null; } }, state: result.state }
  );
  check("language change in Settings starts fresh panels", contexts[contexts.length - 1].them.code === "FR" && contexts[contexts.length - 1].me.text === "");
  check("dismissing the sheet exits as cancel", changed.exit === "cancel");
}

async function testTalkErrors() {
  console.log("\nTalk errors and cancel");
  const cancelled = loadTalkHarness({ dictations: [new Error("Dictation cancelled")] });
  const state = cancelled.Conversation.createTalkState(TALK_CONFIG);
  const taps = ["speak", "quick"];
  const seen = [];
  await cancelled.Conversation.runTalk(TALK_CONFIG, {
    ui: { async presentTalk(c) { seen.push(c); return taps.shift(); } },
    state
  });
  check("cancelled dictation: no translate, no error, same speaker",
    cancelled.log.translated.length === 0 && !seen[1].error && seen[1].active === "me");

  const noKey = loadTalkHarness({ failKey: true });
  const s1 = noKey.Conversation.createTalkState(TALK_CONFIG);
  await noKey.Conversation.runTalkTurn(s1, TALK_CONFIG, "Hello");
  check("missing DeepL key shows a short error and keeps the turn",
    /DeepL API key is missing\. Open Settings/.test(s1.error) && !/Keychain entry/.test(s1.error) && s1.active === "me" && noKey.log.spoken.length === 0,
    s1.error);

  const quota = loadTalkHarness({ failTranslate: true });
  const s2 = quota.Conversation.createTalkState(TALK_CONFIG);
  await quota.Conversation.runTalkTurn(s2, TALK_CONFIG, "Hello");
  check("DeepL failure surfaces on the Talk screen", s2.error === "DeepL quota exceeded." && s2.sides.me.text === "");

  const s3 = quota.Conversation.createTalkState(TALK_CONFIG);
  quota.Conversation.setActiveSpeaker(s3, "them");
  s3.error = "old";
  quota.Conversation.setActiveSpeaker(s3, "me");
  check("switching speaker clears an old error", s3.error === "" && s3.active === "me");
}

async function testTalkSharedHelpers() {
  console.log("\nTalk Shared helpers");
  const okBody = JSON.stringify({ translations: [{ detected_source_language: "EN", text: "¿Nos vemos mañana?" }] });
  const { Shared, calls } = loadSharedWithRequests([{ status: 200, body: okBody }]);
  const result = await Shared.translateToTarget("See you tomorrow?", "k:fx", "ES");
  const posts = calls.filter((c) => c.method === "POST");
  check("translateToTarget: one DeepL call", posts.length === 1, String(posts.length));
  check("translateToTarget: sends listener language as target", /target_lang=ES|"target_lang":\s*"ES"/.test(String(posts[0]?.body)), String(posts[0]?.body).slice(0, 120));
  check("translateToTarget: returns translation", result.translation === "¿Nos vemos mañana?" && result.targetLanguage === "ES");

  check("dictation locale EN-US → en", Shared.dictationLocaleFor("EN-US") === "en");
  check("dictation locale PT-BR → pt", Shared.dictationLocaleFor("PT-BR") === "pt");
  const locales = [];
  const withDictation = loadScriptableModule("scripts/SmartTranslateShared.js", {
    Dictation: { async start(locale) { locales.push(locale); return "hola"; } }
  });
  const heard = await withDictation.dictateInLanguage("ES");
  check("dictateInLanguage passes es to Dictation.start", locales[0] === "es" && heard === "hola", JSON.stringify(locales));
}

async function testFreeScriptTalkTab() {
  console.log("\nFree script Talk tab");
  const base = { version: 1, languages: { primary: "EN-US", conversation: "ES", defaultTarget: "EN-US" }, speech: { engine: "apple" } };
  const run = await runFreeEntryScript({
    config: { ...base, flags: { proGating: true } },
    actions: ["conversation"],
    talkExits: ["library", "quick"]
  });
  check("Talk tab opens the two-person Talk screen", run.conversations.join(",") === "talk,talk", run.conversations.join(","));
  check("locked Library from Talk shows the Pro note, then returns to Talk", run.proNotes.join(",") === "library");
  check("Talk receives free-tier locks", run.talkOptions?.locked?.library === true);
  check("Talk state is carried between visits", run.talkOptions?.state?.marker === 1, JSON.stringify(run.talkOptions?.state));
}

async function main() {
  console.log("SmartTranslate automated checks");
  console.log(`Repo: ${root}`);

  testBundlerDeterministic();
  syntaxCheck("scripts/dist/SmartTranslate.js");
  syntaxCheck("scripts/dist/SmartTranslatePro.js");
  testInstallerBuild();
  testWebViewHtml();
  await testWebViewPresentOrder();
  await testV1SendPayload();
  await testV1EditedActionPayload();
  testBundleRegressionGuards();
  await testBundleTailCompletes();
  testFileManagerFallback();
  await testDeepLErrorPaths();
  await testElevenLabs401();
  await testVerifyDeepLKeyErrors();
  await testInstallerNon2xx();
  testOptionalDeepL();
  testProGatingFlag();
  await testProNoteAndEmptyStateUI();
  await testFreeScriptGating();
  await testProKitEmptyStates();
  testTalkHtml();
  await testTalkPresentSwitch();
  await testTalkFlow();
  await testTalkErrors();
  await testTalkSharedHelpers();
  await testFreeScriptTalkTab();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
