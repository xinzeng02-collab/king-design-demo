import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = process.argv[2];
if (!output) throw new Error("Usage: node tools/build-single-file.mjs <output-file>");

const read = (file) => readFile(resolve(root, file), "utf8");
const inlineScript = (text) => `<script>\n${text.replace(/<\/script/gi, "<\\/script")}\n</script>`;
const inlineStyle = (text) => `<style>\n${text}\n</style>`;

const [htmlSource, hero, styles, loginStyles, galleryStyles, strictStyles, config, cloudAdapter, manifest, storage, performance, login, script] = await Promise.all([
  read("index.html"),
  read("assets/public-demo-cover.svg"),
  read("styles.css"),
  read("login-experience.css"),
  read("gallery-performance.css"),
  read("tdesign-strict.css"),
  read("release-config.js"),
  read("cloud-adapter.js"),
  read("assets/king-cases/manifest.js"),
  read("storage-engine.js"),
  read("performance-runtime.js"),
  read("login-portals.js"),
  read("script.js"),
]);

const heroUrl = `data:image/svg+xml;base64,${Buffer.from(hero).toString("base64")}`;
let html = htmlSource
  .replace(/\s*<link rel="preload"[^>]*public-demo-cover\.svg"[^>]*>/, "")
  .replace('<link rel="stylesheet" href="./styles.css?v=20260802-dashboard-reference-v114" />', inlineStyle(styles))
  .replace('<link rel="stylesheet" href="./login-experience.css?v=20260726-login-v2" />', inlineStyle(loginStyles))
  .replace('<link rel="stylesheet" href="./gallery-performance.css?v=20260727-performance-v2" />', inlineStyle(galleryStyles))
  .replace('<link rel="stylesheet" href="./tdesign-strict.css?v=20260802-compare-image-v74" />', inlineStyle(strictStyles))
  .replaceAll("./assets/public-demo-cover.svg", heroUrl)
  .replace('<script src="./release-config.js"></script>', inlineScript(config))
  .replace('<script src="./cloud-adapter.js"></script>', inlineScript(cloudAdapter))
  .replace('<script src="./assets/king-cases/manifest.js"></script>', inlineScript(manifest))
  .replace('<script src="./storage-engine.js?v=20260802-image-reset-v2"></script>', inlineScript(storage))
  .replace('<script src="./performance-runtime.js?v=20260727-performance-v2"></script>', inlineScript(performance))
  .replace('<script src="./login-portals.js?v=20260726-login-v2"></script>', inlineScript(login))
  .replace('<script src="./script.js"></script>', inlineScript(script));

await writeFile(output, html);
