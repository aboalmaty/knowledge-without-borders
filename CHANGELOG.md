# Changelog

## [0.2.3] - Native desktop messaging launch

- WhatsApp sharing now tries the official `whatsapp://` URI scheme first, preparing text in WhatsApp Desktop when its protocol handler is registered.
- Telegram sharing now tries the official `tg://` URI scheme first, using Telegram's documented `msg_url` share link for prepared text.
- The HTTPS share pages are used only when the native URI handler cannot be opened. This avoids creating a second WhatsApp Web tab when the desktop handler is available.
- For KWB file sharing, the app attempts to open the installed desktop client before revealing the generated file for manual attachment. The user still selects the recipient and sends the file.
- Messenger remains web-based because a stable, documented general-purpose Windows desktop URI for prefilled message sharing was not verified.
- Fixed the file-share notification to use the existing localized `shareReadyAttach` key.


## [0.2.2] - 2026-11-09 — Sharing options

- Added two sharing formats: send selected benefits as prefilled text or export them as an importable `.kwb` library file.
- WhatsApp and Telegram can open a prefilled text share; Messenger uses clipboard copy followed by opening Messenger because it does not provide a generic prefilled text composer URL.
- For `.kwb` sharing, the app reveals the exported file in the system file manager before opening the selected messaging service. The user still attaches and sends the file manually.


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
