# Saas Apps

A collection of SaaS applications and tools. This project is configured to deploy to **GitHub Pages**.

## Apps in this project

| App | Path | Description |
|-----|------|-------------|
| Web Quiz Generator | `/webquizgenerator` | Quiz generation tool |
| CopyWriter | `/CopyWriter` | AI-powered copywriting tool |
| Story Writer | `/StoryWriter` | Story writing application |
| Color Writer | `/ColorWriter` | Color-focused writing tool |
| PostIt | `/PostIt` | Plan & brainstorm app |
| Pitch Deck | `/PitchDeck` | Pitch deck creator |
| Video Recorder | `/VIdeoRecorder` | Video recording tool |
| Sound Effects Generator | `/SoundEffectsGenerator` | Sound effects creation |
| Typography | `/Typography` | Typography tools |
| VSL Writer | `/VSL Writer` | Video sales letter writer |
| Power Writer | `/PowerWriter` | Writing assistant |
| Quiz | `/Quiz` | Quiz application |
| Conversation Generator | `/conversation-generator` | Conversation generation tool |

## Deploying to GitHub Pages

### 1. Configure the repository name

If your GitHub repository has a different name than `Saas`, update the `baseurl` in `_config.yml`:

```yaml
baseurl: "/your-repo-name"  # No trailing slash
```

### 2. Build each app for GitHub Pages

Each Vite app must be built with the correct base path so assets load correctly. From the project root:

```bash
# Web Quiz Generator
cd webquizgenerator
npm install
npm run build -- --base=/Saas/webquizgenerator/
# Output will be in webquizgenerator/dist/

# CopyWriter
cd CopyWriter
npm install
npm run build -- --base=/Saas/CopyWriter/

# Story Writer
cd StoryWriter
npm install
npm run build -- --base=/Saas/StoryWriter/

# Repeat for other apps, using --base=/Saas/AppName/
```

> **Note:** Replace `Saas` with your actual repository name in the `--base` path.

### 3. Set up the deployment folder

GitHub Pages can serve from the **root**, **/docs** folder, or **gh-pages** branch.

**Option A: Use the `/docs` folder (recommended)**

1. Create a `docs` folder in the project root.
2. Copy the built output from each app's `dist/` folder into `docs/`:
   - `webquizgenerator/dist/*` → `docs/webquizgenerator/`
   - `CopyWriter/dist/*` → `docs/CopyWriter/`
   - etc.
3. Add a root `index.html` in `docs/` that links to each app.

**Option B: Use the root**

1. Copy built outputs to the root (e.g. `webquizgenerator/`, `CopyWriter/`, etc.).
2. Add an `index.html` at the root linking to all apps.

### 4. Enable GitHub Pages

1. Go to your repository on GitHub.
2. Click **Settings** → **Pages**.
3. Under **Build and deployment**:
   - **Source:** Deploy from a branch
   - **Branch:** `main` (or `master`) / `docs` (if using the docs folder) or `root`
4. Click **Save**.

Your site will be available at `https://<username>.github.io/Saas/` (or your repo name).

### 5. Optional: GitHub Actions for automatic deployment

You can add a workflow to build and deploy on push. Create `.github/workflows/deploy.yml` to automate the build and deploy steps above.

## Local development

For local development, run each app from its folder:

```bash
cd webquizgenerator
npm install
npm run dev
```

Use the default base path (`/`) for local development; only use the `--base` flag when building for GitHub Pages.

## Project structure

```
/
├── _config.yml          # Jekyll/GitHub Pages config
├── README.md
├── webquizgenerator/
├── CopyWriter/
├── StoryWriter/
├── ColorWriter/
├── PostIt/
├── PitchDeck/
├── VIdeoRecorder/
├── SoundEffectsGenerator/
├── Typography/
├── VSL Writer/
├── PowerWriter/
├── Quiz/
├── conversation-generator/
└── docs/                # (optional) Deployment output for GitHub Pages
```
