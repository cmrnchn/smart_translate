// SmartTranslatePro.js
//
// SmartTranslate Pro — lean Scriptable entry.
//
// Home:
//   Translate › · Conversation · Library · People · Settings
//
// Keep: search/favorites/export, people, light post-session summary
// Dropped from UI: Insights (timeline/stats/learning/voices), long end wizard
//
// Requires (modular) or paste scripts/dist/SmartTranslatePro.js
//
// Version: 1.1.0-pro-standalone

let Shared;
let Conversation;
let Pro;
let UI;
let modulesLoaded = false;
try {
  Shared = importModule("SmartTranslateShared");
  Conversation = importModule("SmartTranslateConversation");
  Pro = importModule("SmartTranslateProKit");
  UI = importModule("SmartTranslateUI");
  modulesLoaded = true;
} catch (error) {
  const alert = new Alert();
  alert.title = "Missing Scriptable Modules";
  alert.message =
    "Could not import required modules.\n\n" +
    "Fix: create scripts named EXACTLY:\n" +
    "• SmartTranslateShared\n" +
    "• SmartTranslateConversation\n" +
    "• SmartTranslateProKit\n" +
    "• SmartTranslateUI\n" +
    "• SmartTranslatePro\n\n" +
    "Or paste scripts/dist/SmartTranslatePro.js as ONE script.";
  alert.addAction("OK");
  await alert.presentAlert();
}

if (modulesLoaded) {
  await main();
}
Script.complete();

async function main() {
  let config = await Shared.loadConfig();

  if (!config || !config.version) {
    const isFirstRun = !config;
    config = await runSetupWizard(isFirstRun, null);
    if (!config) {
      return;
    }
    await Shared.saveConfig(config);
    if (isFirstRun) {
      await Shared.showSuccess(
        "Setup Complete",
        "SmartTranslate Pro is ready."
      );
      return;
    }
  }

  // Stay in the home UITable until the user dismisses it.
  while (true) {
    const action = await showMainMenu(config);
    if (!action || action === "cancel") {
      break;
    }
    await runProAction(action, config);
    config = (await Shared.loadConfig()) || config;
  }
}

async function runProAction(action, config) {
  switch (action) {
    case "type":
      await runType(config);
      break;
    case "paste":
      await runPaste(config);
      break;
    case "dictate":
      await runDictate(config);
      break;
    case "continue":
      await Conversation.runConversation(config, {
        onCompleted: Pro.processCompletedSession,
        forceAction: "continue"
      });
      break;
    case "conversation":
      await Conversation.runConversation(config, {
        onCompleted: Pro.processCompletedSession
      });
      break;
    case "library":
      await Pro.runLibrary(config);
      break;
    case "people":
      await Pro.runPeopleDirectory(config);
      break;
    case "settings":
      await runSettingsMenu(config);
      break;
    default:
      break;
  }
}

// ============================================================
// HOME MENU
// ============================================================

async function buildHomeContext(config) {
  const sessions = await Conversation.loadAllSessions();
  const active = await Shared.loadJSON(Shared.ACTIVE_SESSION_FILE);
  const peopleData = await Shared.loadJSON(Shared.PEOPLE_FILE);
  const people = Array.isArray(peopleData) ? peopleData : [];

  let favoriteCount = 0;
  for (const session of sessions) {
    if (session.intelligence && session.intelligence.favorite) {
      favoriteCount += 1;
    }
  }

  const libraryMeta =
    sessions.length === 0
      ? "No saved chats yet"
      : `${sessions.length} chat${sessions.length === 1 ? "" : "s"}${favoriteCount ? ` · ${favoriteCount} ★` : ""}`;

  const peopleMeta =
    people.length === 0
      ? "Add people as you chat"
      : `${people.length} profile${people.length === 1 ? "" : "s"}`;

  return {
    primaryLang: Shared.getLanguageDisplayName(config.languages.primary),
    conversationLang: Shared.getLanguageDisplayName(config.languages.conversation),
    primaryFlag: UI?.flagForCode
      ? UI.flagForCode(config.languages.primary)
      : "🌐",
    conversationFlag: UI?.flagForCode
      ? UI.flagForCode(config.languages.conversation)
      : "🌐",
    engine: config.speech.engine === "apple" ? "Apple Voice" : "ElevenLabs",
    activeSession: active?.person?.name
      ? {
          name: active.person.name,
          turns: active.session?.turnCount || 0
        }
      : null,
    libraryMeta,
    peopleMeta
  };
}

