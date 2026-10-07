import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const root = join(import.meta.dirname, "..");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const files = walk(join(root, "src"));

const importLine =
  'import { DatePicker } from "../../../components/ui/DatePicker";';
const dtImport =
  'import { DateTimePicker } from "../../../components/ui/DateTimePicker";';

for (const file of files) {
  if (file.includes("DatePicker.tsx") || file.includes("DateTimePicker.tsx"))
    continue;
  let c = readFileSync(file, "utf8");
  const orig = c;

  c = c.replace(
    /<input\r?\n([^>]*?)type="date"\r?\n([^>]*?)value=\{([^}]+)\}\r?\n([^>]*?)onChange=\{\(e\)\s*=>\s*([a-zA-Z0-9_]+)\(e\.target\.value\)\}([^>]*?)\/>/g,
    (m, a, b, val, d, fn, rest) => {
      const attrs = `${a}${b}${d}${rest}`.replace(/\s*className=/, "\n              className=");
      return `<DatePicker\n              value={${val.trim()}}\n              onChange={${fn}}\n              ${attrs.trim()}\n            />`;
    },
  );

  c = c.replace(
    /<input([^>]*?)type="date"([^>]*?)value=\{([^}]+)\}([^>]*?)onChange=\{\(e\)\s*=>\s*([a-zA-Z0-9_]+)\(e\.target\.value\)\}([^>]*?)\/>/g,
    (m, a, b, val, d, fn, rest) => {
      const extra = `${a}${b}${d}${rest}`.trim();
      const classMatch = extra.match(/className=\{?([^}\s]+)\}?/);
      const ariaMatch = extra.match(/aria-label="([^"]+)"/);
      let props = "";
      if (classMatch) props += `\n              className=${classMatch[0].replace("className=", "className=")}`;
      if (ariaMatch) props += `\n              aria-label="${ariaMatch[1]}"`;
      return `<DatePicker\n              value={${val.trim()}}\n              onChange={${fn}}${props}\n            />`;
    },
  );

  c = c.replace(
    /<input([^>]*?)type="datetime-local"([^>]*?)value=\{([^}]+)\}([^>]*?)onChange=\{\(e\)\s*=>\s*([a-zA-Z0-9_]+)\(e\.target\.value\)\}([^>]*?)\/>/g,
    `<DateTimePicker\n              value={$3}\n              onChange={$5}\n            />`,
  );

  if (c !== orig) {
    if (c.includes("DatePicker") && !c.includes("components/ui/DatePicker")) {
      const idx = c.indexOf("\n", c.indexOf("import "));
      const firstImportEnd = c.indexOf("\n\n");
      const insertAt = firstImportEnd > 0 ? firstImportEnd + 1 : idx + 1;
      let imports = "";
      if (c.includes("<DatePicker") && !c.includes(importLine)) imports += importLine + "\n";
      if (c.includes("<DateTimePicker") && !c.includes(dtImport)) imports += dtImport + "\n";
      if (imports) c = c.slice(0, insertAt) + imports + c.slice(insertAt);
    }
    writeFileSync(file, c);
    console.log("updated", file.replace(root, ""));
  }
}
