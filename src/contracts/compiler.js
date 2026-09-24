/* =========================================================================
   TypeScript Compiler
   ========================================================================= */

import { esc } from "../ui/utils.js";

function tsType(t) {
  return { string: "string", int: "number", float: "number", bool: "boolean", any: "unknown", json: "unknown" }[t] || "unknown";
}

export function compileTs(c) {
  const out = [`// compiled · ${c.name}`, `// runtime-validated at the TF Serving boundary`, `export interface ${c.name} {`];
  for (const f of c.fields) {
    const t = f.array ? tsType(f.type) + "[]" : tsType(f.type);
    const opt = (f.optional || f.def !== undefined) ? "?" : "";
    const notes = [];
    if (f.def !== undefined) notes.push("default " + JSON.stringify(f.def));
    for (const d of f.decos) notes.push("@" + d.name + (d.args.length ? "(" + d.args.join(", ") + ")" : ""));
    const left = `  ${f.name}${opt}: ${t};`;
    out.push(left.padEnd(32) + "// " + (notes.join(" · ") || "required"));
  }
  out.push("}");
  return out.join("\n");
}

export function highlightTs(src) {
  return esc(src).replace(
    /(\/\/[^\n]*)|(\b(?:export|interface|string|number|boolean|unknown)\b)|("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)/g,
    (m, cmt, kw, str, num) => {
      if (cmt) return `<span class="c-cmt">${cmt}</span>`;
      if (kw) return `<span class="c-kw">${kw}</span>`;
      if (str) return `<span class="c-str">${str}</span>`;
      if (num) return `<span class="c-num">${num}</span>`;
      return m;
    }
  );
}