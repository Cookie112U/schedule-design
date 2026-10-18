const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(indexPath, "utf8");
const versions = [...html.matchAll(/(?:src|href)="(?:css|js)\/[^"?]+\?v=([^"]+)"/g)].map((match) => match[1]);

if (!versions.length) throw new Error("No versioned local CSS or JavaScript assets found in index.html");

const requested = process.argv[2];
const now = new Date();
const base = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join(".");
const current = versions[0];
const currentBuild = current.startsWith(`${base}.`) ? Number(current.slice(base.length + 1)) || 0 : 0;
const next = requested || `${base}.${currentBuild + 1}`;

if (!/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(next)) {
  throw new Error("Version must use YYYY.MM.DD.N format");
}

const updated = html.replace(/((?:src|href)="(?:css|js)\/[^"?]+\?v=)[^"]+/g, `$1${next}`);
fs.writeFileSync(indexPath, updated, "utf8");
console.log(`Asset cache version: ${current} -> ${next}`);
