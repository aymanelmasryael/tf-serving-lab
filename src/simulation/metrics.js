/* =========================================================================
   Metrics Rendering
   ========================================================================= */

import { PARAMS } from "./model.js";

function fmtN(n, d = 1) {
  if (!isFinite(n) || isNaN(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(d) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(d) + "K";
  return a < 10 ? n.toFixed(2) : n.toFixed(0);
}

function fmtMs(ms) {
  if (ms < 1) return ms.toFixed(2) + "ms";
  if (ms < 1000) return ms.toFixed(1) + "ms";
  return (ms / 1000).toFixed(2) + "s";
}

export function renderStatusStrip(S, statusStripEl) {
  const globalBatch = S.batch * S.replicas * S.accum;
  const eff = S.lastComputeMs + S.lastCommMs > 0
    ? (S.lastComputeMs / (S.lastComputeMs + S.lastCommMs)) * 100 : 100;
  statusStripEl.innerHTML = `
    <div class="chip"><span class="lab">step</span><b>${S.step.toLocaleString()}</b></div>
    <div class="chip"><span class="lab">loss</span><b style="color:#3b9bff">${S.smoothLoss.toFixed(4)}</b></div>
    <div class="chip"><span class="lab">throughput</span><b style="color:#34d399">${fmtN(S.tps)} tok/s</b></div>
    <div class="chip"><span class="lab">global batch</span><b>${globalBatch}</b></div>
    <div class="chip"><span class="lab">params</span><b>${fmtN(PARAMS)}</b></div>
    <div class="chip"><span class="lab">scaling eff</span><b style="color:${eff > 80 ? "#34d399" : eff > 55 ? "#fbbf24" : "#fb7185"}">${eff.toFixed(1)}%</b></div>
  `;
}

export function renderMetrics(S, metricsEl) {
  const perplexity = Math.exp(Math.min(20, S.smoothLoss));
  const eta = S.running ? ((S.maxSteps - S.step) * S.lastStepMs / 1000) : 0;
  const globalBatch = S.batch * S.replicas * S.accum;
  const tokensSeen = S.step * globalBatch * S.seq;

  metricsEl.innerHTML = `
    <div class="metric"><div class="k">step</div><div class="v">${S.step.toLocaleString()}<span style="color:var(--dim);font-size:10px">/${S.maxSteps}</span></div></div>
    <div class="metric"><div class="k">loss (ema)</div><div class="v cyan">${S.smoothLoss.toFixed(4)}</div></div>
    <div class="metric"><div class="k">perplexity</div><div class="v violet">${perplexity.toFixed(1)}</div></div>
    <div class="metric"><div class="k">grad norm</div><div class="v ${S.gradNorm > 2 ? "amber" : "green"}">${S.gradNorm.toFixed(3)}</div></div>
    <div class="metric"><div class="k">step time</div><div class="v">${fmtMs(S.lastStepMs)}</div></div>
    <div class="metric"><div class="k">tokens/s</div><div class="v green">${fmtN(S.tps)}</div></div>
    <div class="metric"><div class="k">tokens seen</div><div class="v">${fmtN(tokensSeen)}</div></div>
    <div class="metric"><div class="k">eta</div><div class="v amber">${S.running ? fmtMs(eta * 1000) : "—"}</div></div>
  `;
}