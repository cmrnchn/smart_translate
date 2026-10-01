// SmartTranslateUI.js
//
// WebView UI kit — mockup-style screens for all SmartTranslate menus.
//
// Version: 2.2.1

const LANGUAGE_FLAGS = {
  AR: "🇸🇦",
  ZH: "🇨🇳",
  NL: "🇳🇱",
  "EN-US": "🇺🇸",
  "EN-GB": "🇬🇧",
  FR: "🇫🇷",
  DE: "🇩🇪",
  HE: "🇮🇱",
  IT: "🇮🇹",
  JA: "🇯🇵",
  KO: "🇰🇷",
  PL: "🇵🇱",
  "PT-PT": "🇵🇹",
  "PT-BR": "🇧🇷",
  RU: "🇷🇺",
  ES: "🇪🇸",
  TR: "🇹🇷",
  UK: "🇺🇦"
};

const ICON_PATHS = {
  default: '<circle cx="12" cy="12" r="2.5"/>',
  globe:
    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.8 3.8 5.6 3.8 8.5s-1.3 5.7-3.8 8.5M12 3.5c-2.5 2.8-3.8 5.6-3.8 8.5s1.3 5.7 3.8 8.5"/>',
  type:
    '<rect x="4" y="7" width="16" height="10" rx="2.5"/><path d="M8 11h8M8 14.5h5"/>',
  paste:
    '<rect x="7" y="5" width="11" height="14" rx="2"/><path d="M9 5V4.5A1.5 1.5 0 0 1 10.5 3h5A1.5 1.5 0 0 1 17 4.5V5"/><path d="M9.5 12h7M9.5 15h4"/>',
  copy:
    '<rect x="9" y="9" width="10" height="10" rx="2"/><path d="M5 15.5V6.5A1.5 1.5 0 0 1 6.5 5H15"/>',
  dictate:
    '<rect x="9.5" y="4" width="5" height="9" rx="2.5"/><path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3"/>',
  send:
    '<path d="M20 4L9.5 14.5"/><path d="M20 4l-6.5 16-4-8.5L4 9l16-5z"/>',
  library:
    '<path d="M5 6.5h5v11H5zM14 6.5h5v11h-5z"/><path d="M7.5 9h0M16.5 9h0M7.5 12h0M16.5 12h0"/>',
  people:
    '<circle cx="9" cy="10" r="2.8"/><circle cx="15.5" cy="10" r="2.8"/><path d="M4.5 18.5c.8-2.4 2.6-3.8 4.5-3.8s3.7 1.4 4.5 3.8M13.5 18.5c.8-2.4 2.6-3.8 4.5-3.8"/>',
  conversation:
    '<path d="M5 7.5h9.5a2 2 0 0 1 2 2V14l-2.5 2.5H7a2 2 0 0 1-2-2V7.5z"/><path d="M10.5 14.5h6a2 2 0 0 1 2 2V17l2 2"/>',
  settings:
    '<circle cx="12" cy="12" r="2.8"/><path d="M12 3.5v2.2M12 18.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
  speaker:
    '<path d="M8 10.5v3l3 2.2V8.3L8 10.5z"/><path d="M14.5 9.5a3 3 0 0 1 0 5M16.8 7.2a5.5 5.5 0 0 1 0 9.6"/>',
  search:
    '<circle cx="11" cy="11" r="5.5"/><path d="M15.5 15.5L19 19"/>',
  star:
    '<path d="M12 4.5l1.6 3.6 3.9.4-2.9 2.6.9 3.8-3.5-2.1-3.5 2.1.9-3.8-2.9-2.6 3.9-.4z"/>',
  list: '<path d="M6 7.5h12M6 12h12M6 16.5h12"/>',
  share:
    '<circle cx="18" cy="5" r="2.8"/><circle cx="6" cy="12" r="2.8"/><circle cx="18" cy="19" r="2.8"/><path d="M8.5 13.4l7 4.2M15.5 6.4l-7 4.2"/>',
  person:
    '<circle cx="12" cy="9" r="3"/><path d="M5.5 18.5c.9-2.8 3-4.5 6.5-4.5s5.6 1.7 6.5 4.5"/>',
  "person-add":
    '<circle cx="10" cy="10" r="2.6"/><path d="M5 17.5c.7-2.2 2.3-3.5 5-3.5"/><path d="M17 8.5v5M14.5 11h5"/>',
  play: '<path d="M9.5 7.5l7.5 4.5-7.5 4.5z"/>',
  clock:
    '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  check:
    '<circle cx="12" cy="12" r="8"/><path d="M8.2 12.2l2.4 2.4 5.2-5.4"/>',
  trash:
    '<path d="M6 7.5h12M9 7.5V6h6v1.5"/><path d="M8 7.5l.6 10h6.8l.6-10"/>',
  doc:
    '<path d="M8 4.5h6l3.5 3.5V19a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V6A1.5 1.5 0 0 1 8 4.5z"/><path d="M14 4.5V9h4"/>',
  text:
    '<path d="M6 6.5h12M6 12h9M6 17.5h11"/>',
  key:
    '<circle cx="9" cy="13" r="3.2"/><path d="M12.2 13H18v2.5M16 13v4"/>',
  pencil:
    '<path d="M5 19l2-1 9.5-9.5 2.5 2.5L9.5 20.5 5 19z"/><path d="M14.5 7.5l2.5 2.5"/>',
  chat:
    '<path d="M5.5 6.5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H10l-3 3v-3h-1.5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z"/>'
};