async function showMainMenu(config) {
  const context = await buildHomeContext(config);

  if (UI && typeof UI.presentProHome === "function") {
    try {
      const action = await UI.presentProHome(context);
      if (!action) {
        return "cancel";
      }
      return action;
    } catch (error) {
      console.error(`Pro home WebView failed: ${error?.message || error}`);
    }
  }

  return await showMainMenuFallback(config);
}

async function showMainMenuFallback(config) {
  const engine = config.speech.engine === "apple" ? "Apple" : "ElevenLabs";
  const pair = `${Shared.getLanguageDisplayName(config.languages.primary)} ↔ ${Shared.getLanguageDisplayName(config.languages.conversation)}`;

  while (true) {
    const choice = await Shared.presentTableMenu({
      title: "SmartTranslate Pro",
      subtitle: `${pair} · ${engine}`,
      sections: [
        {
          header: "Translate",
          rows: [
            {
              id: "translate",
              title: "Quick Translate",
              subtitle: "Type, paste, or dictate",
              symbol: "character.bubble",
              disclosure: true
            },
            {
              id: "conversation",
              title: "Conversation",
              subtitle: "Multi-turn with a person",
              symbol: "person.2"
            }
          ]
        },
        {
          header: "Review",
          rows: [
            {
              id: "library",
              title: "Library",
              subtitle: "Search, favorites, export",
              symbol: "books.vertical"
            },
            {
              id: "people",
              title: "People",
              subtitle: "Profiles and past chats",
              symbol: "person.crop.circle"
            }
          ]
        },
        {
          header: "App",
          rows: [
            {
              id: "settings",
              title: "Settings",
              subtitle: "Languages, keys, speech",
              symbol: "gearshape"
            }
          ]
        }
      ]
    });

    if (!choice) {
      return "cancel";
    }

    if (choice === "translate") {
      const nested = await showTranslateMenu();
      if (!nested) {
        continue;
      }
      return nested;
    }

    return choice;
  }
}

async function showTranslateMenu() {
  return await Shared.presentTableMenu({
    title: "Quick Translate",
    subtitle: "One shot",
    sections: [
      {
        rows: [
          {
            id: "type",
            title: "Type",
            subtitle: "Enter text",
            symbol: "keyboard"
          },
          {
            id: "paste",
            title: "Paste",
            subtitle: "From clipboard",
            symbol: "doc.on.clipboard"
          },
          {
            id: "dictate",
            title: "Dictate",
            subtitle: "Speak to translate",
            symbol: "mic"
          }
        ]
      }
    ]
  });
}

// ============================================================
// ONE-SHOT
// ============================================================

async function runType(config) {
  const text = await Shared.promptForText(
    "Type",
    "Enter the text to translate."
  );
  if (text === null) {
    return;
  }
  await Shared.runOneShot(text, config);
}

async function runPaste(config) {
  const text = Pasteboard.paste() || "";
  if (!text.trim()) {
    await Shared.showError("Clipboard is empty.");
    return;
  }
  await Shared.runOneShot(text, config);
}

async function runDictate(config) {
  try {
    const text = await Shared.dictateText(config);
    if (!text || !text.trim()) {
      await Shared.showError("No speech was captured.");
      return;
    }
    await Shared.runOneShot(text, config);
  } catch (error) {
    await Shared.showError(
      `Dictation failed.\n\n${error?.message || "Unknown error."}`
    );
  }
}

