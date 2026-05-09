import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const SRC = path.join(ROOT, "data", "places.json");
const OUT = path.join(ROOT, "data", "places.geocoded.json");

const UA = "GelatoWeek2026BerlinChecklist/1.0 (personal project)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "de");
  url.searchParams.set("addressdetails", "0");
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de,en" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${query}`);
  const data = await res.json();
  return data[0] ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display: data[0].display_name } : null;
}

const places = JSON.parse(await fs.readFile(SRC, "utf8"));

let existing = [];
try { existing = JSON.parse(await fs.readFile(OUT, "utf8")); } catch {}
const cache = new Map(existing.filter((p) => p.lat).map((p) => [p.id, p]));

const out = [];
for (const p of places) {
  if (cache.has(p.id)) {
    out.push(cache.get(p.id));
    process.stderr.write(`= ${p.id} ${p.name} (cached)\n`);
    continue;
  }
  const queries = [
    `${p.address}, Germany`,
    `${p.name}, ${p.address}, Germany`,
  ];
  let r = null;
  for (const q of queries) {
    try { r = await geocode(q); } catch (e) { process.stderr.write(`! ${p.id} ${q}: ${e.message}\n`); }
    await sleep(1100);
    if (r) break;
  }
  if (!r) process.stderr.write(`X ${p.id} ${p.name} — NOT FOUND\n`);
  else process.stderr.write(`+ ${p.id} ${p.name} -> ${r.lat},${r.lon}\n`);
  out.push({ ...p, lat: r?.lat ?? null, lon: r?.lon ?? null, geocode_display: r?.display ?? null });
  await fs.writeFile(OUT, JSON.stringify(out, null, 2));
}

await fs.writeFile(OUT, JSON.stringify(out, null, 2));
process.stderr.write(`\nDone. Found ${out.filter((p) => p.lat).length}/${out.length}\n`);
