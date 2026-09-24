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
  assertIncludes("v1 home uses Means label", v1Html, "Means: See you tomorrow?");
  assertIncludes("v1 home has copy result action", v1Html, 'data-action="copy"');
  assertIncludes("v1 home has dictate result action", v1Html, 'data-action="dictate"');
  assertIncludes("v1 home has share result action", v1Html, 'data-action="share"');
  assertIncludes("v1 home has Talk action", v1Html, 'data-action="conversation"');
  assertIncludes("v1 home has settings", v1Html, 'data-action="settings"');
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

function testBundleRegressionGuards() {
  console.log("\nBundle regression guards");
  const uiSource = read("scripts/SmartTranslateUI.js");
  assertIncludes("UI defines pauseMs", uiSource, "function pauseMs");
  assertIncludes("UI uses present(false)", uiSource, "present(false)");
  assertIncludes("UI tap handler uses completion()", uiSource, "completion(String(action))");
  assertIncludes("Pro has WebView fallback", read("scripts/SmartTranslatePro.js"), "showMainMenuFallback");
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
  testBundleRegressionGuards();
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
