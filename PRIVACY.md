# ReadRiver Privacy Policy

_Last updated: 2026-10-01_

ReadRiver is a browser extension that translates words, sentences and video subtitles on the page you are reading. It has no server of its own, no accounts, no analytics and no advertising. The developer does not receive any data from the extension.

## What the extension handles

| Data | Where it is kept | Who it is sent to |
|---|---|---|
| Text you choose to translate (a double-clicked word, a selection, a subtitle line, a popup search) and, for saved words, the sentence around them | Translation cache, history and saved words in `chrome.storage.local` on your device | Only the translation sources you have enabled (see below) |
| API keys you enter in Settings | `chrome.storage.local` on your device | Only the provider the key belongs to, as the request's authentication |
| Settings and preferences | `chrome.storage.local` on your device | Nobody |
| Usage counters (request, error, character and token counts per source; no text) | `chrome.storage.local` on your device | Nobody |

The extension reads page text only when you trigger a translation (double-click, selection, one-click mode, subtitle hover, context menu). It does not collect browsing history and does not send page content anywhere on its own.

## Third-party services

Text you translate is sent directly from your browser to the sources that are enabled in Settings, and to no one else:

- **Google Translate** (`translate.googleapis.com`, or the official Cloud Translation API if you add a key)
- **MyMemory** (`api.mymemory.translated.net`)
- **Tatoeba** (`tatoeba.org`), for example sentences
- **DeepL** and **Microsoft Azure Translator**, only if you add your own key
- **LLM providers you add yourself**, such as Google Gemini, Anthropic, OpenAI, OpenRouter, Groq, NVIDIA, Cerebras, Mistral, GitHub Models, SambaNova, Hugging Face, Cloudflare Workers AI, DeepSeek, Together AI, or any OpenAI-compatible endpoint you configure

Each of these services handles the text under its own privacy policy. With a local provider (Ollama, LM Studio) the text sent to the LLM stays on your computer.

## Sharing and selling

ReadRiver does not sell or transfer your data to third parties, does not use it for purposes unrelated to translation, and does not use it for advertising or creditworthiness.

## Your control

- Turn any source off in **Settings → Sources**; disabled sources receive nothing.
- Turn off or clear the translation cache, history, saved words and usage counters in **Settings**.
- Removing the extension deletes everything it stored.

## Contact

Questions or requests: open an issue at <https://github.com/alitaghiyev/readriver-extension/issues>.
