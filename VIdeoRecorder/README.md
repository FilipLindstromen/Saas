# Video Recorder

A 3-step video planning, recording, and editing software built with React and TypeScript.

## Features

- **Project Management**: Create, load, and delete projects
  - Projects are saved as JSON files
  - Video recordings are stored in the project folder
  - Auto-save functionality

- **Script Step**: Write and manage scene descriptions
  - Add new scenes
  - Edit scene titles and descriptions
  - Delete scenes
  - Visual scene indicators

- **Record Step**: Video recording interface
  - Real camera, microphone, and screen capture
  - Multiple takes per scene
  - Countdown before recording
  - Pause/Resume/Stop controls
  - Import video files

- **Edit Step**: Video editing interface (coming soon)

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (usually http://localhost:5173)

## Browser Requirements

This application uses the **File System Access API** for project management. It is currently supported in:
- Chrome 86+
- Edge 86+
- Opera 72+

For other browsers, project management features may not be available.

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Electron (for desktop app)
- File System Access API (for project management)

## Production Build

For production builds, see [PRODUCTION.md](./PRODUCTION.md) and [BUILD.md](./BUILD.md) for detailed instructions.

### Quick Production Build
```bash
npm run build:prod
```

### Electron Build
```bash
npm run electron:build
```