const SYMBOL_ICON = {
  magnifyingglass: "search",
  "star.fill": "star",
  star: "star",
  "list.bullet": "list",
  "square.and.arrow.up": "share",
  "person.fill": "person",
  "person.badge.plus": "person-add",
  "person.crop.circle": "person",
  "person.2": "conversation",
  "play.fill": "play",
  clock: "clock",
  "checkmark.circle": "check",
  trash: "trash",
  "plus.bubble": "chat",
  "bubble.left.and.bubble.right": "conversation",
  "text.bubble": "chat",
  "doc.text": "doc",
  "text.alignleft": "text",
  keyboard: "type",
  "doc.on.clipboard": "paste",
  mic: "dictate",
  gearshape: "settings",
  "books.vertical": "library",
  globe: "globe",
  key: "key",
  "checkmark.seal": "check",
  pencil: "pencil",
  "character.bubble": "chat"
};

const TINT_CLASSES = ["blue", "green", "purple", "orange", "slate"];

let sessionWebView = null;
let sessionPresentPromise = null;

function flagForCode(code) {
  if (!code) {
    return "🌐";
  }
  if (LANGUAGE_FLAGS[code]) {
    return LANGUAGE_FLAGS[code];
  }
  const base = String(code).toUpperCase().split("-")[0];
  return LANGUAGE_FLAGS[base] || "🌐";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveIconId(symbolOrId) {
  if (ICON_PATHS[symbolOrId]) {
    return symbolOrId;
  }
  if (SYMBOL_ICON[symbolOrId]) {
    return SYMBOL_ICON[symbolOrId];
  }
  return "default";
}

function renderIcon(symbolOrId) {
  const id = resolveIconId(symbolOrId);
  const paths = ICON_PATHS[id] || ICON_PATHS.default;
  return `<span class="ui-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${paths}</svg></span>`;
}

function iconForSymbol(symbol) {
  return renderIcon(symbol);
}

function tintClass(index) {
  return TINT_CLASSES[index % TINT_CLASSES.length];
}

function parseCompletion(raw) {
  if (raw == null || raw === "") {
    return null;
  }
  if (typeof raw === "object") {
    return raw;
  }
  if (String(raw).charAt(0) === "{") {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return { a: raw };
    }
  }
  return { a: raw };
}

