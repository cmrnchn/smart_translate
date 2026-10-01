// SmartTranslateConversation.js
//
// Conversation Mode engine for SmartTranslate v1.
//
// Locked V1 contract:
//   - Start / resume / end session
//   - Select or create person
//   - Optional metadata: title, context, notes (no auto location)
//   - Explicit speaker each turn: Me | Person
//   - Capture: Dictate (default), Type, or Paste
//   - Persist turn to active_session.json BEFORE TTS
//   - Continue / End after each turn
//   - History: list completed sessions → show transcript
//
// Out of scope: summaries, search, tags, diarization, SQLite,
// embeddings, cloud sync, audio archive, live custom UI.
//
// Version: 1.0.0

const Shared = importModule("SmartTranslateShared");

module.exports = {
  runConversation,
  loadAllSessions,
  getConversationFilePath
};

// ============================================================
// ENTRY
// ============================================================

async function runConversation(config, hooks = {}) {
  const menu = hooks.forceAction || (await showConversationMenu(hooks));
  switch (menu) {
    case "continue": {
      const session = await loadActiveSession();
      if (!session) {
        await Shared.showError("No active conversation exists.");
        return;
      }
      await showSessionSummary(session);
      await turnLoop(session, config, hooks);
      break;
    }
    case "new":
      await runNewSessionFlow(config, hooks);
      break;
    case "history":
      await showHistory();
      break;
    default:
      break;
  }
}

async function showConversationMenu(hooks = {}) {
  const active = await loadActiveSession();

  if (active) {
    const choice = await Shared.presentTableMenu({
      title: "Conversation",
      subtitle: `Active with ${active.person.name} · ${active.session.turnCount} turns`,
      sections: [
        {
          rows: [
            {
              id: "continue",
              title: "Continue",
              subtitle: "Resume the active session",
              symbol: "play.fill"
            },
            {
              id: "history",
              title: "History",
              subtitle: "Browse saved conversations",
              symbol: "clock"
            },
            {
              id: "end",
              title: "End Active",
              subtitle: "Finalize and save",
              symbol: "checkmark.circle"
            },
            {
              id: "discard",
              title: "Discard & Start New",
              subtitle: "Delete active turns",
              symbol: "trash"
            }
          ]
        }
      ]
    });

    if (!choice) {
      return "cancel";
    }
    if (choice === "discard") {
      const abandon = await Shared.confirm(
        "Discard Active Conversation?",
        "This permanently discards the active conversation and its turns."
      );
      if (!abandon) {
        return "cancel";
      }
      await deleteActiveSession();
      return "new";
    }
    if (choice === "end") {
      await endConversation(active, hooks);
      return "cancel";
    }
    return choice;
  }

  const choice = await Shared.presentTableMenu({
    title: "Conversation",
    subtitle: "Start or review",
    sections: [
      {
        rows: [
          {
            id: "new",
            title: "New Conversation",
            subtitle: "Pick a person and begin",
            symbol: "plus.bubble"
          },
          {
            id: "history",
            title: "History",
            subtitle: "Browse saved conversations",
            symbol: "clock"
          }
        ]
      }
    ]
  });

  return choice || "cancel";
}

async function runNewSessionFlow(config, hooks = {}) {
  const session = await startConversation(config);
  if (!session) {
    return;
  }
  await showSessionSummary(session);
  await turnLoop(session, config, hooks);
}

// ============================================================
// START
// ============================================================

async function startConversation(config) {
  const person = await selectOrCreatePerson();
  if (!person) {
    return null;
  }

  const metadata = await collectConversationMetadata(person);
  if (!metadata) {
    return null;
  }

  const now = new Date().toISOString();
  const session = {
    schemaVersion: 1,
    session: {
      id: Shared.generateUUID(),
      status: "active",
      startedAt: now,
      endedAt: null,
      lastActivityAt: now,
      turnCount: 0,
      durationSeconds: null
    },
    person: {
      id: person.id,
      name: person.name
    },
    languages: {
      primary: config.languages.primary,
      conversation: config.languages.conversation,
      defaultTarget: config.languages.defaultTarget
    },
    metadata,
    turns: []
  };

  await saveActiveSession(session);
  return session;
}

