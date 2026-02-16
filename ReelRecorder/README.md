# Video Recorder

A dark-mode video recorder with system camera/screen and microphone, aspect ratios (16:9, 9:16, 1:1), overlays (text and images) on a timeline, and optional OpenAI Whisper caption burn-in.

## Features

- **Video source**: Camera or screen share (dropdown)
- **Microphone**: Dropdown to select input device
- **Aspect ratios**: 16:9, 9:16, 1:1
- **Resolution & quality**: 720p–4K (per aspect) and Draft / Medium / High / Max
- **Overlays**: Add text or images on a timeline with start/end times; overlays are baked into the recording
- **Timeline**: Scrubbable; add overlay segments and edit in the overlay editor
- **Captions**: After recording, optionally burn in captions using OpenAI Whisper in 5 styles: Lower third, Centered subtitle, Karaoke, Minimal, Bold block

## Setup

```bash
npm install
npm run dev
```

For caption burn-in, create a `.env` file with:

```
VITE_OPENAI_API_KEY=sk-your-openai-api-key
```

## Build

```bash
npm run build
npm run preview
```
