# Knowledge Without Borders

**Collect Knowledge. Preserve Wisdom. Share Without Borders.**

Knowledge Without Borders (KWB) is a local-first, multilingual Windows desktop application for collecting, organizing, searching, translating, and exchanging research insights and other pieces of knowledge.

**Current release: 0.2.3** · **Platform: Windows x64**

[Download the latest release](https://github.com/aboalmaty/knowledge-without-borders/releases/latest) · [Arabic guide](README_AR.md) · [Changelog](CHANGELOG.md)

## What is KWB?

KWB treats each research insight—called a *benefit* in the application—as a structured entry in a personal knowledge library. Entries can be organized into hierarchical categories, enriched with source and attribution details, searched locally, linked to translation records, and exchanged with other KWB users through `.kwb` files.

The project grew out of an earlier research-notes application created in 2007 and is being rebuilt as a modern, multilingual desktop application.

## Features available in 0.2.3

### Build and organize a knowledge library

- Create and manage main categories and subcategories.
- Add, edit, and delete knowledge entries.
- Record details such as author, book, volume, page, source language, and owner/attribution.
- Use the rich-text editor for basic formatting, lists, quotations, font family and size, text color, and text highlighting.
- View library activity and category statistics on the dashboard.
- Choose among Light, Dark, Warm Paper, and Soft Green themes, and adjust the interface scale.

### Search and multilingual interface

- Search entry titles and content, as well as author, book, and attribution fields.
- Use local lexical search with initial Arabic normalization (including common letter variations, diacritics, and tatweel handling).
- Use the interface in Arabic, English, Spanish, French, Chinese, or Urdu.
- The interface switches automatically to RTL for Arabic and Urdu and LTR for the other interface languages.
- Store translation records linked to their original entries, including target language, translator, and translation status. Content and translation languages are not limited to the six interface languages.

> KWB currently manages and stores translation records; an automatic translation provider has not yet been integrated.

### Exchange selected knowledge

- Select all entries in a chosen main or subcategory in one step; selecting a main category includes its descendants.
- Export selected entries and their required category structure and translation records to a `.kwb` exchange file.
- Import `.kwb` files while preserving entry identifiers and available source/attribution information.
- Choose between sharing selected benefits as text or exporting them as an importable `.kwb` library file.
-  KWB attempts to launch the installed WhatsApp or Telegram desktop app through its registered URI protocol. If Windows cannot open the URI, KWB falls back to the web version. Messenger continues to use the web version with clipboard-assisted text sharing.- For `.kwb` sharing, KWB attempts to open the installed WhatsApp or Telegram app, then selects the exported file in Downloads for manual attachment. The user confirms the recipient and sends the file; KWB never uploads or sends it automatically.

### Local-first by design

- The desktop library is stored in a local SQLite database.
- Core library management and text search work without an internet connection.
- No cloud account is required for local use.

## Download and install

Get the current Windows x64 installers from the **[latest GitHub Release](https://github.com/aboalmaty/knowledge-without-borders/releases/latest)**:

- **EXE installer (NSIS)**
- **MSI installer**

Back up your knowledge library before installing an update. Install the new version over the existing installation; do not manually delete the application's data directory.

## Interface languages

| Language | Interface direction |
|---|---|
| Arabic | RTL |
| English | LTR |
| Spanish | LTR |
| French | LTR |
| Chinese | LTR |
| Urdu | RTL |

The language used for an entry or its translation can be different from the interface language.

## Current limitations

KWB is actively developed. The following capabilities are not included in the current release:

- Automatic translation through cloud or local translation providers.
- Managed PDF, image, or other file attachments.
- Detailed import preview and advanced manual conflict-resolution choices.
- Semantic search, embeddings, and advanced multilingual retrieval. Current search is lexical, not semantic.
- Automatic synchronization across devices or live shared libraries.
- Mobile applications and collaborative team workspaces.
- Encryption of `.kwb` exchange files.

**Privacy note:** The current `.kwb` format is structured JSON with a custom file extension. It is not encrypted and does not contain file attachments. Do not include sensitive information in an exchange file unless you have independently protected it.

## Documentation

- [Arabic setup guide, implemented scope, and limitations](README_AR.md)
- [Architecture](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)
- [Changelog](CHANGELOG.md)
- [Test checklist](TEST-CHECKLIST.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Development on Windows

### Prerequisites

- Windows 10 or Windows 11.
- Node.js (LTS) and npm.
- Rust with the MSVC toolchain (`rustup default stable-msvc`).
- Microsoft C++ Build Tools with **Desktop development with C++**.
- WebView2 Runtime.

See the [official Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for platform setup details.

### Run the desktop app in development mode

```powershell
npm install
npm run tauri dev
```

Alternatively, run `run-dev.bat` from the project directory.

### Build Windows installers

```powershell
npm install
npm run tauri build
```

Alternatively, run `build-windows.bat`. The generated installers are placed under:

```text
src-tauri/target/release/bundle/nsis/
src-tauri/target/release/bundle/msi/
```

### Preview the web interface

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:1420`. Browser preview mode uses `localStorage` for preview purposes; it does not use the desktop application's SQLite database.

## Contributing and security

Bug reports, feature suggestions, and code contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing. For potential security vulnerabilities, follow [SECURITY.md](SECURITY.md) and report them privately rather than posting exploit details publicly.

## License

Knowledge Without Borders is licensed under the **GNU General Public License v3.0 or later (GPL-3.0-or-later)**. See [LICENSE](LICENSE) for the complete license text.

The source-code license does not transfer ownership of user-created knowledge libraries, research notes, imported materials, translations, or attachments. Those remain subject to their respective owners' rights and permissions. Third-party dependencies retain their own licenses.