async function runSettingsMenu(config) {
  while (true) {
    const deeplSaved = Shared.hasSecret(Shared.DEEPL_KEYCHAIN_KEY);
    const elevenSaved = Shared.hasSecret(Shared.ELEVENLABS_KEYCHAIN_KEY);
    const choice = await Shared.presentTableMenu({
      title: "Settings",
      subtitle: deeplSaved
        ? `DeepL saved ${Shared.maskSecret(Shared.getOptionalKey(Shared.DEEPL_KEYCHAIN_KEY))}`
        : "DeepL key missing",
      sections: [
        {
          rows: [
            {
              id: "preferences",
              title: "Languages & Speech",
              subtitle: "Targets, dictation, voice engine",
              symbol: "globe"
            },
            {
              id: "keys",
              title: "API Keys",
              subtitle: deeplSaved
                ? `DeepL ${Shared.maskSecret(Shared.getOptionalKey(Shared.DEEPL_KEYCHAIN_KEY))}${elevenSaved ? " · ElevenLabs saved" : ""}`
                : "Set up DeepL and ElevenLabs",
              symbol: "key"
            },
            {
              id: "test",
              title: "Test Translation",
              subtitle: "Verify DeepL + speech",
              symbol: "checkmark.seal"
            }
          ]
        }
      ]
    });

    if (!choice) {
      return;
    }

    if (choice === "preferences") {
      const newConfig = await runSetupWizard(false, config, {
        promptForKeys: false
      });
      if (newConfig) {
        await Shared.saveConfig(newConfig);
        config = newConfig;
      }
    } else if (choice === "keys") {
      await manageApiKeys();
    } else if (choice === "test") {
      await testConfiguration(config);
    }
  }
}

async function manageApiKeys() {
  await Shared.runApiKeyWizard({ mode: "hub" });
}

// ============================================================
// SETUP
// ============================================================

async function runSetupWizard(isFirstRun, existingConfig, options = {}) {
  const promptForKeys = options.promptForKeys !== false;
  let config = Shared.deepMerge(Shared.DEFAULT_CONFIG, existingConfig || {});

  if (isFirstRun) {
    const welcome = new Alert();
    welcome.title = "Welcome to SmartTranslate Pro";
    welcome.message =
      "Lean Pro: translate, conversations, library, and people.\n\nYour DeepL key is saved once in Keychain and reused.";
    welcome.addAction("Start Setup");
    await welcome.present();
  }

  if (promptForKeys || !Shared.hasSecret(Shared.DEEPL_KEYCHAIN_KEY)) {
    const keysOk = await Shared.runApiKeyWizard({
      mode: "deepl",
      required: true,
      isFirstRun: !!isFirstRun
    });
    if (!keysOk) {
      return null;
    }
  }

  config.languages.primary = await Shared.chooseLanguage(
    "Your Primary Language",
    "What is your primary language?",
    config.languages.primary
  );
  if (!config.languages.primary) {
    return null;
  }

  config.languages.conversation = await Shared.chooseLanguage(
    "Conversation Language",
    "What language are you translating with?",
    config.languages.conversation,
    [config.languages.primary]
  );
  if (!config.languages.conversation) {
    return null;
  }

  config.languages.defaultTarget = await Shared.chooseLanguage(
    "Default Translation Target",
    "When the input is not already this language, translate to:",
    config.languages.defaultTarget
  );
  if (!config.languages.defaultTarget) {
    return null;
  }

  const dictationOptions = [
    "Automatic",
    ...Shared.LANGUAGE_OPTIONS.map((lang) => `${lang.name} (${lang.code})`)
  ];
  const dictationChoice = await Shared.chooseFromList(
    "Dictation Language",
    dictationOptions,
    "Language hint for Dictate."
  );
  if (dictationChoice === -1) {
    return null;
  }
  config.input.dictationLanguage =
    dictationChoice === 0
      ? "auto"
      : Shared.LANGUAGE_OPTIONS[dictationChoice - 1].code;

  const engineChoice = await Shared.chooseFromList(
    "Speech Engine",
    ["Apple Native Voice", "ElevenLabs (requires API key)"],
    "Choose how translations are spoken."
  );
  if (engineChoice === -1) {
    return null;
  }
  config.speech.engine = engineChoice === 0 ? "apple" : "elevenlabs";

  if (config.speech.engine === "apple") {
    config.speech.apple.rate = await Shared.chooseSlider(
      "Apple Speech Rate",
      config.speech.apple.rate,
      0.1,
      1.0
    );
  } else {
    const elevenLabsKey = await Shared.runApiKeyWizard({
      mode: "elevenlabs",
      required: false
    });
    config.speech.elevenlabs.enabled = !!elevenLabsKey;

    if (config.speech.elevenlabs.enabled) {
      const voiceResult = await configureElevenLabsVoices(
        config,
        elevenLabsKey
      );
      if (!voiceResult) {
        return null;
      }
      config.speech.elevenlabs.voices = voiceResult;
    }
  }

  const shouldTest = await Shared.chooseBoolean(
    "Test Configuration",
    "Test translation and speech now?",
    true
  );
  if (shouldTest) {
    await testConfiguration(config);
  }

  return config;
}