async function collectConversationMetadata(person) {
  const defaultTitle = `${person.name} — ${new Date().toLocaleDateString()}`;

  const title = await Shared.promptForText(
    "Conversation Title",
    "Optional title for this conversation.",
    defaultTitle
  );
  if (title === null) {
    return null;
  }

  const context = await Shared.promptForText(
    "Context",
    "Optional context, such as Travel, Home, Work, or General."
  );
  if (context === null) {
    return null;
  }

  const notes = await Shared.promptForText(
    "Notes",
    "Optional notes about this conversation."
  );
  if (notes === null) {
    return null;
  }

  return {
    title: title.trim(),
    context: context.trim(),
    notes: notes.trim()
  };
}

// ============================================================
// TURN LOOP
// ============================================================

async function turnLoop(session, config, hooks = {}) {
  let current = session;

  while (true) {
    const outcome = await processTurn(current, config);
    if (outcome === "end") {
      await endConversation(current, hooks);
      return;
    }
    if (outcome === "cancel") {
      return;
    }
    // Reload from disk so we always hold the persisted session.
    current = (await loadActiveSession()) || current;

    const next = await promptAfterTurn(current);
    if (next === "end") {
      await endConversation(current, hooks);
      return;
    }
    if (next === "stop") {
      return;
    }
  }
}

async function processTurn(session, config) {
  const input = await getTurnInput(config);
  if (!input) {
    return "cancel";
  }

  const text = input.text.trim();
  if (!text) {
    await Shared.showError("No speech or text was captured.");
    return "continue";
  }

  if (text.length > Shared.MAX_INPUT_LENGTH) {
    await Shared.showError(
      `This turn is too long.\n\nMaximum: ${Shared.MAX_INPUT_LENGTH.toLocaleString()} characters.`
    );
    return "continue";
  }

  const speaker = await chooseSpeaker(session.person.name);
  if (!speaker) {
    return "cancel";
  }

  try {
    const deeplKey = Shared.getRequiredKey(
      Shared.DEEPL_KEYCHAIN_KEY,
      "DeepL"
    );
    const translation = await Shared.translateWithDeepL(
      text,
      deeplKey,
      session.languages
    );

    const turn = {
      id: Shared.generateUUID(),
      timestamp: new Date().toISOString(),
      speaker,
      sourceLanguage: translation.detectedLanguage,
      sourceText: text,
      targetLanguage: translation.targetLanguage,
      translatedText: translation.translation
    };

    // Persist BEFORE audio playback.
    session.turns.push(turn);
    session.session.turnCount = session.turns.length;
    session.session.lastActivityAt = new Date().toISOString();
    await saveActiveSession(session);

    Script.setShortcutOutput(
      JSON.stringify({
        action: "TURN_COMPLETE",
        sessionId: session.session.id,
        turn
      })
    );

    try {
      await Shared.speakTranslation(
        turn.translatedText,
        turn.targetLanguage,
        config
      );
    } catch (speechError) {
      console.error(`Speech failed: ${speechError.message}`);
      await Shared.showError(
        `Turn saved, but speech failed.\n\n${speechError?.message || "Unknown error."}`
      );
    }

    return "continue";
  } catch (error) {
    await Shared.showError(
      `Turn failed. The conversation was not modified.\n\n${error?.message || "Unknown error."}`
    );
    return "continue";
  }
}

