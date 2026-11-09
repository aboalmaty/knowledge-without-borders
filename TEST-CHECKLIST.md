# Manual test checklist — 0.1

## Desktop setup
- [ ] `npm install` completes.
- [ ] `npm run tauri dev` starts the desktop window.
- [ ] App launches with network disconnected after the first dependency/build setup.
- [ ] Closing and reopening preserves records.

## Language and layout
- [ ] Switch through Arabic, English, Spanish, French, Chinese and Urdu.
- [ ] Arabic and Urdu use RTL; the other four use LTR.
- [ ] Switch language while a record is open; its content remains unchanged.
- [ ] Enter Arabic content while UI is English and vice versa.

## Categories and benefits
- [ ] Create a main category and at least two nested categories.
- [ ] Edit category names and move a category under another parent.
- [ ] Attempt a circular category move; it must be rejected.
- [ ] Create, edit, delete and search benefits.
- [ ] Test pasted rich text, lists and quotations.
- [ ] Verify author/book/volume/page/source language and owner fields.

## Dashboard and search
- [ ] Verify total, today, week, month, year and received counts.
- [ ] Search by title, body text, author and book.
- [ ] Search Arabic with diacritics and alef/hamza variations.
- [ ] Filter by a parent category; child-category benefits should appear.

## Translation records
- [ ] Add one translation for each of two target languages.
- [ ] Update a translation and verify the original is unchanged.
- [ ] Change status from draft to reviewed to verified.
- [ ] Verify translation language direction in the editor.

## Exchange
- [ ] Select benefits from more than one top-level category.
- [ ] Export a KWB file and inspect it as UTF-8 JSON.
- [ ] Import it into an empty library and verify hierarchy, metadata and translations.
- [ ] Import it again and verify duplicate stable IDs are skipped.
- [ ] Import with and without a sender name.
- [ ] Open WhatsApp, Telegram and Messenger and attach the generated file manually.

## Recovery and safety
- [ ] Copy the SQLite database while the app is closed and verify the copy can be restored.
- [ ] Export the full library periodically.
- [ ] Do not use this alpha as the only copy of important research material until the full test cycle is complete.

## Additional checks for 0.2.0

- [ ] In the benefit editor, apply a different font family to selected text and save/reopen the benefit.
- [ ] Apply several font sizes and confirm formatting persists.
- [ ] Apply text foreground color and highlight/background color, then save/reopen.
- [ ] Change each of the four themes and restart the app; confirm the preference persists.
- [ ] Move the global scale control down and up; confirm layout and text are readable and setting persists after restart.
- [ ] In Knowledge Exchange, select a main category and use the category bulk-selection button; confirm all benefits in all descendants are selected.
- [ ] Select a subcategory and repeat; confirm only that subcategory subtree is added.
- [ ] Repeat for a second category and ensure earlier selections remain selected.
- [ ] Click WhatsApp/Telegram/Messenger with selected benefits; confirm a KWB file is created before the messaging destination opens, then manually attach it.


## Sharing modes (0.2.2)

- [ ] Select one benefit and share as text through WhatsApp; confirm title and body are prefilled.
- [ ] Select multiple benefits and share as text through Telegram; confirm all selected entries are present in the share composer.
- [ ] Share as text through Messenger; confirm the selected text is copied and can be pasted into a conversation.
- [ ] Select enough benefits to exceed the prefilled-link size threshold; confirm the full text is copied and can be pasted manually.
- [ ] Share as a KWB file; confirm the file is created in Downloads and Explorer reveals/selects the generated file before the messaging site opens.
- [ ] Attach the KWB file manually, send it, and import it on another KWB installation; verify titles, content, categories, and translations.
- [ ] Repeat the checks in Arabic, English, Spanish, French, Chinese, and Urdu, and in all four themes.


## 0.2.3 — Native messaging launch checks

- [ ] With WhatsApp Desktop installed and its protocol registered, text sharing opens WhatsApp Desktop through `whatsapp://send`, not a new WhatsApp Web tab.
- [ ] With Telegram Desktop installed and its protocol registered, text sharing opens Telegram Desktop through `tg://msg_url`.
- [ ] When a desktop protocol handler is unavailable, the corresponding HTTPS share page opens as a fallback.
- [ ] File sharing attempts to open the desktop messaging client, then reveals the generated `.kwb` file for manual attachment.
- [ ] Messenger continues to use its web destination and clipboard-assisted text sharing.
- [ ] No message or file is sent automatically; the user reviews the content, selects the recipient, attaches files, and presses Send.
