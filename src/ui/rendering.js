/* =========================================================================
   DOM Rendering
   ========================================================================= */

import { renderStatusStrip, renderMetrics } from "../simulation/metrics.js";
import { renderCluster, drawRing, drawLoss } from "../simulation/cluster.js";
import { compileTs, highlightTs } from "../contracts/compiler.js";
import { renderDiags } from "../contracts/diagnostics.js";
import { parseContract } from "../contracts/parser.js";

const AVATAR_INITIALS = n => n.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase();

export function renderAll(S, contract, elements, peers, ME) {
  renderStatusStrip(S, elements.statusStrip);
  renderMetrics(S, elements.metrics);
  renderCluster(S, elements);
  drawRing(elements.ringCanvas, S);
  drawLoss(elements.lossCanvas, S);
  renderPresence(peers, ME, elements);
}

export function renderPresence(peers, ME, elements) {
  const list = Array.from(peers.values());
  const all = [ME, ...list];
  elements.avatars.innerHTML = all.map(p => `
    <div class="avatar ${p === ME ? "self" : ""}" style="--c:${p.color}"
         title="${p.name}${p === ME ? " (you)" : ""} · ${p.focus || p.activity || "idle"}">
      ${AVATAR_INITIALS(p.name)}
    </div>`).join("");

  elements.soloHint.textContent = list.length
    ? `${list.length} collaborator${list.length > 1 ? "s" : ""} live`
    : "solo session — open a 2nd tab to collaborate live";

  document.querySelectorAll("[data-chips]").forEach(el => {
    const key = el.dataset.chips;
    const who = list.filter(p => p.focus === key);
    el.innerHTML = who.map(p =>
      `<div class="peer-chip" style="--c:${p.color}" title="${p.name} is viewing">${AVATAR_INITIALS(p.name)}</div>`
    ).join("");
    const panel = el.closest(".panel");
    if (panel) panel.classList.toggle("peer-focus", who.length > 0);
  });
}

export function recompileContractUI(S, contract, elements) {
  contract = parseContract(S.contractSrc);
  elements.compiledTs.innerHTML = highlightTs(compileTs(contract));

  const badge = elements.contractBadge;
  if (contract.diags.length) {
    badge.textContent = contract.diags.length + " error" + (contract.diags.length > 1 ? "s" : "");
    badge.classList.add("err");
  } else {
    badge.textContent = "compiled · " + contract.fields.length + " fields";
    badge.classList.remove("err");
  }
  renderDiags(elements.contractDiags, contract.diags, `type contract "${contract.name}" compiled — ${contract.fields.length} field(s), 0 errors`);
  return contract;
}