# CopyWriter

AI-powered copywriting tool with a 3-column layout for generating, editing, and improving sales copy.

## Features

- **Left panel**: Generate copy with OpenAI — conversation flow with Q&A support for clarification questions before copy generation
- **Middle panel**: Original text — paste or type your source copy
- **Right panel**: Suggestions & feedback — notes, improvements, and analysis

- **Settings** (top right): Add your OpenAI API key
- **Instructions** (top right): Custom project instructions — default cold traffic sales copy system included
- **Tab bar**: Switch between multiple documents in the same project
- **Light/Dark mode**: Toggle in the top right corner
- **Persistence**: All data saved in browser localStorage

## Setup

1. `npm install`
2. `npm run dev`
3. Open http://localhost:5173
4. Click **Settings** and add your OpenAI API key
5. Start generating copy!

## Default Instructions

The app ships with a comprehensive "Cold Traffic Sales Copy System" prompt that:
- Asks clarification questions before writing
- Follows direct-response copywriting best practices
- Covers offer, audience, mechanism, and constraints
- Produces ad hooks, VSL scripts, sales pages, and more

Customize it via the **Instructions** button.
