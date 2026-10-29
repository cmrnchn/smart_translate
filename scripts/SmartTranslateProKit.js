// SmartTranslateProKit.js
//
// Lean Pro layer for SmartTranslate (Scriptable-friendly).
//
// Keep:
//   Library (search, favorites, browse, export)
//   People directory
//   Light post-session summary + auto-tags + favorite
//
// Dropped from menus / wizard:
//   Timeline, Statistics, Learning, Voice Profiles,
//   OpenAI summaries, memory extraction, purpose picker
//
// Version: 1.1.0-lean

const Shared = importModule("SmartTranslateShared");
const Conversation = importModule("SmartTranslateConversation");

const EXPORTS_DIRECTORY = "exports";

const AUTO_TAG_RULES = [
  { tag: "Travel", words: ["hotel", "airport", "flight", "train", "passport", "visa", "taxi", "luggage", "tourist"] },
  { tag: "Restaurant", words: ["menu", "restaurant", "food", "eat", "drink", "coffee", "dinner", "lunch", "waiter", "bill"] },
  { tag: "Medical", words: ["doctor", "hospital", "pharmacy", "pain", "medicine", "sick", "appointment"] },
  { tag: "Work", words: ["meeting", "office", "project", "deadline", "client", "boss", "email"] },
  { tag: "Family", words: ["family", "mom", "dad", "wife", "husband", "kids", "son", "daughter", "brother", "sister"] },
  { tag: "Shopping", words: ["buy", "price", "store", "shop", "market", "sale", "cash", "card"] },
  { tag: "Emergency", words: ["help", "emergency", "police", "lost", "urgent", "danger"] }
];

module.exports = {
  runLibrary,
  runPeopleDirectory,
  processCompletedSession,
  ensureProFields
};

// ============================================================
// POST-SESSION (short)
// ============================================================

async function processCompletedSession(session, filePath) {
  const path = filePath || Conversation.getConversationFilePath(session);
  let current = ensureProFields(session);

  current.intelligence.autoTags = detectAutoTags(current);
  current.intelligence.tags = Shared.unique([
    ...(current.intelligence.tags || []),
    ...current.intelligence.autoTags
  ]);
  current.intelligence.summary = buildExtractiveSummary(current);
  current.intelligence.processedAt = new Date().toISOString();

  await touchPersonFromSession(current);
  await saveSession(current, path);

  await Shared.showSuccess(
    "Saved",
    current.intelligence.summary.slice(0, 700)
  );

  const favorite = await Shared.confirm(
    "Favorite?",
    "Pin this conversation?"
  );
  current.intelligence.favorite = favorite;
  await saveSession(current, path);
}

function ensureProFields(session) {
  const copy = JSON.parse(JSON.stringify(session));
  if (!copy.intelligence) {
    copy.intelligence = {
      summary: "",
      tags: [],
      autoTags: [],
      favorite: false,
      processedAt: null
    };
  }
  if (!copy.metadata) {
    copy.metadata = { title: "", context: "", notes: "" };
  }
  return copy;
}

async function saveSession(session, path) {
  const clean = JSON.parse(JSON.stringify(session));
  delete clean._filePath;
  await Shared.saveJSON(path, clean);
}

// ============================================================
// LIBRARY
// ============================================================

async function runLibrary(config) {
  // First run: nothing saved yet → say what goes here and how to add one,
  // instead of a menu whose every row dead-ends.
  const existing = await Conversation.loadAllSessions();
  if (existing.length === 0) {
    await Shared.showEmptyState("library");
    return;
  }

  const choice = await Shared.presentTableMenu({
    title: "Library",
    subtitle: "Find and export conversations",
    sections: [
      {
        rows: [
          {
            id: "search",
            title: "Search",
            subtitle: "People, titles, tags, transcript",
            symbol: "magnifyingglass"
          },
          {
            id: "favorites",
            title: "Favorites",
            subtitle: "Starred conversations",
            symbol: "star.fill"
          },
          {
            id: "browse",
            title: "All Conversations",
            subtitle: "Newest first",
            symbol: "list.bullet"
          },
          {
            id: "export",
            title: "Export",
            subtitle: "Markdown, JSON, TXT, HTML",
            symbol: "square.and.arrow.up"
          }
        ]
      }
    ]
  });

  if (!choice) {
    return;
  }

  switch (choice) {
    case "search":
      await runSearch();
      break;
    case "favorites":
      await browseFiltered(
        "Favorites",
        (s) => ensureProFields(s).intelligence.favorite
      );
      break;
    case "browse":
      await browseFiltered("All Conversations", () => true);
      break;
    case "export":
      await exportFromLibrary();
      break;
  }
}

