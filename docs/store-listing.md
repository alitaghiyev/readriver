# Chrome Web Store submission notes

Texts to paste into the Developer Dashboard. Build the package from a committed tree:

```bash
git archive --format=zip -o readriver.zip HEAD
```

`.gitattributes` leaves `docs/`, the READMEs and other repo-only files out; git-ignored files (local keys) are never included.

## Store listing

- **Category:** Tools (or Education)
- **Language:** English (Turkish comes from `_locales/tr`)
- **Screenshots:** 1280×800 or 640×400, taken from `docs/screenshots/`
- **Privacy policy URL:** https://github.com/alitaghiyev/readriver/blob/main/PRIVACY.md

## Single purpose

ReadRiver translates words, sentences and video subtitles on the page the user is reading and lets them save words for flashcard review.

## Permission justifications

| Permission | Justification |
|---|---|
| `storage` | Stores settings, the user's API keys, the translation cache, history, saved words and usage counters locally. |
| `contextMenus` | Adds the "Translate with ReadRiver" item to the right-click menu for selected text. |
| `tabs` | Detects when a tab becomes active or finishes loading to check whether the content script is still alive there, and shows a warning badge if it is not. |
| `scripting` | Re-injects the content script into the current tab when the user presses "Reset" after the extension was updated, so the page does not need a reload. |
| `activeTab` | Lets the toolbar popup and the keyboard shortcut act on the current tab (toggle one-click mode, reset). |
| `webNavigation` | Lists the frames of the current tab so "Reset" can re-inject the content script into each frame; embedded video players usually live in a cross-origin iframe. |
| Host permissions for translation and LLM APIs | The service worker sends the text the user chose to translate to the translation source or LLM provider the user enabled. Each listed host is one such provider. |
| `http://localhost/*`, `http://127.0.0.1/*` | Local LLM servers (Ollama, LM Studio, OmniRoute) that the user runs on their own machine. |
| `https://*/*`, `http://*/*` | Needed by "Reset" to inject the content script into cross-origin iframes (e.g. embedded video players), which `activeTab` does not cover. Also lets users add a custom OpenAI-compatible endpoint on any host. |
| Content script on `<all_urls>` | Translation is triggered by double-click, selection or subtitle hover on any page the user reads, so the script has to be present on every site. It only reads the text the user points at. |

## Remote code

No remote code. All scripts are in the package; network requests only fetch JSON from translation and LLM APIs.

## Data usage

- Collected: **Website content** (the text the user chooses to translate is sent to the enabled translation source). Nothing else.
- Not sold or transferred to third parties beyond the translation sources the user enabled.
- Not used for purposes unrelated to the single purpose, nor for creditworthiness or lending.
