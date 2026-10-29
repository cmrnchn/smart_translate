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
    if (alerts.length === 1 && alerts[0].startsWith("Couldn't finish translating | Check your connection and keys") &&
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
      calls.push({ method: this.method, url: this.url });
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
  const keyInvalid = /^ElevenLabs rejected the API key, so it's invalid\..*\n\nCode 401$/s;
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
