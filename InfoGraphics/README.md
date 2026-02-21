# InfoGraphics Generator

Create infographics with a drag-and-drop canvas. Add image+text elements, headlines, arrows, and CTA buttons. Search for images from Giphy, Pixabay, Pexels, and Iconify. Use AI to generate step-based infographics from a prompt.

## Features

- **Canvas** – Drag and resize elements
- **Element types** – Image+Text, Headline, Arrow, CTA Button
- **Aspect ratios** – 16:9, 9:16, or 1:1
- **Image search** – Giphy (GIFs, stickers), Pixabay (photos), Pexels (photos), and Iconify (icons)
- **AI generation** – Describe a process (e.g. "5-step stress response in hand drawn style") and get elements with images
- **Latest selected** – Recently used images for quick access
- **Server storage** – Selected images are saved on the server

## Setup

### 1. Install dependencies

```bash
cd InfoGraphics
npm install
cd server
npm install
```

### 2. Configure API keys (optional)

Copy `server/.env.example` to `server/.env` and add your keys:

- **GIPHY_API_KEY** – [Get one](https://developers.giphy.com/dashboard) for Giphy image search
- **PIXABAY_API_KEY** – [Get one](https://pixabay.com/api/docs/) for Pixabay photo search
- **PEXELS_API_KEY** – [Get one](https://www.pexels.com/api/) for Pexels photo search
- **OPENAI_API_KEY** – For AI-powered generation (uses GPT-4o-mini)

Without these keys, Iconify search still works (no key required), but Giphy, Pixabay, Pexels, and AI generation will be limited.

### 3. Run

**Terminal 1 – Server:**
```bash
cd server
npm start
```

**Terminal 2 – App:**
```bash
npm run dev
```

Open http://localhost:5175

## Deployment

The app builds as a static site. For full functionality (search, save, AI generate), run the server alongside it. The server can be deployed to any Node.js host (e.g. Railway, Render, Fly.io).

Build for production:
```bash
npm run build
```
