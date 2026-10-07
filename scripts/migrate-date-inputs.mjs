/**
 * One-off helper: reports remaining native date/time inputs.
 * Run: node scripts/migrate-date-inputs.mjs
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const root = join(import.meta.dirname, "..", "src");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules") continue;
      walk(p, out);
    } else if (/\.(tsx|ts)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(root);
for (const f of files) {
  const c = readFileSync(f, "utf8");
  if (c.includes('type="date"') || c.includes('type="time"') || c.includes('datetime-local')) {
    const rel = f.replace(root, "src");
    const dates = (c.match(/type="date"/g) || []).length;
    const times = (c.match(/type="time"/g) || []).length;
    const dt = (c.match(/datetime-local/g) || []).length;
    console.log(`${rel}: date=${dates} time=${times} datetime=${dt}`);
  }
}
