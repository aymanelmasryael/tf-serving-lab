/* =========================================================================
   Cluster Rendering
   ========================================================================= */

import { PARAMS } from "./model.js";

const AVATAR_INITIALS = n => n.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase();

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

function fitCanvas(cv) {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  if (cv.width !== w * dpr || cv.height !== h * dpr) {
    cv.width = w * dpr; cv.height = h * dpr;
  }
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

export function drawRing(ringCv, S) {
  const { ctx, w, h } = fitCanvas(ringCv);
  ctx.clearRect(0, 0, w, h);

  const N = S.replicas;
  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) * 0.32;

  const coreR = Math.max(14, R * 0.34);
  const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, coreR);
  const active = S.phase === "allreduce";
  grad.addColorStop(0, active ? "rgba(167,139,250,.42)" : "rgba(0,116,255,.22)");
  grad.addColorStop(1, "rgba(10,15,25,0)");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(160,190,220,.55)";
  ctx.font = "600 9px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(S.strategy === "flat" ? "PS" : "NCCL", cx, cy + 3);

  const nodes = [];
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / N;
    nodes.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a });
  }
  ctx.lineWidth = 1.4;
  for (let i = 0; i < N; i++) {
    const a = nodes[i], b = nodes[(i + 1) % N];
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    const hot = active ? 0.65 : 0.18;
    g.addColorStop(0, `rgba(0,116,255,${hot})`);
    g.addColorStop(1, `rgba(167,139,250,${hot})`);
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(cx, cy, b.x, b.y);
    ctx.stroke();
  }

  if (active && N > 1) {
    const p = (S.phaseP - 0.55) / 0.31;
    const gather = p > 0.5;
    const u = (gather ? (p - 0.5) * 2 : p * 2);
    for (let i = 0; i < N; i++) {
      const t = (i / N + u) % 1;
      const seg = t * N;
      const idx = Math.floor(seg) % N;
      const local = seg - Math.floor(seg);
      const a = nodes[idx], b = nodes[(idx + 1) % N];
      const mx = (a.x + b.x) / 2 * 0.35 + cx * 0.65;
      const my = (a.y + b.y) / 2 * 0.35 + cy * 0.65;
      const x = (1 - local) * (1 - local) * a.x + 2 * (1 - local) * local * mx + local * local * b.x;
      const y = (1 - local) * (1 - local) * a.y + 2 * (1 - local) * local * my + local * local * b.y;
      ctx.beginPath();
      ctx.arc(x, y, 3.1, 0, Math.PI * 2);
      ctx.fillStyle = gather ? "#a78bfa" : "#0074FF";
      ctx.shadowColor = gather ? "#a78bfa" : "#0074FF";
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  for (let i = 0; i < N; i++) {
    const n = nodes[i];
    const stat = S.replicaStats[i];
    const pulse = S.phase === "compute" ? 0.5 + 0.5 * Math.sin(Date.now() / 180 + i) : 0.25;
    const busy = S.running || S.phase !== "idle";

    ctx.beginPath(); ctx.arc(n.x, n.y, 11, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(8,13,22,.95)"; ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = stat && stat.straggler ? "#fbbf24"
      : busy ? `rgba(0,116,255,${0.55 + pulse * 0.45})` : "rgba(120,150,200,.35)";
    ctx.stroke();

    if (busy) {
      ctx.beginPath(); ctx.arc(n.x, n.y, 15 + pulse * 3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,116,255,${0.16 * (1 - pulse)})`;
      ctx.lineWidth = 1.5; ctx.stroke();
    }

    ctx.fillStyle = "rgba(200,225,250,.92)";
    ctx.font = "700 9px ui-monospace, monospace";
    ctx.fillText("r" + i, n.x, n.y + 3);
  }

  const labels = { idle: "idle", compute: "forward + backward", allreduce: "all-reduce (gradients)", update: "optimizer step" };
  ctx.textAlign = "left";
  ctx.font = "600 9.5px ui-monospace, monospace";
  ctx.fillStyle = "rgba(140,170,205,.75)";
  ctx.fillText((labels[S.phase] || "").toUpperCase(), 9, h - 8);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(0,116,255,.85)";
  ctx.fillText(`${N} × DDP`, w - 9, h - 8);
}

export function drawLoss(lossCv, S) {
  const { ctx, w, h } = fitCanvas(lossCv);
  ctx.clearRect(0, 0, w, h);

  const pad = { l: 38, r: 10, t: 12, b: 20 };
  const W = w - pad.l - pad.r, H = h - pad.t - pad.b;
  if (W <= 0 || H <= 0) return;

  const data = S.history;
  if (data.length < 2) {
    ctx.fillStyle = "rgba(107,125,150,.6)";
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("awaiting training steps…", w / 2, h / 2);
    return;
  }

  const ys = data.map(d => d.loss);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo < 0.6) { hi += 0.3; lo -= 0.3; }
  const padY = (hi - lo) * 0.12;
  const y0 = Math.max(0, lo - padY), y1 = hi + padY;

  const X = i => pad.l + (i / (data.length - 1)) * W;
  const Y = v => pad.t + H - ((v - y0) / (y1 - y0)) * H;

  ctx.strokeStyle = "rgba(120,150,200,.10)";
  ctx.lineWidth = 1;
  ctx.font = "9px ui-monospace, monospace";
  ctx.fillStyle = "rgba(107,125,150,.85)";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const v = y0 + (i / 4) * (y1 - y0);
    const y = Y(v);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + W, y); ctx.stroke();
    ctx.fillText(v.toFixed(2), pad.l - 6, y + 3);
  }

  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + H);
  grad.addColorStop(0, "rgba(0,116,255,.24)");
  grad.addColorStop(1, "rgba(0,116,255,0)");
  ctx.beginPath();
  ctx.moveTo(X(0), pad.t + H);
  data.forEach((d, i) => ctx.lineTo(X(i), Y(d.loss)));
  ctx.lineTo(X(data.length - 1), pad.t + H);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  ctx.beginPath();
  data.forEach((d, i) => i ? ctx.lineTo(X(i), Y(d.loss)) : ctx.moveTo(X(i), Y(d.loss)));
  ctx.strokeStyle = "rgba(0,116,255,.38)";
  ctx.lineWidth = 1; ctx.stroke();

  let ema = data[0].loss;
  ctx.beginPath();
  data.forEach((d, i) => {
    ema = ema * 0.88 + d.loss * 0.12;
    i ? ctx.lineTo(X(i), Y(ema)) : ctx.moveTo(X(i), Y(ema));
  });
  ctx.strokeStyle = "#3b9bff";
  ctx.lineWidth = 1.9;
  ctx.shadowColor = "rgba(0,116,255,.7)"; ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  const lx = X(data.length - 1), ly = Y(data[data.length - 1].loss);
  ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#9ecbff"; ctx.fill();

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(107,125,150,.85)";
  ctx.font = "9px ui-monospace, monospace";
  ctx.fillText("loss", pad.l, pad.t - 2);
  ctx.textAlign = "right";
  ctx.fillText("step " + data[data.length - 1].step, pad.l + W, h - 6);
}

export function renderCluster(S, elements) {
  const N = S.replicas;
  const gradBytes = PARAMS * 2 * 1.02;
  const eff = S.lastComputeMs + S.lastCommMs > 0
    ? (S.lastComputeMs / (S.lastComputeMs + S.lastCommMs)) * 100 : 100;
  const idealTps = S.tps / (eff / 100 || 1);

  elements.commStats.innerHTML = `
    <div class="kv"><span>grad / step</span><span>${(gradBytes / 1e6).toFixed(0)} MB</span></div>
    <div class="kv"><span>compute</span><span>${fmtMs(S.lastComputeMs)}</span></div>
    <div class="kv"><span>all-reduce</span><span>${fmtMs(S.lastCommMs)}</span></div>
    <div class="kv"><span>scaling eff</span><span style="color:${eff > 80 ? "#34d399" : eff > 55 ? "#fbbf24" : "#fb7185"}">${eff.toFixed(1)}%</span></div>
    <div class="kv"><span>ideal tps</span><span>${fmtN(idealTps)}</span></div>
    <div class="kv"><span>strategy</span><span>${S.strategy}</span></div>
  `;

  elements.replicaCountLabel.textContent = `· ${N} rank${N > 1 ? "s" : ""}`;

  const stats = S.replicaStats.length === N ? S.replicaStats
    : Array.from({ length: N }, (_, i) => ({ rank: i, loss: S.loss, gradNorm: S.gradNorm, util: 0, straggler: false }));

  elements.replicaList.innerHTML = stats.map(r => `
    <div class="replica ${S.running ? "active" : ""}">
      <span class="rname">rank ${r.rank}</span>
      <span class="bar"><i style="width:${r.util.toFixed(1)}%"></i></span>
      <span class="rloss">${r.loss.toFixed(4)}</span>
      ${r.straggler ? '<span class="stag">slow</span>' : ""}
    </div>
  `).join("");

  const versions = [
    { v: "v3-canary", pct: 10, status: "canary", color: "#fbbf24" },
    { v: "v2", pct: 25, status: "stable", color: "#34d399" },
    { v: "v1", pct: 65, status: "stable", color: "#60a5fa" }
  ];
  elements.versions.innerHTML = versions.map(x => `
    <div class="version">
      <span class="vname">${x.v} <span class="tag ${x.status}">${x.status}</span></span>
      <span class="vbar"><i style="width:${x.pct}%;background:${x.color}"></i></span>
      <span class="vpct">${x.pct}%</span>
    </div>
  `).join("");
}