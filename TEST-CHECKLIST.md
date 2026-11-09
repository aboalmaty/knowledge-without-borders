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
