# Changelog

## [0.2.1] - 2026-11-09

### Security and Maintenance
- Updated Vite to 8.3.6.
- Updated `@vitejs/plugin-react` to 6.2.1.
- Updated the npm dependency tree; `npm audit` reported zero vulnerabilities at release verification.
- Updated the Rust package and Tauri application version to 0.2.1.
- Built the production Windows x64 application and generated EXE and MSI installers.

### Verification notes
- `npm run build` completed successfully.
- `cargo check` completed successfully.
- `npx tauri build` generated the Windows x64 EXE and MSI installers.
- `cargo audit` reported two dependency warnings: `proc-macro-error` (unmaintained) and `glib` (unsoundness advisory). These are associated with the GTK/Linux dependency path and remain tracked for a future Linux-target review.

---

## [0.2.0] - Editor, themes and sharing improvements

- Added font family, font size, text color and text highlight controls to the rich-text editor.
- Added Light, Dark, Warm Paper and Soft Green application themes.
- Added persistent global interface/text scaling controls.
- Added one-click bulk selection for every benefit under a chosen main or subcategory, including descendants.
- Improved the messaging workflow: build the selected KWB file before opening WhatsApp, Telegram or Messenger, with a clear manual-attachment instruction.
- Kept the existing Tauri application identifier so existing 0.1.0 app data remains in the same application data directory.

## [0.1.0] - Foundation release

- Initial local-first desktop application foundation.
