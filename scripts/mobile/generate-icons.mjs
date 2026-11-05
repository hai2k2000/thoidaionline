import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const source = path.join(root, "public/icons/app-icon.svg");
const web = path.join(root, "public/icons");
const flutter = path.join(root, "mobile/thoidai_work_flutter/assets");
const sourceText = await fs.readFile(source, "utf8");
const svg = Buffer.from(sourceText);
// Android adaptive foreground uses the same paths, reduced to its central safe zone.
const monogram = sourceText.match(/<g fill="#fff">[\s\S]*?<\/g>/)?.[0];
if (!monogram) throw new Error("Missing monogram paths in app-icon.svg");
const foreground = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><g transform="translate(512 512) scale(.82) translate(-512 -512)">${monogram}</g></svg>`);

await fs.mkdir(flutter, { recursive: true });
await sharp(svg).resize(192, 192).png().toFile(path.join(web, "icon-192.png"));
await sharp(svg).resize(512, 512).png().toFile(path.join(web, "icon-512.png"));
await sharp(svg).resize(512, 512).png().toFile(path.join(web, "icon-maskable-512.png"));
await sharp(svg).resize(180, 180).flatten({ background: "#ffffff" }).png().toFile(path.join(web, "apple-touch-icon.png"));
await sharp(svg).resize(1024, 1024).png().toFile(path.join(flutter, "app-icon.png"));
await sharp(foreground).resize(1024, 1024).png().toFile(path.join(flutter, "app-icon-foreground.png"));
console.log("Generated web and Flutter app icons.");
