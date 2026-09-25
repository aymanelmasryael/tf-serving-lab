/* =========================================================================
   Main Entry Point
   ========================================================================= */

import { $, fmtN } from "./utils.js";
import { PARAMS } from "../simulation/model.js";
import { createAppState, setContract } from "./state.js";
import { recompileContractUI, renderPresence } from "./rendering.js";
import { log, clearLogs } from "./logging.js";
import { drawRing, drawLoss, renderCluster } from "../simulation/cluster.js";
import { renderStatusStrip, renderMetrics } from "../simulation/metrics.js";
import { parseContract } from "../contracts/parser.js";
import { createIdentity, persistIdentity, createChannel, postMessage } from "../collaboration/channel.js";
import { createPeerMap, handleMessage, currentActivity, startPresenceHeartbeat, setupBeforeUnload } from "../collaboration/presence.js";
import { spawnDemoPeer, createDemoActions, setContractFieldsLength } from "../collaboration/events.js";
import { recompileTiming, advance, completeStep, resetState, syncSlidersFromState, DEFAULT_CONTRACT, DEFAULT_REQUEST, BAD_REQUEST } from "../simulation/training.js";
import { runInference } from "../inference/client.js";

// ---------- State ----------
const { S } = createAppState();
let contract = parseContract(S.contractSrc);

// ---------- Identity & Collaboration ----------
const ME = createIdentity();
persistIdentity(ME);
const peers = createPeerMap();
const chan = createChannel();

// ---------- DOM Cache ----------
const elements = {
  statusStrip: $("#statusStrip"),
  avatars: $("#avatars"),
  soloHint: $("#soloHint"),
  ringCanvas: $("#ringCanvas"),
  lossCanvas: $("#lossCanvas"),
  commStats: $("#commStats"),
  replicaCountLabel: $("#replicaCountLabel"),
  replicaList: $("#replicaList"),
  versions: $("#versions"),
  strategy: $("#strategy"),
  metrics: $("#metrics"),
  btnPlay: $("#btnPlay"),
  btnStep: $("#btnStep"),
  btnReset: $("#btnReset"),
  sReplicas: $("#sReplicas"), vReplicas: $("#vReplicas"),
  sBatch: $("#sBatch"),       vBatch: $("#vBatch"),
  sSeq: $("#sSeq"),           vSeq: $("#vSeq"),
  sLr: $("#sLr"),             vLr: $("#vLr"),
  sAccum: $("#sAccum"),       vAccum: $("#vAccum"),
  vGlobal: $("#vGlobal"),
  contractSrc: $("#contractSrc"),
  compiledTs: $("#compiledTs"),
  contractDiags: $("#contractDiags"),
  contractBadge: $("#contractBadge"),
  requestSrc: $("#requestSrc"),
  requestDiags: $("#requestDiags"),
  responseBox: $("#responseBox"),
  btnSampleOk: $("#btnSampleOk"),
  btnSampleBad: $("#btnSampleBad"),
  btnInfer: $("#btnInfer"),
  logStream: $("#logStream"),
  btnClearLogs: $("#btnClearLogs"),
  btnPeer: $("#btnPeer"),
  aboutModal: $("#aboutModal"),
  btnAbout: $("#btnAbout"),
  brandBtn: $("#brandBtn"),
  aboutClose: $("#aboutClose"),
  year: $("#year")
};

// ---------- Demo actions hook ----------
setContractFieldsLength(() => contract.fields.length);

// ---------- Collaboration message handler ----------
if (chan) {
  chan.onmessage = e => handleMessage(
    peers, ME, e.data, log,
    () => renderPresence(peers, ME, elements),
    applyRemotePatch
  );
}

// ---------- Initial render ----------
elements.contractSrc.value = S.contractSrc;
elements.requestSrc.value = S.requestSrc;
contract = recompileContractUI(S, contract, elements);
syncSlidersFromState(S, elements);
recompileTiming(S);
renderPresence(peers, ME, elements);
renderStatusStrip(S, elements.statusStrip);
renderMetrics(S, elements.metrics);
renderCluster(S, elements);
drawRing(elements.ringCanvas, S);
drawLoss(elements.lossCanvas, S);

log("sys", "AEL Digital Studio · TF-Serving Lab bootstrapped", "serving");
log("ok",  `loaded ael/transformer-lm (${fmtN(PARAMS)} params)`, "serving");
log("info", `data-parallel group ready with ${S.replicas} replicas · strategy=${S.strategy}`, "ddp");
log("sys", "BroadcastChannel online — open a 2nd tab to collaborate", "collab");
log("sys", "workbench by Ayman Elmasry · aymanelmasry.com", "brand");

postMessage(chan, { type: "hello", focus: null, activity: "observing" }, ME);

// ---------- Heartbeat ----------
startPresenceHeartbeat(
  peers, ME, chan,
  m => postMessage(chan, m, ME),
  () => currentActivity(S, ME),
  () => renderPresence(peers, ME, elements)
);
setupBeforeUnload(m => postMessage(chan, m, ME));

// ---------- Helpers ----------
function broadcastPatch(patch) {
  postMessage(chan, { type: "state", patch }, ME);
}

function applyRemotePatch(patch, who, color) {
  Object.assign(S, patch);
  S.replicaStats = [];
  syncSlidersFromState(S, elements);
  recompileTiming(S);
  const pretty = Object.entries(patch).map(([k, v]) =>
    `${k}=${typeof v === "number" && v < 1e-2 ? v.toExponential(1) : v}`).join(", ");
  log("sys", `${who} applied ${pretty}`, "collab", who, color);
}