const UI_STYLES = `
  :root {
    --bg: #070b14;
    --card: rgba(22, 30, 48, 0.92);
    --card-border: rgba(255, 255, 255, 0.08);
    --text: #f4f7ff;
    --text-secondary: rgba(235, 240, 255, 0.62);
    --text-tertiary: rgba(235, 240, 255, 0.42);
    --hero-start: #3b4fd8;
    --hero-end: #7c3aed;
    --accent-blue: #4f8cff;
    --accent-green: #34d399;
    --accent-orange: #fb923c;
    --accent-purple: #a78bfa;
    --danger: #f87171;
    --radius-lg: 20px;
    --radius-md: 16px;
    --shadow: 0 18px 48px rgba(0, 0, 0, 0.38);
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body {
    margin: 0; padding: 0; min-height: 100%;
    background: #070b14; background: var(--bg, #070b14);
    color: #f4f7ff; color: var(--text, #f4f7ff);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  body {
    padding: calc(env(safe-area-inset-top, 12px) + 12px) 16px calc(env(safe-area-inset-bottom, 12px) + 24px);
  }
  .app { max-width: 440px; margin: 0 auto; }
  .topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding: 0 2px; }
  .brand { font-size: 13px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-tertiary); }
  .badge-pill {
    font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    color: #c4b5fd; background: rgba(124, 58, 237, 0.22);
    border: 1px solid rgba(167, 139, 250, 0.28); padding: 5px 10px; border-radius: 999px;
  }
  .badge-pill.plain { color: var(--text-secondary); background: rgba(255,255,255,0.06); border-color: var(--card-border); }
  .page-header { margin-bottom: 18px; padding: 0 2px; }
  .page-title { margin: 0 0 4px; font-size: 28px; font-weight: 700; letter-spacing: -0.03em; }
  .page-subtitle { margin: 0; font-size: 15px; color: var(--text-secondary); line-height: 1.4; }
  .hero {
    position: relative; overflow: hidden; border-radius: var(--radius-lg);
    padding: 22px 20px 20px; margin-bottom: 22px;
    background: linear-gradient(135deg, var(--hero-start) 0%, var(--hero-end) 100%);
    box-shadow: var(--shadow); border: 1px solid rgba(255, 255, 255, 0.12);
  }
  .hero::before {
    content: ""; position: absolute; inset: 0;
    background: radial-gradient(circle at 85% 15%, rgba(255,255,255,0.22), transparent 42%),
      radial-gradient(circle at 10% 90%, rgba(255,255,255,0.08), transparent 35%);
    pointer-events: none;
  }
  .hero-inner { position: relative; z-index: 1; }
  .hero-icon {
    width: 42px; height: 42px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
    background: rgba(255, 255, 255, 0.16); border: 1px solid rgba(255, 255, 255, 0.18); margin-bottom: 14px;
    color: rgba(255, 255, 255, 0.95);
  }
  .ui-icon { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
  .ui-icon svg {
    width: 22px; height: 22px; stroke: currentColor; fill: none;
    stroke-width: 1.65; stroke-linecap: round; stroke-linejoin: round;
  }
  .hero-icon .ui-icon svg { width: 24px; height: 24px; stroke-width: 1.5; }
  .tile-icon .ui-icon svg { width: 21px; height: 21px; }
  .lang-pair { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  .lang-chip { display: inline-flex; align-items: center; gap: 8px; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
  .lang-chip .flag { font-size: 24px; }
  .lang-arrow { color: rgba(255, 255, 255, 0.72); font-size: 18px; font-weight: 600; }
  .voice-pill {
    display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600;
    color: rgba(255, 255, 255, 0.92); background: rgba(0, 0, 0, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.14); padding: 6px 12px; border-radius: 999px;
  }
  .voice-pill .ui-icon svg { width: 14px; height: 14px; opacity: 0.9; }
  .section { margin-bottom: 18px; }
  .section-title { margin: 0 0 10px 4px; font-size: 13px; font-weight: 600; color: var(--text-tertiary); }
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .tile {
    appearance: none; border: 1px solid var(--card-border); background: var(--card); border-radius: var(--radius-md);
    padding: 14px 10px 12px; color: var(--text); text-align: center;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
  }
  .tile:active { transform: scale(0.97); }
  .tile-icon {
    width: 42px; height: 42px; margin: 0 auto 10px; border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
  }
  .tile-icon.blue { color: #93c5fd; background: rgba(79, 140, 255, 0.16); }
  .tile-icon.green { color: #6ee7b7; background: rgba(52, 211, 153, 0.14); }
  .tile-icon.orange { color: #fdba74; background: rgba(251, 146, 60, 0.16); }
  .tile-icon.purple { color: #c4b5fd; background: rgba(167, 139, 250, 0.14); }
  .tile-label { display: block; font-size: 14px; font-weight: 650; }
  .list { display: flex; flex-direction: column; gap: 8px; }
  .list-row, .continue-card, .btn-row, .msg-card {
    width: 100%; appearance: none; border: 1px solid var(--card-border); background: var(--card);
    color: inherit; border-radius: var(--radius-md); display: flex; align-items: center; gap: 12px;
    padding: 14px; text-align: left; box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  }
  .list-row:active, .continue-card:active, .btn-row:active { transform: scale(0.99); }
  .row-icon {
    width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center;
    justify-content: center; flex-shrink: 0;
  }
  .row-icon.blue { color: #93c5fd; background: rgba(79, 140, 255, 0.14); }
  .row-icon.green { color: #6ee7b7; background: rgba(52, 211, 153, 0.14); }
  .row-icon.purple { color: #c4b5fd; background: rgba(167, 139, 250, 0.14); }
  .row-icon.orange { color: #fdba74; background: rgba(251, 146, 60, 0.14); }
  .row-icon.slate { color: #cbd5e1; background: rgba(148, 163, 184, 0.14); }
  .row-icon .ui-icon svg { width: 19px; height: 19px; }
  .row-text, .continue-text { flex: 1; min-width: 0; }
  .row-title, .continue-title { display: block; font-size: 16px; font-weight: 650; margin-bottom: 2px; }
  .row-sub, .continue-sub {
    display: block; font-size: 13px; color: var(--text-secondary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .chevron { color: var(--text-tertiary); font-size: 22px; flex-shrink: 0; }
  .continue-dot {
    width: 10px; height: 10px; border-radius: 50%; background: var(--accent-orange);
    box-shadow: 0 0 0 4px rgba(251, 146, 60, 0.18); flex-shrink: 0;
  }
  .msg-card { flex-direction: column; align-items: stretch; gap: 10px; }
  .msg-card.error { border-color: rgba(248, 113, 113, 0.35); }
  .msg-card.success { border-color: rgba(52, 211, 153, 0.35); }
  .msg-body { font-size: 15px; line-height: 1.45; color: var(--text-secondary); white-space: pre-wrap; }
  .btn-stack { display: flex; flex-direction: column; gap: 8px; width: 100%; }
  .btn-row { justify-content: center; font-size: 16px; font-weight: 650; }
  .btn-row.destructive { color: #fecaca; border-color: rgba(248, 113, 113, 0.3); }
  .btn-row.primary { background: linear-gradient(135deg, var(--hero-start), var(--hero-end)); border: none; justify-content: center; }
  .prompt-card { flex-direction: column; align-items: stretch; gap: 12px; padding: 16px; }
  .prompt-input {
    width: 100%; border: 1px solid var(--card-border); background: rgba(0,0,0,0.25);
    color: var(--text); border-radius: 12px; padding: 12px 14px; font-size: 16px; outline: none;
  }
  .prompt-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .key-card {
    border: 1px solid var(--card-border); background: var(--card); border-radius: var(--radius-md);
    padding: 14px; margin-bottom: 10px; box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  }
  .key-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
  .key-card-title { font-size: 17px; font-weight: 700; }
  .status-pill {
    font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
    padding: 4px 9px; border-radius: 999px; border: 1px solid var(--card-border);
  }
  .status-pill.ok { color: #6ee7b7; background: rgba(52, 211, 153, 0.12); border-color: rgba(52, 211, 153, 0.28); }
  .status-pill.missing { color: #fdba74; background: rgba(251, 146, 60, 0.12); border-color: rgba(251, 146, 60, 0.28); }
  .key-card-sub { font-size: 13px; color: var(--text-secondary); line-height: 1.4; margin: 0 0 10px; }
  .key-meta {
    font-size: 12px; color: var(--text-tertiary); font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    word-break: break-all; margin-bottom: 12px;
  }
  .key-actions { display: flex; flex-direction: column; gap: 8px; }
  body.quick-screen-body {
    width: 100%; min-height: 100vh; height: 100vh; overflow: hidden;
    background: #000; color: #fff;
    padding: 0 14px calc(env(safe-area-inset-bottom, 0px) + 18px);
    display: flex; flex-direction: column;
  }
  .quick-app {
    width: 100%; max-width: 390px; min-height: 100%; margin: 0 auto;
    display: flex; flex-direction: column;
  }
  .quick-status {
    height: 54px; display: flex; align-items: flex-end; justify-content: space-between;
    padding: 0 8px 8px; font-size: 15px; font-weight: 600;
  }
  .quick-status-right { display: flex; gap: 6px; align-items: center; font-size: 13px; }
  .quick-header {
    display: grid; grid-template-columns: 72px 1fr 72px; align-items: center;
    gap: 4px; margin-bottom: 10px;
  }
  .quick-icons { display: flex; gap: 14px; align-items: center; min-width: 0; }
  .quick-icons.right { justify-content: flex-end; }
  .quick-chrome-btn {
    appearance: none; border: 0; background: transparent; color: #cfcfcf;
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 0; font-size: 8px; letter-spacing: 0.02em;
  }
  .quick-chrome-btn .ui-icon svg { width: 20px; height: 20px; stroke: #fff; stroke-width: 1.7; }
  .quick-brand-wrap { text-align: center; min-width: 0; }
  .quick-brand { font-size: 17px; font-weight: 700; letter-spacing: -0.02em; }
  .quick-langs { display: flex; justify-content: center; gap: 6px; margin-top: 6px; }
  .quick-pill {
    font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px;
  }
  .quick-pill.dim { background: #2a2a2a; color: #ddd; }
  .quick-pill.lit { background: #f3eee4; color: #111; }
  .quick-input-card {
    background: #f3eee4; color: #111; border-radius: 28px;
    flex: 1.35; min-height: 0; position: relative;
    padding: 18px 78px 18px 18px; margin-bottom: 12px;
  }
  .quick-input {
    width: 100%; height: 100%; resize: none; border: 0; outline: 0;
    background: transparent; color: #111; font: inherit;
    font-size: 22px; line-height: 1.25; font-weight: 500;
  }
  .quick-input::placeholder { color: #9a958c; opacity: 1; }
  .quick-stack {
    position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
    display: flex; flex-direction: column; gap: 8px; width: 62px;
  }
  .quick-stack-btn {
    appearance: none; border: 0; border-radius: 16px; padding: 10px 6px;
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    font-size: 10px; font-weight: 600;
  }
  .quick-stack-btn.secondary { background: #e4dfd4; color: #111; }
  .quick-stack-btn.primary { background: #111; color: #fff; }
  .quick-stack-btn .ui-icon svg { width: 18px; height: 18px; stroke-width: 1.8; }
  .quick-result-card {
    background: #f3eee4; color: #111; border-radius: 24px;
    padding: 14px 16px 16px; margin-bottom: 12px; flex: 0.7; min-height: 0;
  }
  .quick-result-label {
    font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
    color: #8a857c; margin-bottom: 8px;
  }
  .quick-result-main {
    font-size: 26px; font-weight: 700; line-height: 1.15;
    margin-bottom: 8px; min-height: 30px;
  }
  .quick-result-means { font-size: 14px; color: #6b6660; line-height: 1.35; }
  .quick-result-empty { color: #9a958c; font-size: 18px; font-weight: 600; }
  .quick-actions {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 14px;
  }
  .quick-action-btn {
    appearance: none; background: #111; color: #fff; border: 1px solid #2a2a2a;
    border-radius: 16px; padding: 12px 6px;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    font-size: 11px; font-weight: 600;
  }
  .quick-action-btn .ui-icon svg { width: 18px; height: 18px; stroke: #fff; stroke-width: 1.7; }
  .quick-tabs { display: flex; align-items: center; gap: 10px; padding: 4px 0 2px; }
  .quick-tab-active {
    flex: 1; appearance: none; border: 0; background: #f3eee4; color: #111; border-radius: 999px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 14px; font-weight: 700; font-size: 15px;
  }
  .quick-tab-link {
    appearance: none; border: 0; background: transparent; color: #eee;
    display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 14px;
    padding: 10px 8px;
  }
  .quick-tab-active .ui-icon svg, .quick-tab-link .ui-icon svg { width: 18px; height: 18px; }
`;

