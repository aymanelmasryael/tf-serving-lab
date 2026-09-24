/* =========================================================================
   Diagnostics Rendering
   ========================================================================= */

import { esc } from "../ui/utils.js";

export function renderDiags(container, diags, okMsg) {
  if (!diags.length) {
    container.innerHTML = `<div class="diag ok"><span class="p">✓</span><span>${esc(okMsg)}</span></div>`;
    return;
  }
  container.innerHTML = diags.map(d => `
    <div class="diag ${d.sev}">
      <span class="l">${d.line ? "L" + d.line : "•"}</span>
      <span class="p">${esc(d.path || d.sev)}</span>
      <span>${esc(d.msg)}</span>
    </div>`).join("");
}