async function getTurnInput(config) {
  const choice = await Shared.presentTableMenu({
    title: "Conversation Turn",
    subtitle: "Capture the next turn",
    sections: [
      {
        rows: [
          {
            id: "dictate",
            title: "Dictate",
            subtitle: "Speak this turn",
            symbol: "mic"
          },
          {
            id: "type",
            title: "Type",
            subtitle: "Enter what was said",
            symbol: "keyboard"
          },
          {
            id: "paste",
            title: "Paste",
            subtitle: "Use clipboard text",
            symbol: "doc.on.clipboard"
          }
        ]
      }
    ]
  });

  if (!choice) {
    return null;
  }

  if (choice === "dictate") {
    try {
      const text = await Shared.dictateText(config);
      return { type: "dictation", text: text || "" };
    } catch (error) {
      await Shared.showError(
        `Dictation failed.\n\n${error?.message || "Unknown error."}`
      );
      return null;
    }
  }

  if (choice === "type") {
    const text = await Shared.promptForText(
      "Type Turn",
      "Enter what was said."
    );
    if (text === null) {
      return null;
    }
    return { type: "text", text };
  }

  if (choice === "paste") {
    return {
      type: "clipboard",
      text: Pasteboard.paste() || ""
    };
  }

  return null;
}

async function chooseSpeaker(personName) {
  const choice = await Shared.presentTableMenu({
    title: "Who Spoke?",
    subtitle: "Select the speaker for this turn",
    sections: [
      {
        rows: [
          {
            id: "me",
            title: "Me",
            subtitle: "You spoke this turn",
            symbol: "person.fill"
          },
          {
            id: "person",
            title: personName || "Person",
            subtitle: "Your conversation partner",
            symbol: "person.crop.circle"
          }
        ]
      }
    ]
  });

  if (!choice) {
    return null;
  }
  return choice;
}

async function promptAfterTurn(session) {
  const choice = await Shared.presentTableMenu({
    title: "Turn Saved",
    subtitle: `${session.person.name} · ${session.session.turnCount} turns`,
    sections: [
      {
        rows: [
          {
            id: "continue",
            title: "Continue",
            subtitle: "Capture another turn",
            symbol: "play.fill"
          },
          {
            id: "end",
            title: "End Conversation",
            subtitle: "Save and finish",
            symbol: "checkmark.circle"
          },
          {
            id: "stop",
            title: "Pause",
            subtitle: "Keep active for later",
            symbol: "clock"
          }
        ]
      }
    ]
  });

  if (!choice) {
    return "stop";
  }
  return choice;
}

// ============================================================
// END
// ============================================================

async function endConversation(session, hooks = {}) {
  if (!session) {
    await Shared.showError("No active conversation exists.");
    return null;
  }

  const shouldEnd = await Shared.confirm(
    "End Conversation?",
    `Finish the conversation with ${session.person.name}?`
  );
  if (!shouldEnd) {
    return null;
  }

  const endedAt = new Date();
  session.session.status = "completed";
  session.session.endedAt = endedAt.toISOString();
  session.session.lastActivityAt = endedAt.toISOString();

  const start = new Date(session.session.startedAt);
  session.session.durationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - start.getTime()) / 1000)
  );

  const finalPath = await saveCompletedConversation(session);
  await deleteActiveSession();

  await Shared.showSuccess(
    "Conversation Saved",
    `${session.person.name}\n\n${session.session.turnCount} turns\n${Shared.formatDuration(session.session.durationSeconds)}`
  );

  Script.setShortcutOutput(
    JSON.stringify({
      action: "COMPLETED",
      sessionId: session.session.id,
      filePath: finalPath
    })
  );

  if (typeof hooks.onCompleted === "function") {
    await hooks.onCompleted(session, finalPath);
  }

  return { session, finalPath };
}

// ============================================================
// PEOPLE
// ============================================================

