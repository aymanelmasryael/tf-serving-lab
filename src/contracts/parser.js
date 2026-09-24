/* =========================================================================
   Contract Parser
   ========================================================================= */

const KNOWN_TYPES = ["string", "int", "float", "bool", "any", "json"];

export function parseContract(src) {
  const diags = [];
  const fields = [];
  let name = "Contract";
  let depth = 0;
  const lines = src.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\/\/.*$/, "").trim();
    if (!line) continue;

    if (depth === 0) {
      const m = line.match(/^contract\s+([A-Za-z_]\w*)\s*\{$/);
      if (!m) { diags.push({ line: i + 1, sev: "error", msg: "expected `contract <Name> {`" }); continue; }
      name = m[1]; depth = 1; continue;
    }
    if (line === "}") { depth = 0; continue; }
    const f = parseField(line, i + 1, diags);
    if (f) fields.push(f);
  }
  if (depth !== 0) diags.push({ line: lines.length, sev: "error", msg: "unclosed contract block — missing `}`" });
  if (!fields.length && !diags.length) diags.push({ line: 1, sev: "error", msg: "contract declares no fields" });
  return { name, fields, diags };
}

function parseField(line, ln, diags) {
  const m = line.match(/^([A-Za-z_]\w*)\s*:\s*([A-Za-z_]\w*)\s*(\[\])?\s*(\?)?\s*(.*)$/);
  if (!m) { diags.push({ line: ln, sev: "error", msg: `cannot parse field: "${line}"` }); return null; }
  const [, fname, base, arr, opt, rest] = m;
  if (!KNOWN_TYPES.includes(base)) diags.push({ line: ln, sev: "error", msg: `unknown type "${base}" (expected ${KNOWN_TYPES.join(" | ")})` });

  const field = { name: fname, type: base, array: !!arr, optional: !!opt, decos: [], def: undefined, line: ln };
  let decoPart = rest;
  const eq = rest.indexOf("=");
  if (eq >= 0) {
    decoPart = rest.slice(0, eq);
    const raw = rest.slice(eq + 1).trim();
    try { field.def = JSON.parse(raw); }
    catch (_) {
      if (/^-?\d+(\.\d+)?$/.test(raw)) field.def = parseFloat(raw);
      else if (raw === "true" || raw === "false") field.def = raw === "true";
      else if (/^".*"$/.test(raw)) field.def = raw.slice(1, -1);
      else diags.push({ line: ln, sev: "error", msg: `invalid default value "${raw}" for ${fname}` });
    }
  }
  const re = /@(\w+)(?:\(([^)]*)\))?/g;
  let dm;
  while ((dm = re.exec(decoPart))) {
    const args = dm[2] ? dm[2].split(",").map(s => s.trim()).filter(Boolean) : [];
    field.decos.push({ name: dm[1], args });
  }
  return field;
}