async function runSearch() {
  if ((await Conversation.loadAllSessions()).length === 0) {
    await Shared.showEmptyState("search");
    return;
  }
  const query = await Shared.promptForText(
    "Search",
    "Search people, titles, tags, and transcript text."
  );
  if (!query) {
    return;
  }
  const needle = query.toLowerCase();
  const sessions = await Conversation.loadAllSessions();
  const hits = [];

  for (const session of sessions) {
    const pro = ensureProFields(session);
    const haystack = [
      pro.person.name,
      pro.metadata.title,
      pro.metadata.context,
      pro.metadata.notes,
      pro.intelligence.summary,
      ...(pro.intelligence.tags || []),
      ...(pro.intelligence.autoTags || []),
      ...(pro.turns || []).flatMap((t) => [t.sourceText, t.translatedText])
    ]
      .join("\n")
      .toLowerCase();

    if (!haystack.includes(needle)) {
      continue;
    }

    hits.push({
      session: pro,
      snippet: findSnippet(needle, session)
    });
  }

  if (hits.length === 0) {
    await Shared.showNotice(
      "No matches",
      `Nothing saved matches “${query}”. Try a name, a tag, or a word from the chat.`,
      "info"
    );
    return;
  }

  const choice = await Shared.presentTableMenu({
    title: "Search Results",
    subtitle: `${hits.length} match${hits.length === 1 ? "" : "es"}`,
    sections: [
      {
        rows: hits.map((hit, index) => ({
          id: String(index),
          title: `${hit.session.intelligence.favorite ? "★ " : ""}${hit.session.person.name}`,
          subtitle: `${Shared.formatDate(hit.session.session.startedAt)} · ${hit.snippet}`,
          symbol: "text.bubble"
        }))
      }
    ]
  });

  if (choice == null) {
    return;
  }
  await openSessionActions(hits[Number(choice)].session);
}

function findSnippet(needle, session) {
  for (const turn of session.turns || []) {
    const blob = `${turn.sourceText} ${turn.translatedText}`;
    if (blob.toLowerCase().includes(needle)) {
      const idx = blob.toLowerCase().indexOf(needle);
      const start = Math.max(0, idx - 24);
      return blob.slice(start, start + 72).replace(/\s+/g, " ").trim();
    }
  }
  return (session.metadata?.title || session.person.name).slice(0, 72);
}

async function browseFiltered(title, predicate) {
  const sessions = (await Conversation.loadAllSessions())
    .map(ensureProFields)
    .filter(predicate);
  if (sessions.length === 0) {
    await Shared.showEmptyState(title === "Favorites" ? "favorites" : "library");
    return;
  }

  const choice = await Shared.presentTableMenu({
    title,
    subtitle: `${sessions.length} conversation${sessions.length === 1 ? "" : "s"}`,
    sections: [
      {
        rows: sessions.map((session, index) => {
          const tags = Shared.unique([
            ...(session.intelligence.tags || []),
            ...(session.intelligence.autoTags || [])
          ]).slice(0, 3);
          return {
            id: String(index),
            title: `${session.intelligence.favorite ? "★ " : ""}${session.person.name}`,
            subtitle: `${Shared.formatDate(session.session.startedAt)} · ${session.session.turnCount} turns${tags.length ? ` · ${tags.join(", ")}` : ""}`,
            symbol: "bubble.left.and.bubble.right",
            disclosure: true
          };
        })
      }
    ]
  });

  if (choice == null) {
    return;
  }
  await openSessionActions(sessions[Number(choice)]);
}

