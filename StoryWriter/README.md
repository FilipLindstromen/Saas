# Story Writer

A story generation tool that uses OpenAI to generate emotional, gripping stories based on a proven narrative framework. Dark mode UI with draggable sections and editable text.

## Features

- **Framework-driven structure**: 8 pre-defined sections (scene → hero up a tree → throw stones → bigger stone → aha → final attempt → new life → audience + moral)
- **What the story is about**: Main input describing the story theme
- **Optional input per section**: Add context for each section before generating
- **Drag to reorder**: Sections can be reordered before or after generation
- **Editable text**: Generated story text is fully editable
- **Settings**: OpenAI API key stored in browser (Settings button, top right)

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Set your OpenAI API key in **Settings** (top right), then describe what the story is about and click **Generate story**.

## Build

```bash
npm run build
npm run preview
```

## Framework

Stories follow this structure (order starts with high drama):

1. Set the scene with high drama  
2. Put the hero up a tree (the core problem)  
3. Throw stones (failed attempts / consequences)  
4. Throw a bigger stone (rock bottom)  
5. The "aha" moment  
6. Final attempt — and it works  
7. The new life  
8. Call out the audience + moral  

Stories are written to be emotional, use open/close loops, and keep the audience hooked.
