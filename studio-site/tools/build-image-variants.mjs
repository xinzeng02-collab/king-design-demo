import { createRequire } from "node:module";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(toolsDir, "..");
const casesDir = path.join(siteDir, "assets", "king-cases");
const manifestPath = path.join(casesDir, "manifest.json");
const manifestScriptPath = path.join(casesDir, "manifest.js");

const THUMB_SIZE = 640;
const PREVIEW_SIZE = 1800;
const CONCURRENCY = 2;

function siteRelativePath(absolutePath) {
  return `./${path.relative(siteDir, absolutePath).split(path.sep).join("/")}`;
}

function variantPath(sourcePath, tier) {
  const relative = path.relative(casesDir, sourcePath);
  const parsed = path.parse(relative);
  return path.join(casesDir, tier, parsed.dir, `${parsed.name}.webp`);
}

async function imageSize(filePath) {
  try {
    return (await stat(filePath)).size;
  } catch {
    return 0;
  }
}

async function removeLegacyDerivatives(directory) {
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return removeLegacyDerivatives(entryPath);
    if (!entry.name.toLowerCase().endsWith(".webp")) await unlink(entryPath);
  }));
}

async function buildCaseVariant(sourcePath, outputPath, kind) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const pipeline = sharp(sourcePath, { failOn: "none", limitInputPixels: false }).rotate();
  if (kind === "thumb") {
    await pipeline
      .resize(THUMB_SIZE, THUMB_SIZE, {
        fit: "cover",
        position: sharp.strategy.attention,
        withoutEnlargement: false,
      })
      .webp({ quality: 78, effort: 5, smartSubsample: true })
      .toFile(outputPath);
    return;
  }
  await pipeline
    .resize({
      width: PREVIEW_SIZE,
      height: PREVIEW_SIZE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 86, effort: 5, smartSubsample: true })
    .toFile(outputPath);
}

async function runPool(items, worker) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

async function buildBrandAsset(sourceName, outputName, options) {
  const sourcePath = path.join(siteDir, "assets", sourceName);
  const outputPath = path.join(siteDir, "assets", outputName);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(sourcePath, { failOn: "none" })
    .rotate()
    .resize(options)
    .webp({ quality: 82, effort: 5, smartSubsample: true })
    .toFile(outputPath);
  return {
    source: siteRelativePath(sourcePath),
    output: siteRelativePath(outputPath),
    before: await imageSize(sourcePath),
    after: await imageSize(outputPath),
  };
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
await Promise.all([
  removeLegacyDerivatives(path.join(casesDir, "_thumbs")),
  removeLegacyDerivatives(path.join(casesDir, "_previews")),
]);
const caseJobs = [];
const seenSources = new Set();

for (const project of manifest.projects || []) {
  for (const pattern of project.patterns || []) {
    const images = Array.isArray(pattern.images) ? pattern.images : [];
    pattern.thumbs = [];
    pattern.previews = [];
    for (const imageRef of images) {
      const sourcePath = path.resolve(siteDir, imageRef);
      const thumbPath = variantPath(sourcePath, "_thumbs");
      const previewPath = variantPath(sourcePath, "_previews");
      pattern.thumbs.push(siteRelativePath(thumbPath));
      pattern.previews.push(siteRelativePath(previewPath));
      if (seenSources.has(sourcePath)) continue;
      seenSources.add(sourcePath);
      caseJobs.push({ sourcePath, thumbPath, previewPath });
    }
  }
}

let completed = 0;
await runPool(caseJobs, async (job) => {
  await buildCaseVariant(job.sourcePath, job.thumbPath, "thumb");
  await buildCaseVariant(job.sourcePath, job.previewPath, "preview");
  completed += 1;
  if (completed % 20 === 0 || completed === caseJobs.length) {
    process.stdout.write(`processed ${completed}/${caseJobs.length}\n`);
  }
});

const brandAssets = [];
brandAssets.push(await buildBrandAsset(
  path.join("login", "king-design-main-visual.png"),
  path.join("login", "king-design-main-visual.webp"),
  { width: 1200, height: 1600, fit: "inside", withoutEnlargement: true },
));

for (const role of ["admin", "designer", "painter", "sales"]) {
  brandAssets.push(await buildBrandAsset(
    path.join("avatars", `${role}.png`),
    path.join("avatars", `${role}.webp`),
    { width: 256, height: 256, fit: "cover", position: "centre" },
  ));
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(manifestScriptPath, `window.KING_CASE_MANIFEST = ${JSON.stringify(manifest)};\n`);

let originalBytes = 0;
let thumbBytes = 0;
let previewBytes = 0;
for (const job of caseJobs) {
  originalBytes += await imageSize(job.sourcePath);
  thumbBytes += await imageSize(job.thumbPath);
  previewBytes += await imageSize(job.previewPath);
}

const report = {
  generatedAt: new Date().toISOString(),
  cases: {
    originals: caseJobs.length,
    originalBytes,
    thumbBytes,
    previewBytes,
    thumbSize: `${THUMB_SIZE}x${THUMB_SIZE}`,
    previewMaxSize: `${PREVIEW_SIZE}x${PREVIEW_SIZE}`,
  },
  brandAssets,
};
await writeFile(
  path.join(casesDir, "image-variants-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