async function openSessionActions(session) {
  const pro = ensureProFields(session);
  const tags = Shared.unique([
    ...(pro.intelligence.tags || []),
    ...(pro.intelligence.autoTags || [])
  ]);
  const path = Conversation.getConversationFilePath(pro);

  const choice = await Shared.presentTableMenu({
    title: pro.person.name,
    subtitle: pro.metadata.title || "Conversation",
    sections: [
      {
        header: "Overview",
        rows: [
          {
            id: "transcript",
            title: "Transcript",
            subtitle: `${pro.session.turnCount} turns`,
            symbol: "doc.text"
          },
          {
            id: "summary",
            title: "Summary",
            subtitle: pro.intelligence.summary
              ? pro.intelligence.summary.slice(0, 60)
              : "No summary yet",
            symbol: "text.alignleft"
          }
        ]
      },
      {
        header: "Actions",
        rows: [
          {
            id: "favorite",
            title: pro.intelligence.favorite ? "Unfavorite" : "Favorite",
            subtitle: tags.length ? tags.join(", ") : "No tags",
            symbol: pro.intelligence.favorite ? "star.fill" : "star"
          },
          {
            id: "export",
            title: "Export",
            subtitle: "Markdown, JSON, TXT, HTML",
            symbol: "square.and.arrow.up"
          }
        ]
      }
    ]
  });

  if (!choice) {
    return;
  }

  if (choice === "transcript") {
    await showTranscript(pro);
  } else if (choice === "summary") {
    await Shared.showSuccess(
      "Summary",
      pro.intelligence.summary || "No summary yet."
    );
  } else if (choice === "favorite") {
    pro.intelligence.favorite = !pro.intelligence.favorite;
    await saveSession(pro, path);
  } else if (choice === "export") {
    await exportSessionInteractive(pro);
  }
}

async function showTranscript(session) {
  const lines = [];
  lines.push(session.metadata?.title || "Untitled");
  lines.push(`Started: ${Shared.formatDate(session.session.startedAt)}`);
  lines.push("");
  for (const turn of session.turns || []) {
    const speaker =
      turn.speaker === "me" ? "ME" : session.person.name.toUpperCase();
    lines.push(`[${Shared.formatDate(turn.timestamp)}] ${speaker}`);
    lines.push(turn.sourceText);
    lines.push(`→ ${turn.translatedText}`);
    lines.push("");
  }
  await Shared.showSuccess(session.person.name, lines.join("\n"));
}

// ============================================================
// SUMMARY / TAGS
// ============================================================

function detectAutoTags(session) {
  const text = [
    session.metadata?.context || "",
    session.metadata?.title || "",
    ...(session.turns || []).flatMap((t) => [t.sourceText, t.translatedText])
  ]
    .join(" ")
    .toLowerCase();

  const tags = [];
  for (const rule of AUTO_TAG_RULES) {
    if (rule.words.some((w) => text.includes(w))) {
      tags.push(rule.tag);
    }
  }
  if (session.metadata?.context) {
    const context = session.metadata.context.trim();
    if (context && !tags.includes(context)) {
      tags.push(context);
    }
  }
  return Shared.unique(tags);
}

function buildExtractiveSummary(session) {
  const turns = session.turns || [];
  const lines = [];
  lines.push(
    `${session.person.name} · ${turns.length} turns · ${Shared.formatDuration(session.session.durationSeconds || 0)}`
  );
  if (session.metadata?.context) {
    lines.push(`Context: ${session.metadata.context}`);
  }
  const tags = detectAutoTags(session);
  if (tags.length) {
    lines.push(`Topics: ${tags.join(", ")}`);
  }

  const sample = turns.slice(0, 3).map((t) => {
    const who = t.speaker === "me" ? "You" : session.person.name;
    return `• ${who}: ${t.translatedText || t.sourceText}`;
  });
  if (sample.length) {
    lines.push("Highlights:");
    lines.push(...sample);
  }
  return lines.join("\n");
}

// ============================================================
// PEOPLE
// ============================================================

async function runPeopleDirectory(config) {
  const people = await loadPeopleProfiles();
  if (people.length === 0) {
    await Shared.showEmptyState("people");
    return;
  }

  const choice = await Shared.presentTableMenu({
    title: "People",
    subtitle: `${people.length} profile${people.length === 1 ? "" : "s"}`,
    sections: [
      {
        rows: people.map((person, index) => ({
          id: String(index),
          title: person.name,
          subtitle: [
            person.stats?.conversationCount
              ? `${person.stats.conversationCount} chats`
              : "0 chats",
            person.metadata?.languages?.length
              ? person.metadata.languages.join(", ")
              : null
          ]
            .filter(Boolean)
            .join(" · "),
          symbol: "person.crop.circle",
          disclosure: true
        }))
      }
    ]
  });

  if (choice == null) {
    return;
  }
  await openPersonProfile(people[Number(choice)], config);
}

