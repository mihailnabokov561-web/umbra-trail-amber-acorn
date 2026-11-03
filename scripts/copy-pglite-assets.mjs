#!/usr/bin/env node
/**
 * Nitro bundles @electric-sql/pglite into one JS file. The runtime then
 * looks for pglite.data / pglite.wasm / initdb.wasm next to that file.
 * Copy them into the Vercel function output so serverless PGLite can boot
 * when DATABASE_URL is not set.
 */
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules/@electric-sql/pglite/dist");
const destDir = join(root, ".vercel/output/functions/__server.func/_libs");
const files = ["pglite.data", "pglite.wasm", "initdb.wasm"];

await mkdir(destDir, { recursive: true });
await Promise.all(
  files.map((name) => copyFile(join(srcDir, name), join(destDir, name))),
);
console.log(`[pglite] copied ${files.join(", ")} next to the server bundle`);
