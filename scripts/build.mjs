import { mkdir, copyFile, cp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const out = join(root, "dist");
// Only runtime files are published; research, tests and local records stay out.
await rm(out, { recursive: true, force: true });
await mkdir(join(out, "src"), { recursive: true });
await mkdir(join(out, "assets", "fonts"), { recursive: true });
for (const file of ["index.html", "styles.css"])
  await copyFile(join(root, file), join(out, file));
for (const file of [
  "app.js",
  "sleep.js",
  "context.js",
  "alerts.js",
  "workspace.js",
  "routine.js",
  "journey.js",
])
  await copyFile(join(root, "src", file), join(out, "src", file));
for (const file of ["satris-wordmark.svg", "satris-emblem.svg"])
  await copyFile(join(root, "assets", file), join(out, "assets", file));
await cp(join(root, "assets", "fonts"), join(out, "assets", "fonts"), {
  recursive: true,
  filter: (src) => !src.endsWith(".md"),
});
console.log("Satris built in dist/");