async function openPersonProfile(person, config) {
  const sessions = (await Conversation.loadAllSessions()).filter(
    (s) => s.person.id === person.id || s.person.name === person.name
  );

  const choice = await Shared.presentTableMenu({
    title: person.name,
    subtitle: person.stats?.lastSeen
      ? `Last seen ${Shared.formatDate(person.stats.lastSeen)}`
      : "Profile",
    sections: [
      {
        rows: [
          {
            id: "chats",
            title: "Conversations",
            subtitle: `${sessions.length} saved`,
            symbol: "bubble.left.and.bubble.right",
            disclosure: true
          },
          {
            id: "edit",
            title: "Edit Profile",
            subtitle: person.metadata?.notes
              ? person.metadata.notes.slice(0, 48)
              : "Notes, country, languages",
            symbol: "pencil"
          }
        ]
      }
    ]
  });

  if (!choice) {
    return;
  }

  if (choice === "chats") {
    if (sessions.length === 0) {
      await Shared.showError("No conversations for this person.");
      return;
    }
    await browseFiltered(
      person.name,
      (s) => s.person.id === person.id || s.person.name === person.name
    );
  } else if (choice === "edit") {
    await editPersonProfile(person, config);
  }
}

async function editPersonProfile(person, config) {
  const country = await Shared.promptForText(
    "Country",
    "Optional country.",
    person.metadata?.country || ""
  );
  if (country === null) {
    return;
  }
  const notes = await Shared.promptForText(
    "Notes",
    "Profile notes.",
    person.metadata?.notes || ""
  );
  if (notes === null) {
    return;
  }
  const languages = await Shared.promptForText(
    "Languages",
    "Comma-separated language codes (e.g. ES, EN).",
    (person.metadata?.languages || [
      config.languages.conversation,
      config.languages.primary
    ]).join(", ")
  );
  if (languages === null) {
    return;
  }

  person.metadata = person.metadata || {};
  person.metadata.country = country.trim();
  person.metadata.notes = notes.trim();
  person.metadata.languages = languages
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
  await upsertPerson(person);
  await Shared.showSuccess("Saved", `${person.name} updated.`);
}

async function loadPeopleProfiles() {
  const data = await Shared.loadJSON(Shared.PEOPLE_FILE);
  const people = Array.isArray(data) ? data : [];
  return people.map((p) => ({
    ...p,
    metadata: p.metadata || { languages: [], country: "", notes: "" },
    stats: p.stats || { conversationCount: 0, lastSeen: null }
  }));
}

async function upsertPerson(person) {
  const people = await loadPeopleProfiles();
  const idx = people.findIndex((p) => p.id === person.id);
  if (idx === -1) {
    people.push(person);
  } else {
    people[idx] = person;
  }
  await Shared.saveJSON(Shared.PEOPLE_FILE, people);
}

async function touchPersonFromSession(session) {
  const people = await loadPeopleProfiles();
  let person = people.find((p) => p.id === session.person.id);
  if (!person) {
    person = {
      id: session.person.id,
      name: session.person.name,
      createdAt: new Date().toISOString(),
      metadata: { languages: [], country: "", notes: "" },
      stats: { conversationCount: 0, lastSeen: null }
    };
    people.push(person);
  }

  const sessions = await Conversation.loadAllSessions();
  const theirs = sessions.filter(
    (s) =>
      s.person.id === session.person.id || s.person.name === session.person.name
  );

  person.stats = person.stats || {};
  person.stats.lastSeen =
    session.session.endedAt || session.session.lastActivityAt;
  person.stats.conversationCount = Math.max(theirs.length, 1);
  person.metadata = person.metadata || {};
  person.metadata.languages = Shared.unique([
    ...(person.metadata.languages || []),
    session.languages?.primary,
    session.languages?.conversation
  ]);
  await Shared.saveJSON(Shared.PEOPLE_FILE, people);
}

// ============================================================
// EXPORT
// ============================================================

async function exportFromLibrary() {
  const sessions = (await Conversation.loadAllSessions()).map(ensureProFields);
  if (sessions.length === 0) {
    await Shared.showError("No conversations to export.");
    return;
  }

  const choice = await Shared.presentTableMenu({
    title: "Export Conversation",
    subtitle: "Choose a conversation",
    sections: [
      {
        rows: sessions.map((session, index) => ({
          id: String(index),
          title: session.person.name,
          subtitle: Shared.formatDate(session.session.startedAt),
          symbol: "square.and.arrow.up",
          disclosure: true
        }))
      }
    ]
  });
  if (choice == null) {
    return;
  }
  await exportSessionInteractive(sessions[Number(choice)]);
}