async function configureElevenLabsVoices(config, elevenLabsKey) {
  const languages = Shared.unique([
    config.languages.primary,
    config.languages.conversation,
    config.languages.defaultTarget
  ]);
  const newVoices = { ...config.speech.elevenlabs.voices };

  let allApiVoices;
  try {
    allApiVoices = await Shared.fetchElevenLabsVoices(elevenLabsKey);
  } catch (error) {
    await Shared.showError(
      `Could not load ElevenLabs voices.\n\n${error?.message || "Unknown error."}`
    );
    return null;
  }

  for (const langCode of languages) {
    const langName = Shared.getLanguageDisplayName(langCode);
    const compatibleVoices = allApiVoices
      .filter((v) => {
        const supported =
          v.labels?.language?.toLowerCase() ===
          langCode.slice(0, 2).toLowerCase();
        const isMultilingual =
          v.category === "premade" &&
          v.name.toLowerCase().includes("multilingual");
        return supported || isMultilingual;
      })
      .slice(0, Shared.MAX_VOICE_RESULTS);

    if (compatibleVoices.length === 0) {
      continue;
    }

    const labels = compatibleVoices.map((v) => v.name);
    const choice = await Shared.chooseFromList(`${langName} AI Voice`, labels);
    if (choice === -1) {
      continue;
    }

    const selected = compatibleVoices[choice];
    newVoices[langCode] = {
      voiceId: selected.voice_id,
      name: selected.name
    };
  }

  return newVoices;
}

async function testConfiguration(config) {
  const testText = await Shared.promptForText(
    "Configuration Test",
    "Enter a short sentence to test translation and speech.",
    "Hello, world!"
  );
  if (!testText) {
    return;
  }

  try {
    const deeplKey = Shared.getRequiredKey(
      Shared.DEEPL_KEYCHAIN_KEY,
      "DeepL"
    );
    const { translation, detectedLanguage, targetLanguage } =
      await Shared.translateWithDeepL(testText, deeplKey, config.languages);

    const summary = `Detected: ${detectedLanguage}\nTarget: ${targetLanguage}\n\n${translation}`;
    const alert = new Alert();
    alert.title = "Translation Test";
    alert.message = summary;
    alert.addAction("OK");
    alert.addAction("Speak");
    const choice = await alert.presentAlert();
    if (choice === 1) {
      await Shared.speakTranslation(translation, targetLanguage, config);
    }
  } catch (error) {
    await Shared.showError(
      `Configuration test failed.\n\n${error?.message || "Unknown error."}`
    );
  }
}
