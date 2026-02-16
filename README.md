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

**Automatic deployment** — the project includes a GitHub Actions workflow that builds all apps and deploys them when you push.

### One-time setup

1. Go to your repository on GitHub.
2. Click **Settings** → **Pages**.
3. Under **Build and deployment**:
   - **Source:** Select **GitHub Actions**
4. Click **Save**.

### How it works

When you push to `main` or `master`, the workflow automatically:

1. Builds each Vite app with the correct base path for your repo
2. Copies static apps (Conversation Generator, Typography)
3. Deploys everything to GitHub Pages

Your site will be at `https://<username>.github.io/<repo-name>/` (e.g. `https://username.github.io/Saas/`).

### Manual trigger

You can also run the deployment manually: **Actions** → **Deploy to GitHub Pages** → **Run workflow**.

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
