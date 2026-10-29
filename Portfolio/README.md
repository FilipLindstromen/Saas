# Folio — Portfolio Studio

Run `node Portfolio/server.cjs` from the repository root and open http://127.0.0.1:4173.

- Upload or drop multiple images; additions keep existing boxes and positions.
- Select a box to edit its type, headline/body, colors, text size, size, image fit, and frame.
- Drag one box onto another to swap content while preserving the slot sizes. Move buttons provide a keyboard and touch alternative.
- Layout presets rearrange box sizes only when you explicitly select one.
- Drafts, including uploaded images, are stored locally in IndexedDB. They are specific to the browser and origin. Export a webpage to keep a portable copy.
- Export PDF opens the browser print dialog; choose **Save as PDF**. Enable background graphics if your browser disables them. Long portfolios can span multiple pages.
- Export webpage downloads a standalone HTML file with all images embedded. Poppins uses Google Fonts and requires an internet connection; system sans-serif is the offline fallback.
- Images stay in your browser. No upload service or API key is required. Uploaded images are resized to a maximum edge of 2400px for manageable drafts and exports.

The tool is linked from the hub and included in the Vercel and GitHub Pages copy steps. No dependencies or build step are required.

Checks: `node --check Portfolio/app.js` and `node --test Portfolio/app.test.cjs`.
