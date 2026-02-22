# Shared Modules

Shared components and services for all Saas apps.

## API Keys (`apiKeys.js`)

API keys are stored in a single `localStorage` entry (`saasApiKeys`) and shared across all Saas apps. Enter your keys once in any app's Settings.

**Security:** Keys are stored locally in your browser only. They are never sent to our servers.

## Shared Components

### SettingsModal (`SettingsModal/`)
Configurable API keys modal. Use `fields` to show specific keys (openai, unsplash, pexels, pixabay, giphy, googleClientId). Pass `children` for app-specific settings.

### ThemeToggle (`ThemeToggle.jsx`)
Theme toggle button for toolbars. Uses `@shared/theme`.

### TabBar (`TabBar/`)
Tab bar with add, rename, delete. Used by StoryWriter, InfoGraphics, ColorWriter.

### Stock Media (`stockMedia/`)
- **Services:** `unsplash.js`, `pexels.js`, `pixabay.js`, `giphy.js`
- **Picker:** `UnsplashPicker.jsx` – image search and select

## Shared Services

### Theme (`theme.js`)
`getTheme()`, `setTheme()`, `applyTheme()`, `useTheme()` – dark/light mode.

### OpenAI (`openai.js`)
`chatCompletion()`, `generateFromPrompt()`, `transcribeAudio()` – centralized API usage.

### YouTube Export (`youtubeExport/`)
Thumbnail generator, captions, upload to YouTube. See `YouTubeExportModule.jsx`.