async function exportSessionInteractive(session) {
  const formatChoice = await Shared.presentTableMenu({
    title: "Export Format",
    sections: [
      {
        rows: [
          { id: "md", title: "Markdown", symbol: "doc.richtext" },
          { id: "json", title: "JSON", symbol: "curlybraces" },
          { id: "txt", title: "Plain Text", symbol: "doc.plaintext" },
          { id: "html", title: "HTML", symbol: "chevron.left.forwardslash.chevron.right" }
        ]
      }
    ]
  });
  if (!formatChoice) {
    return;
  }
  const path = await exportSession(session, formatChoice);
  Pasteboard.copy(path);
  await Shared.showSuccess(
    "Exported",
    `Saved to:\n${path}\n\nPath copied to clipboard.`
  );
}

function getExportsDirectory() {
  const fm = Shared.getFileManager();
  const directory = fm.joinPath(Shared.getAppDirectory(), EXPORTS_DIRECTORY);
  if (!fm.fileExists(directory)) {
    fm.createDirectory(directory, true);
  }
  return directory;
}

async function exportSession(session, format) {
  const fm = Shared.getFileManager();
  const safeName = `${session.person.name}_${session.session.id}`
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 80);
  const filename = `${safeName}.${format}`;
  const path = fm.joinPath(getExportsDirectory(), filename);

  let body = "";
  if (format === "json") {
    const clean = JSON.parse(JSON.stringify(session));
    delete clean._filePath;
    body = JSON.stringify(clean, null, 2);
  } else if (format === "md") {
    body = toMarkdown(session);
  } else if (format === "html") {
    body = toHtml(session);
  } else {
    body = toPlainText(session);
  }

  fm.writeString(path, body);
  return path;
}

function toPlainText(session) {
  const lines = [
    session.metadata?.title || "Untitled Conversation",
    `Person: ${session.person.name}`,
    `Started: ${session.session.startedAt}`,
    `Ended: ${session.session.endedAt || ""}`,
    `Turns: ${session.session.turnCount}`,
    ""
  ];
  if (session.intelligence?.summary) {
    lines.push("SUMMARY", session.intelligence.summary, "");
  }
  for (const turn of session.turns || []) {
    const speaker = turn.speaker === "me" ? "ME" : session.person.name;
    lines.push(`[${turn.timestamp}] ${speaker}`);
    lines.push(turn.sourceText);
    lines.push(`→ ${turn.translatedText}`);
    lines.push("");
  }
  return lines.join("\n");
}

function toMarkdown(session) {
  const lines = [
    `# ${session.metadata?.title || "Conversation"}`,
    "",
    `- **Person:** ${session.person.name}`,
    `- **Started:** ${session.session.startedAt}`,
    `- **Turns:** ${session.session.turnCount}`,
    ""
  ];
  if (session.intelligence?.summary) {
    lines.push("## Summary", "", session.intelligence.summary, "");
  }
  lines.push("## Transcript", "");
  for (const turn of session.turns || []) {
    const speaker = turn.speaker === "me" ? "Me" : session.person.name;
    lines.push(`### ${speaker} · ${turn.timestamp}`, "", turn.sourceText, "");
    lines.push(`> ${turn.translatedText}`, "");
  }
  return lines.join("\n");
}

function toHtml(session) {
  const esc = (s) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const turns = (session.turns || [])
    .map((turn) => {
      const speaker = turn.speaker === "me" ? "Me" : session.person.name;
      return `<article><h3>${esc(speaker)} <small>${esc(turn.timestamp)}</small></h3><p>${esc(turn.sourceText)}</p><blockquote>${esc(turn.translatedText)}</blockquote></article>`;
    })
    .join("\n");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(session.metadata?.title || "Conversation")}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.45} blockquote{border-left:3px solid #888;margin-left:0;padding-left:1rem;color:#333}</style>
</head><body>
<h1>${esc(session.metadata?.title || "Conversation")}</h1>
<p><strong>${esc(session.person.name)}</strong> · ${esc(session.session.startedAt)}</p>
${session.intelligence?.summary ? `<section><h2>Summary</h2><pre>${esc(session.intelligence.summary)}</pre></section>` : ""}
<section><h2>Transcript</h2>${turns}</section>
</body></html>`;
}
