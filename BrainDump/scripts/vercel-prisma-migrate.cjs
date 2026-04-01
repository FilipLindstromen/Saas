/**
 * Vercel / CI: run `prisma migrate deploy`, and if the DB already has tables but no
 * migration history (P3005 — common after historical `db push`), mark each folder
 * in prisma/migrations as applied, deploy again, then `prisma db push` once to align
 * the database with schema.prisma (covers migration SQL that never ran).
 *
 * Fresh empty databases go straight through `migrate deploy` only.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");

function runPrisma(args) {
  const r = spawnSync("npx", ["prisma", ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: process.env,
    shell: true,
    stdio: ["inherit", "pipe", "pipe"],
  });
  const stdout = r.stdout || "";
  const stderr = r.stderr || "";
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  return {
    status: r.status === null ? 1 : r.status,
    combined: stdout + stderr,
  };
}

function listMigrationFolderNames() {
  const root = path.join(projectRoot, "prisma", "migrations");
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function migrateDeploy() {
  return runPrisma(["migrate", "deploy"]);
}

let first = migrateDeploy();
if (first.status === 0) {
  process.exit(0);
}

if (!first.combined.includes("P3005")) {
  process.exit(first.status);
}

console.error(
  "\n[prisma] P3005: existing database without migration history — baselining then syncing schema.\n",
);

for (const name of listMigrationFolderNames()) {
  const r = runPrisma(["migrate", "resolve", "--applied", name]);
  if (r.status !== 0) {
    process.exit(r.status);
  }
}

const second = migrateDeploy();
if (second.status !== 0) {
  process.exit(second.status);
}

const push = runPrisma(["db", "push"]);
process.exit(push.status === 0 ? 0 : push.status);
