/**
 * One-shot extractor: reads src/lib/messages.ts object literals and writes JSON.
 * Run: node scripts/extract-messages-to-json.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const messagesPath = path.join(root, "src", "lib", "messages.ts");
const outDir = path.join(root, "src", "lib", "locales");

const text = fs.readFileSync(messagesPath, "utf8");

function extractObjectLiteral(source, constName) {
  const needle = `const ${constName}: Msg = `;
  const start = source.indexOf(needle);
  if (start === -1) throw new Error(`Missing ${needle}`);
  let i = start + needle.length;
  while (i < source.length && source[i] !== "{") i++;
  if (source[i] !== "{") throw new Error(`Expected { after ${constName}`);
  let depth = 0;
  const objStart = i;
  for (; i < source.length; i++) {
    const c = source[i];
    const prev = source[i - 1];
    if (c === '"' && prev !== "\\") {
      i++;
      while (i < source.length) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === '"') break;
        i++;
      }
      continue;
    }
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) {
        return source.slice(objStart, i + 1);
      }
    }
  }
  throw new Error(`Unbalanced braces for ${constName}`);
}

for (const name of ["en", "sv"]) {
  const lit = extractObjectLiteral(text, name);
  const obj = vm.runInNewContext(`(${lit})`, Object.create(null), { filename: `${name}.mjs` });
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(obj, null, 2) + "\n", "utf8");
  console.log("Wrote", outPath, Object.keys(obj).length, "keys");
}