async function selectOrCreatePerson() {
  const people = await loadPeople();
  const rows = people.map((person, index) => ({
    id: String(index),
    title: person.name,
    subtitle: "Existing person",
    symbol: "person.fill"
  }));
  rows.push({
    id: "new",
    title: "New Person",
    subtitle: "Create a profile",
    symbol: "person.badge.plus"
  });

  const choice = await Shared.presentTableMenu({
    title: "Who are you talking to?",
    subtitle: "Select or create",
    sections: [{ rows }]
  });

  if (!choice) {
    return null;
  }

  if (choice === "new") {
    const name = await Shared.promptForText(
      "New Person",
      "Enter the person's name."
    );
    if (!name) {
      return null;
    }
    const person = {
      id: Shared.generateUUID(),
      name: name.trim(),
      createdAt: new Date().toISOString()
    };
    people.push(person);
    await savePeople(people);
    return person;
  }

  return people[Number(choice)] || null;
}

async function loadPeople() {
  const data = await Shared.loadJSON(Shared.PEOPLE_FILE);
  return Array.isArray(data) ? data : [];
}

async function savePeople(people) {
  await Shared.saveJSON(Shared.PEOPLE_FILE, people);
}

// ============================================================
// HISTORY
// ============================================================

async function loadAllSessions() {
  const files = await Shared.listConversationFiles();
  const sessions = [];
  for (const path of files) {
    const session = await Shared.loadJSON(path);
    if (session && session.person && session.session) {
      session._filePath = path;
      sessions.push(session);
    }
  }
  sessions.sort(
    (a, b) =>
      new Date(b.session.startedAt).getTime() -
      new Date(a.session.startedAt).getTime()
  );
  return sessions;
}

function getConversationFilePath(session) {
  if (session._filePath) {
    return session._filePath;
  }
  const fm = Shared.getFileManager();
  return fm.joinPath(
    Shared.getConversationsDirectory(),
    `session_${session.session.id}.json`
  );
}

async function showHistory() {
  const sessions = await loadAllSessions();
  if (sessions.length === 0) {
    await Shared.showError("No saved conversations.");
    return;
  }

  const choice = await Shared.presentTableMenu({
    title: "History",
    subtitle: `${sessions.length} conversation${sessions.length === 1 ? "" : "s"}`,
    sections: [
      {
        rows: sessions.map((session, index) => ({
          id: String(index),
          title: session.person.name,
          subtitle: `${Shared.formatDate(session.session.startedAt)} · ${session.session.turnCount} turns`,
          symbol: "bubble.left.and.bubble.right",
          disclosure: true
        }))
      }
    ]
  });

  if (choice == null) {
    return;
  }
  await displayConversation(sessions[Number(choice)]);
}

async function displayConversation(session) {
  const lines = [];
  lines.push(session.person.name);
  lines.push("");
  lines.push(session.metadata?.title || "Untitled Conversation");
  if (session.metadata?.context) {
    lines.push(`Context: ${session.metadata.context}`);
  }
  lines.push(`Started: ${Shared.formatDate(session.session.startedAt)}`);
  lines.push(`Turns: ${session.session.turnCount}`);
  if (session.session.durationSeconds != null) {
    lines.push(
      `Duration: ${Shared.formatDuration(session.session.durationSeconds)}`
    );
  }
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

async function showSessionSummary(session) {
  await Shared.showSuccess(
    "Conversation Active",
    `Person: ${session.person.name}\n\n` +
      `Languages: ${Shared.getLanguageDisplayName(session.languages.primary)} ↔ ${Shared.getLanguageDisplayName(session.languages.conversation)}\n\n` +
      `Turns: ${session.session.turnCount}`
  );
}

// ============================================================
// SESSION STORAGE
// ============================================================

async function saveActiveSession(session) {
  await Shared.saveJSON(Shared.ACTIVE_SESSION_FILE, session);
}

async function loadActiveSession() {
  return await Shared.loadJSON(Shared.ACTIVE_SESSION_FILE);
}

async function deleteActiveSession() {
  await Shared.deleteFile(Shared.ACTIVE_SESSION_FILE);
}

async function saveCompletedConversation(session) {
  const fm = Shared.getFileManager();
  const filename = `session_${session.session.id}.json`;
  const path = fm.joinPath(Shared.getConversationsDirectory(), filename);
  await Shared.saveJSON(path, session);
  return path;
}
