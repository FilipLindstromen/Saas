#!/usr/bin/env node
/**
 * Builds the SaaS hub + all static/Vite apps for a single Vercel deployment.
 * Run from repo root. Output is ./deploy (used as Vercel output directory).
 * For Vercel: base paths are /AppName/ (no repo prefix). BrainDump is a landing
 * page that links to the separate BrainDump Vercel project (set BRAINDUMP_APP_URL).
 */

import { mkdirSync, cpSync, readFileSync, writeFileSync, existsSync, rmSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEPLOY = path.join(ROOT, "deploy");

// Vite apps: [ projectPath, basePath, optional preBuildCommand ]
// projectPath is relative to ROOT; basePath is the URL path (e.g. /ReelRecorder/)
const VITE_APPS = [
  ["webquizgenerator", "/webquizgenerator/"],
  ["CopyWriter", "/CopyWriter/"],
  ["StoryWriter", "/StoryWriter/"],
  ["ColorWriter", "/ColorWriter/"],
  ["PostIt", "/PostIt/"],
  ["BulletGenerator", "/BulletGenerator/"],
  ["PitchDeck", "/PitchDeck/"],
  ["VIdeoRecorder", "/VIdeoRecorder/"],
  ["SoundEffectsGenerator", "/SoundEffectsGenerator/"],
  ["ReelRecorder", "/ReelRecorder/"],
  ["InfoGraphics", "/InfoGraphics/"],
  ["AutoCaptions", "/AutoCaptions/"],
  ["VideoQuiz/app", "/VideoQuiz/"],
  ["PowerWriter/PowerWriter/client", "/PowerWriter/"],
];

function run(cmd, cwd = ROOT) {
  execSync(cmd, { cwd, stdio: "inherit", shell: true });
}

function copyRecursive(src, dest) {
  cpSync(src, dest, { recursive: true });
}

console.log("Creating deploy directory...");
if (existsSync(DEPLOY)) {
  rmSync(DEPLOY, { recursive: true });
}
mkdirSync(DEPLOY, { recursive: true });

// Hub static files
console.log("Copying hub (docs)...");
const docs = path.join(ROOT, "docs");
cpSync(path.join(docs, "index.html"), path.join(DEPLOY, "index.html"));
cpSync(path.join(docs, "apiKeys.js"), path.join(DEPLOY, "apiKeys.js"));
cpSync(path.join(docs, "saasStorage.js"), path.join(DEPLOY, "saasStorage.js"));
cpSync(path.join(docs, "google-drive-callback.html"), path.join(DEPLOY, "google-drive-callback.html"));
copyRecursive(path.join(docs, "assets"), path.join(DEPLOY, "assets"));
if (existsSync(path.join(docs, ".nojekyll"))) {
  cpSync(path.join(docs, ".nojekyll"), path.join(DEPLOY, ".nojekyll"));
}
if (existsSync(path.join(docs, "robots.txt"))) {
  cpSync(path.join(docs, "robots.txt"), path.join(DEPLOY, "robots.txt"));
}
copyRecursive(path.join(docs, "ContentGenerator"), path.join(DEPLOY, "ContentGenerator"));

// Static app folders (no build)
console.log("Copying static apps...");
for (const dir of ["conversation-generator", "Typography", "VSLWriter"]) {
  const src = path.join(ROOT, dir);
  if (existsSync(src)) copyRecursive(src, path.join(DEPLOY, dir));
}

// BrainDump landing (links to separate BrainDump Vercel project)
const braindumpUrl = process.env.BRAINDUMP_APP_URL || "https://saas-silk-tau.vercel.app";
let landing = readFileSync(path.join(docs, "brain-dump-landing.html"), "utf8");
landing = landing.replace(/__BRAINDUMP_APP_URL__/g, braindumpUrl);
// Also replace hardcoded saas-silk-tau.vercel.app so env override works
landing = landing.replace(/https:\/\/saas-silk-tau\.vercel\.app/g, braindumpUrl);
mkdirSync(path.join(DEPLOY, "BrainDump"), { recursive: true });
writeFileSync(path.join(DEPLOY, "BrainDump", "index.html"), landing);
console.log("BrainDump landing written (Open BrainDump →", braindumpUrl, ")");

// Build each Vite app with base path and copy dist to deploy
for (const [projectPath, basePath] of VITE_APPS) {
  const absPath = path.join(ROOT, projectPath);
  if (!existsSync(path.join(absPath, "package.json"))) {
    console.warn("Skipping (no package.json):", projectPath);
    continue;
  }
  console.log("Building", projectPath, "with base", basePath);
  run("npm install", absPath);
  const viteBin = path.join(absPath, "node_modules", "vite", "bin", "vite.js");
  const viteCmd = existsSync(viteBin)
    ? `node "${viteBin}" build --base=${basePath}`
    : `npx vite build --base=${basePath}`;
  if (projectPath === "CopyWriter" || projectPath === "BulletGenerator") {
    run("npx tsc -b", absPath);
  }
  if (projectPath === "PowerWriter/PowerWriter/client") {
    run("npx tsc", absPath);
  }
  if (projectPath === "AutoCaptions") {
    run("npx tsc -b", absPath);
  }
  run(viteCmd, absPath);
  const dist = path.join(absPath, "dist");
  if (!existsSync(dist)) {
    console.warn("No dist folder after build:", projectPath);
    continue;
  }
  const deploySub = path.join(DEPLOY, basePath.replace(/^\/|\/$/g, ""));
  copyRecursive(dist, deploySub);
  console.log("  →", deploySub);
}

console.log("Done. Output in ./deploy");