function wrapDocument(pageTitle, bodyHtml, bodyClass) {
  const bodyAttrs = bodyClass ? ` class="${escapeHtml(bodyClass)}"` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(pageTitle || "SmartTranslate")}</title>
<style>${UI_STYLES}</style>
</head>
<body${bodyAttrs}>${bodyHtml}</body>
</html>`;
}

function renderTopbar(brand, badge) {
  const badgeHtml = badge
    ? `<div class="badge-pill${badge === "plain" ? " plain" : ""}">${escapeHtml(badge)}</div>`
    : "";
  return `<div class="topbar"><div class="brand">${escapeHtml(brand || "SmartTranslate")}</div>${badgeHtml}</div>`;
}

function renderPageHeader(title, subtitle) {
  return `<header class="page-header">
    <h1 class="page-title">${escapeHtml(title || "")}</h1>
    ${subtitle ? `<p class="page-subtitle">${escapeHtml(subtitle)}</p>` : ""}
  </header>`;
}

function renderListRow(item, index) {
  const tint = tintClass(index);
  const icon = iconForSymbol(item.symbol);
  const chevron = item.disclosure !== false ? `<span class="chevron">›</span>` : "";
  return `<button type="button" class="list-row" data-action="${escapeHtml(item.id)}">
    <span class="row-icon ${tint}">${icon}</span>
    <span class="row-text">
      <span class="row-title">${escapeHtml(item.title)}</span>
      ${item.subtitle ? `<span class="row-sub">${escapeHtml(item.subtitle)}</span>` : ""}
    </span>
    ${chevron}
  </button>`;
}

function buildListMenuHTML({ title, subtitle, sections, brand, badge }) {
  let sectionsHtml = "";
  let rowIndex = 0;

  for (const section of sections || []) {
    let rowsHtml = "";
    for (const item of section.rows || []) {
      rowsHtml += renderListRow(item, rowIndex);
      rowIndex += 1;
    }
    sectionsHtml += `<section class="section">
      ${section.header ? `<h2 class="section-title">${escapeHtml(section.header)}</h2>` : ""}
      <div class="list">${rowsHtml}</div>
    </section>`;
  }

  const body = `<div class="app">
    ${renderTopbar(brand, badge)}
    ${renderPageHeader(title, subtitle)}
    ${sectionsHtml}
  </div>`;

  return wrapDocument(title, body);
}

function buildMessageHTML({ title, message, variant, actions }) {
  const acts = actions || [{ id: "ok", label: "OK" }];
  const buttons = acts
    .map((action) => {
      const cls = action.destructive ? "btn-row destructive" : action.primary ? "btn-row primary" : "btn-row";
      return `<button type="button" class="${cls}" data-action="${escapeHtml(action.id)}">${escapeHtml(action.label)}</button>`;
    })
    .join("");

  const body = `<div class="app">
    ${renderTopbar("SmartTranslate", null)}
    ${renderPageHeader(title, null)}
    <div class="msg-card ${escapeHtml(variant || "info")}">
      <div class="msg-body">${escapeHtml(message)}</div>
      <div class="btn-stack">${buttons}</div>
    </div>
  </div>`;

  return wrapDocument(title, body);
}

function buildPromptHTML({ title, message, defaultValue, placeholder, secure }) {
  const inputType = secure ? "password" : "text";
  const body = `<div class="app">
    ${renderTopbar("SmartTranslate", null)}
    ${renderPageHeader(title, message)}
    <div class="prompt-card list-row" style="flex-direction:column;align-items:stretch;">
      <input class="prompt-input" id="st-input" type="${inputType}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${escapeHtml(defaultValue || "")}" placeholder="${escapeHtml(placeholder || "Enter text…")}" />
      <div class="prompt-actions">
        <button type="button" class="btn-row" data-action="cancel">Cancel</button>
        <button type="button" class="btn-row primary" data-action="submit">Continue</button>
      </div>
    </div>
  </div>`;

  return wrapDocument(title, body);
}

function buildApiKeyWizardHTML(status) {
  const s = status || {};
  const deepl = s.deepl || {};
  const eleven = s.elevenlabs || {};

  const deeplPill = deepl.saved
    ? `<span class="status-pill ok">Saved</span>`
    : `<span class="status-pill missing">Not set</span>`;
  const elevenPill = eleven.saved
    ? `<span class="status-pill ok">Saved</span>`
    : `<span class="status-pill missing">Optional</span>`;

  const body = `<div class="app">
    ${renderTopbar("SmartTranslate", "Keys")}
    ${renderPageHeader("API Keys", "Stored in Scriptable Keychain on your iPhone.")}
    <section class="section">
      <div class="key-card">
        <div class="key-card-head">
          <div class="key-card-title">DeepL</div>
          ${deeplPill}
        </div>
        <p class="key-card-sub">Required for translation.${deepl.saved ? ` Showing ${escapeHtml(deepl.masked || "")}.` : " Get a free key at deepl.com."}</p>
        <div class="key-actions">
          <button type="button" class="btn-row primary" data-action="deepl_manage">${deepl.saved ? "View / Update DeepL Key" : "Set Up DeepL Key"}</button>
          <button type="button" class="btn-row" data-action="deepl_signup">Get DeepL API Key</button>
        </div>
      </div>
      <div class="key-card">
        <div class="key-card-head">
          <div class="key-card-title">ElevenLabs</div>
          ${elevenPill}
        </div>
        <p class="key-card-sub">Optional premium voices.${eleven.saved ? ` Showing ${escapeHtml(eleven.masked || "")}.` : " Skip if you use Apple voice."}</p>
        <div class="key-actions">
          <button type="button" class="btn-row primary" data-action="eleven_manage">${eleven.saved ? "View / Update ElevenLabs Key" : "Set Up ElevenLabs Key"}</button>
          <button type="button" class="btn-row" data-action="eleven_signup">Get ElevenLabs API Key</button>
        </div>
      </div>
      <button type="button" class="btn-row" data-action="done">Done</button>
    </section>
  </div>`;

  return wrapDocument("API Keys", body);
}

function buildApiKeyDetailHTML(service) {
  const s = service || {};
  const saved = !!s.saved;
  const body = `<div class="app">
    ${renderTopbar("SmartTranslate", "Keys")}
    ${renderPageHeader(s.label || "API Key", saved ? "Saved on this iPhone" : "Not saved yet")}
    <section class="section">
      <div class="key-card">
        <div class="key-card-head">
          <div class="key-card-title">${escapeHtml(s.label || "API Key")}</div>
          <span class="status-pill ${saved ? "ok" : "missing"}">${saved ? "Saved" : "Not set"}</span>
        </div>
        <p class="key-card-sub">${escapeHtml(s.hint || "")}</p>
        ${saved ? `<div class="key-meta">Masked: ${escapeHtml(s.masked || "")}<br>Keychain: ${escapeHtml(s.keychainKey || "")}</div>` : ""}
        <div class="key-actions">
          ${saved ? `<button type="button" class="btn-row primary" data-action="copy">Copy Full Key</button>` : ""}
          <button type="button" class="btn-row ${saved ? "" : "primary"}" data-action="paste">${saved ? "Replace Key" : "Paste API Key"}</button>
          ${saved ? `<button type="button" class="btn-row" data-action="test">Test Key</button>` : ""}
          <button type="button" class="btn-row" data-action="signup">Open ${escapeHtml(s.label || "Provider")} Keys Page</button>
          ${saved ? `<button type="button" class="btn-row destructive" data-action="remove">Remove Key</button>` : ""}
          <button type="button" class="btn-row" data-action="back">Back</button>
        </div>
      </div>
    </section>
  </div>`;

  return wrapDocument(s.label || "API Key", body);
}

async function bindPromptHandlers(webView, includeEmptySubmit) {
  return webView.evaluateJavaScript(
    `(function () {
      document.querySelector('[data-action="submit"]').addEventListener("click", function () {
        completion(JSON.stringify({
          a: "submit",
          v: document.getElementById("st-input").value
        }));
      });
      document.querySelector('[data-action="cancel"]').addEventListener("click", function () {
        completion(JSON.stringify({ a: "cancel" }));
      });
      ${includeEmptySubmit ? "" : `document.getElementById("st-input").addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          document.querySelector('[data-action="submit"]').click();
        }
      });`}
    })();`,
    true
  );
}

function renderTile(action, label, tint, iconId) {
  return `<button type="button" class="tile" data-action="${escapeHtml(action)}"><div class="tile-icon ${escapeHtml(tint)}">${renderIcon(iconId)}</div><span class="tile-label">${escapeHtml(label)}</span></button>`;
}

function renderHomeRow(action, title, subtitle, tint, iconId) {
  return `<button type="button" class="list-row" data-action="${escapeHtml(action)}"><span class="row-icon ${escapeHtml(tint)}">${renderIcon(iconId)}</span><span class="row-text"><span class="row-title">${escapeHtml(title)}</span><span class="row-sub">${escapeHtml(subtitle)}</span></span><span class="chevron">›</span></button>`;
}

function buildProHomeHTML(context) {
  const c = context || {};
  const primaryFlag = escapeHtml(c.primaryFlag || "🌐");
  const conversationFlag = escapeHtml(c.conversationFlag || "🌐");
  const primaryLang = escapeHtml(c.primaryLang || "Language A");
  const conversationLang = escapeHtml(c.conversationLang || "Language B");
  const engine = escapeHtml(c.engine || "Apple Voice");
  const libraryMeta = escapeHtml(c.libraryMeta || "Browse saved chats");
  const peopleMeta = escapeHtml(c.peopleMeta || "Profiles and memory");

  const continueBlock = c.activeSession
    ? `<section class="section">
      <h2 class="section-title">Continue</h2>
      <button type="button" class="continue-card" data-action="continue">
        <span class="continue-dot"></span>
        <span class="continue-text">
          <span class="continue-title">${escapeHtml(c.activeSession.name)}</span>
          <span class="continue-sub">${c.activeSession.turns} turn${c.activeSession.turns === 1 ? "" : "s"} · tap to resume</span>
        </span>
        <span class="chevron">›</span>
      </button>
    </section>`
    : "";

  const body = `<div class="app">
    ${renderTopbar("SmartTranslate", "Pro")}
    <header class="hero"><div class="hero-inner">
      <div class="hero-icon">${renderIcon("globe")}</div>
      <div class="lang-pair">
        <span class="lang-chip"><span class="flag">${primaryFlag}</span>${primaryLang}</span>
        <span class="lang-arrow">↔</span>
        <span class="lang-chip"><span class="flag">${conversationFlag}</span>${conversationLang}</span>
      </div>
      <span class="voice-pill">${renderIcon("speaker")}<span>${engine}</span></span>
    </div></header>
    <section class="section">
      <h2 class="section-title">Quick actions</h2>
      <div class="tiles">
        ${renderTile("type", "Type", "blue", "type")}
        ${renderTile("paste", "Paste", "green", "paste")}
        ${renderTile("dictate", "Dictate", "orange", "dictate")}
      </div>
    </section>
    ${continueBlock}
    <section class="section">
      <h2 class="section-title">Saved</h2>
      <div class="list">
        ${renderHomeRow("library", "Library", libraryMeta, "blue", "library")}
        ${renderHomeRow("people", "People", peopleMeta, "purple", "people")}
        ${renderHomeRow("conversation", "Conversation", "Multi-turn with a person", "green", "conversation")}
        ${renderHomeRow("settings", "Settings", "Languages, keys, speech", "slate", "settings")}
      </div>
    </section>
  </div>`;

  return wrapDocument("SmartTranslate Pro", body);
}

function buildV1HomeHTML(context) {
  const c = context || {};
  const primaryCode = escapeHtml(c.primaryCode || "EN");
  const conversationCode = escapeHtml(c.conversationCode || "ES");
  const inputText = escapeHtml(c.inputText || "");
  const resultText = String(c.resultText || "").trim();
  const meansText = String(c.meansText || "").trim();
  const resultMain = resultText
    ? escapeHtml(resultText)
    : `<span class="quick-result-empty">Translation appears here</span>`;
  const means = meansText ? `Means: ${meansText}` : "Means:";
  const body = `<div class="quick-app">
    <div class="quick-status">
      <span>9:41</span>
      <div class="quick-status-right"><span>••••</span><span>Wi-Fi</span><span>100%</span></div>
    </div>
    <div class="quick-header">
      <div class="quick-icons">
        <button type="button" class="quick-chrome-btn" data-action="library">${renderIcon("library")}<span>Library</span></button>
        <button type="button" class="quick-chrome-btn" data-action="people">${renderIcon("people")}<span>People</span></button>
      </div>
      <div class="quick-brand-wrap">
        <div class="quick-brand">SmartTranslate</div>
        <div class="quick-langs">
          <span class="quick-pill dim">${primaryCode}</span>
          <span class="quick-pill lit">${conversationCode}</span>
        </div>
      </div>
      <div class="quick-icons right">
        <button type="button" class="quick-chrome-btn" data-action="search">${renderIcon("search")}<span>Search</span></button>
        <button type="button" class="quick-chrome-btn" data-action="settings">${renderIcon("settings")}<span>Settings</span></button>
      </div>
    </div>

    <section class="quick-input-card" aria-label="Quick translation input">
      <textarea id="st-quick-input" class="quick-input" placeholder="Type or paste..." spellcheck="false">${inputText}</textarea>
      <div class="quick-stack">
        <button type="button" class="quick-stack-btn secondary" data-action="paste">${renderIcon("copy")}<span>Paste</span></button>
        <button type="button" class="quick-stack-btn secondary" data-action="transcribe">${renderIcon("dictate")}<span>Transcribe</span></button>
        <button type="button" class="quick-stack-btn primary" data-action="send">${renderIcon("send")}<span>Send</span></button>
      </div>
    </section>

    <section class="quick-result-card" aria-label="Translation result">
      <div class="quick-result-label">RESULT</div>
      <div class="quick-result-main">${resultMain}</div>
      <div class="quick-result-means">${escapeHtml(means)}</div>
    </section>

    <div class="quick-actions">
      <button type="button" class="quick-action-btn" data-action="copy">${renderIcon("copy")}<span>Copy</span></button>
      <button type="button" class="quick-action-btn" data-action="dictate">${renderIcon("speaker")}<span>Dictate</span></button>
      <button type="button" class="quick-action-btn" data-action="share">${renderIcon("share")}<span>Share</span></button>
    </div>

    <nav class="quick-tabs" aria-label="SmartTranslate modes">
      <button type="button" class="quick-tab-active" data-action="quick">${renderIcon("pencil")}<span>Quick</span></button>
      <button type="button" class="quick-tab-link" data-action="conversation">${renderIcon("chat")}<span>Talk</span></button>
    </nav>
  </div>`;
  return wrapDocument("SmartTranslate", body, "quick-screen-body");
}

function resetSession() {
  sessionWebView = null;
  sessionPresentPromise = null;
}

function pauseMs(ms) {
  return new Promise((resolve) => {
    Timer.schedule(ms / 1000, false, () => {
      resolve();
    });
  });
}

async function waitForTapAction(webView) {
  return webView.evaluateJavaScript(
    `(function () {
      function handler(event) {
        var target = event.target.closest("[data-action]");
        if (!target) return;
        event.preventDefault();
        document.removeEventListener("click", handler, true);
        var action = target.getAttribute("data-action") || "";
        if (action === "send") {
          var input = document.getElementById("st-quick-input");
          completion(JSON.stringify({ a: action, v: input ? input.value : "" }));
          return;
        }
        completion(String(action));
      }
      document.addEventListener("click", handler, true);
    })();`,
    true
  );
}

async function presentScreen(html) {
  if (typeof WebView === "undefined") {
    return null;
  }

  const isNewSession = !sessionWebView;
  if (!sessionWebView) {
    sessionWebView = new WebView();
  }

  await sessionWebView.loadHTML(html);

  let dismissPromise = sessionPresentPromise;
  if (isNewSession) {
    dismissPromise = sessionWebView.present(false).then(() => {
      resetSession();
      return null;
    });
    sessionPresentPromise = dismissPromise;
    // Scriptable can render a blank WebView if evaluateJavaScript runs before present().
    await pauseMs(300);
  } else {
    await pauseMs(80);
  }

  const actionPromise = waitForTapAction(sessionWebView);
  return Promise.race([actionPromise, dismissPromise]);
}

async function presentTableMenu(options) {
  const html = buildListMenuHTML({
    title: options.title,
    subtitle: options.subtitle,
    sections: options.sections,
    brand: options.brand || "SmartTranslate",
    badge: options.badge || null
  });
  const raw = await presentScreen(html);
  const parsed = parseCompletion(raw);
  return parsed ? parsed.a : null;
}

async function presentMessage(title, message, options) {
  const opts = options || {};
  const html = buildMessageHTML({
    title,
    message,
    variant: opts.variant || "info",
    actions: opts.actions || [{ id: "ok", label: "OK", primary: true }]
  });
  await presentScreen(html);
}

async function presentConfirm(title, message) {
  const html = buildMessageHTML({
    title,
    message,
    variant: "info",
    actions: [
      { id: "yes", label: "Yes", primary: true },
      { id: "no", label: "No" }
    ]
  });
  const raw = await presentScreen(html);
  const parsed = parseCompletion(raw);
  return parsed && parsed.a === "yes";
}

async function presentPicker(title, items, message) {
  if (!items || items.length === 0) {
    return -1;
  }
  const rows = items.map((label, index) => ({
    id: String(index),
    title: label,
    subtitle: "",
    symbol: "list.bullet"
  }));
  const choice = await presentTableMenu({
    title,
    subtitle: message || `${items.length} option${items.length === 1 ? "" : "s"}`,
    sections: [{ rows }]
  });
  if (choice == null) {
    return -1;
  }
  return Number(choice);
}

async function presentBoolean(title, message, currentValue) {
  const choice = await presentTableMenu({
    title,
    subtitle: message,
    sections: [
      {
        rows: [
          {
            id: "yes",
            title: currentValue ? "Yes (Keep Enabled)" : "Yes (Enable)",
            symbol: "checkmark.circle"
          },
          {
            id: "no",
            title: currentValue ? "No (Disable)" : "No (Keep Disabled)",
            symbol: "trash"
          }
        ]
      }
    ]
  });
  if (!choice) {
    return currentValue;
  }
  return choice === "yes";
}

async function presentPrompt(title, message, defaultText, options) {
  const opts = options || {};
  const html = buildPromptHTML({
    title,
    message,
    defaultValue: defaultText || "",
    placeholder: opts.placeholder || "Enter text…",
    secure: !!opts.secure
  });

  if (typeof WebView === "undefined") {
    return null;
  }

  const isNewSession = !sessionWebView;
  if (!sessionWebView) {
    sessionWebView = new WebView();
  }

  await sessionWebView.loadHTML(html);

  let dismissPromise = sessionPresentPromise;
  if (isNewSession) {
    dismissPromise = sessionWebView.present(false).then(() => {
      resetSession();
      return null;
    });
    sessionPresentPromise = dismissPromise;
    await pauseMs(300);
  } else {
    await pauseMs(80);
  }

  const raw = await Promise.race([
    bindPromptHandlers(sessionWebView, true),
    dismissPromise
  ]);

  const parsed = parseCompletion(raw);
  if (!parsed || parsed.a === "cancel") {
    return null;
  }
  return String(parsed.v || "").trim();
}

async function presentSecurePrompt(title, message, placeholder) {
  return presentPrompt(title, message, "", {
    secure: true,
    placeholder: placeholder || "Paste API key here…"
  });
}

async function presentApiKeyWizardHub(status) {
  const raw = await presentScreen(buildApiKeyWizardHTML(status));
  const parsed = parseCompletion(raw);
  return parsed ? parsed.a : null;
}

async function presentApiKeyDetail(service) {
  const raw = await presentScreen(buildApiKeyDetailHTML(service));
  const parsed = parseCompletion(raw);
  return parsed ? parsed.a : null;
}

async function presentProHome(context) {
  const raw = await presentScreen(buildProHomeHTML(context));
  const parsed = parseCompletion(raw);
  if (!parsed) {
    return null;
  }
  return parsed.a;
}

async function presentV1Home(context) {
  const raw = await presentScreen(buildV1HomeHTML(context));
  const parsed = parseCompletion(raw);
  if (parsed && parsed.a === "send") {
    return {
      action: "send",
      text: String(parsed.v || "")
    };
  }
  return parsed ? parsed.a : null;
}

module.exports = {
  flagForCode,
  renderIcon,
  buildProHomeHTML,
  buildV1HomeHTML,
  buildListMenuHTML,
  presentScreen,
  presentTableMenu,
  presentMessage,
  presentConfirm,
  presentPicker,
  presentBoolean,
  presentPrompt,
  presentSecurePrompt,
  presentApiKeyWizardHub,
  presentApiKeyDetail,
  presentProHome,
  presentV1Home,
  resetSession
};