// ---------- Event Listeners ----------
elements.sLr.addEventListener("input", e => {
  const t = +e.target.value / 100;
  S.lr = Math.pow(10, -5 + t * 4);
  elements.vLr.textContent = S.lr.toExponential(1);
  recompileTiming(S);
  broadcastPatch({ lr: S.lr });
});

elements.sReplicas.addEventListener("input", e => {
  S.replicas = +e.target.value;
  elements.vReplicas.textContent = S.replicas;
  elements.vGlobal.textContent = S.batch * S.replicas * S.accum;
  S.replicaStats = [];
  recompileTiming(S);
  broadcastPatch({ replicas: S.replicas });
  log("sys", `replica group rescaled → ${S.replicas} ranks`, "ddp");
});

elements.sBatch.addEventListener("input", e => {
  S.batch = +e.target.value;
  elements.vBatch.textContent = S.batch;
  elements.vGlobal.textContent = S.batch * S.replicas * S.accum;
  recompileTiming(S);
  broadcastPatch({ batch: S.batch });
});

elements.sSeq.addEventListener("input", e => {
  S.seq = +e.target.value;
  elements.vSeq.textContent = S.seq;
  recompileTiming(S);
  broadcastPatch({ seq: S.seq });
});

elements.sAccum.addEventListener("input", e => {
  S.accum = +e.target.value;
  elements.vAccum.textContent = S.accum;
  elements.vGlobal.textContent = S.batch * S.replicas * S.accum;
  recompileTiming(S);
  broadcastPatch({ accum: S.accum });
});

elements.strategy.addEventListener("change", e => {
  S.strategy = e.target.value;
  recompileTiming(S);
  log("sys", `all-reduce backend switched → ${S.strategy}`, "nccl");
  broadcastPatch({ strategy: S.strategy });
});

elements.btnPlay.addEventListener("click", () => {
  S.running = !S.running;
  elements.btnPlay.textContent = S.running ? "⏸ Pause" : "▶ Start";
  log(S.running ? "ok" : "warn",
    S.running ? `training resumed at step ${S.step}` : `training paused at step ${S.step}`, "ddp");
});

elements.btnStep.addEventListener("click", () => {
  completeStep(S);
  log("info", `single optimizer step executed (step ${S.step})`, "ddp");
});

elements.btnReset.addEventListener("click", () => {
  resetState(S);
  elements.btnPlay.textContent = "▶ Start";
  log("warn", "training state reset — seed 1337", "ddp");
});

elements.btnClearLogs.addEventListener("click", clearLogs);

elements.btnPeer.addEventListener("click", () => {
  const DEMO_ACTIONS = createDemoActions(S,
    () => syncSlidersFromState(S, elements),
    () => recompileTiming(S));
  spawnDemoPeer(peers, log, () => renderPresence(peers, ME, elements), DEMO_ACTIONS);
});

elements.contractSrc.addEventListener("input", e => {
  S.contractSrc = e.target.value;
  contract = recompileContractUI(S, contract, elements);
  clearTimeout(debouncedBroadcastContract._t);
  debouncedBroadcastContract._t = setTimeout(
    () => postMessage(chan, { type: "contract", src: S.contractSrc }, ME), 420);
});

elements.requestSrc.addEventListener("input", e => { S.requestSrc = e.target.value; });

elements.btnSampleOk.addEventListener("click", () => {
  S.requestSrc = DEFAULT_REQUEST;
  elements.requestSrc.value = DEFAULT_REQUEST;
  elements.requestDiags.innerHTML = "";
});

elements.btnSampleBad.addEventListener("click", () => {
  S.requestSrc = BAD_REQUEST;
  elements.requestSrc.value = BAD_REQUEST;
  log("warn", "loaded deliberately invalid payload", "client");
});

elements.btnInfer.addEventListener("click", () => runInference(S, contract, elements, chan));

// Focus tracking
document.addEventListener("focusin", e => {
  const panel = e.target.closest("[data-panel]");
  const key = panel ? panel.dataset.panel : null;
  if (key !== ME.focus) {
    ME.focus = key;
    postMessage(chan, { type: "presence", focus: ME.focus, activity: currentActivity(S, ME) }, ME);
    renderPresence(peers, ME, elements);
  }
});

document.addEventListener("focusout", () => {
  setTimeout(() => {
    if (!document.activeElement || !document.activeElement.closest("[data-panel]")) {
      ME.focus = null;
      postMessage(chan, { type: "presence", focus: null, activity: currentActivity(S, ME) }, ME);
      renderPresence(peers, ME, elements);
    }
  }, 60);
});

// About modal
function openAbout() { elements.aboutModal.classList.add("open"); }
function closeAbout() { elements.aboutModal.classList.remove("open"); }
elements.btnAbout.addEventListener("click", openAbout);
elements.brandBtn.addEventListener("click", openAbout);
elements.aboutClose.addEventListener("click", closeAbout);
elements.aboutModal.addEventListener("click", e => { if (e.target === elements.aboutModal) closeAbout(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeAbout(); });
elements.year.textContent = new Date().getFullYear();

// ---------- Main Loop ----------
let lastT = performance.now();
let slowAccum = 0;

function loop(now) {
  const dt = Math.min(120, now - lastT);
  lastT = now;

  if (S.running) advance(S, dt);

  drawRing(elements.ringCanvas, S);
  drawLoss(elements.lossCanvas, S);

  slowAccum += dt;
  if (slowAccum > 130) {
    slowAccum = 0;
    renderStatusStrip(S, elements.statusStrip);
    renderMetrics(S, elements.metrics);
    renderCluster(S, elements);
  }
  requestAnimationFrame(loop);
}

window.addEventListener("resize", () => {
  drawRing(elements.ringCanvas, S);
  drawLoss(elements.lossCanvas, S);
});

requestAnimationFrame(loop);