/* =========================================================================
   Main Entry Point
   ========================================================================= */

import { createAppState, recompileContract, setContract } from "./state.js";
import { recompileContractUI, renderAll, renderPresence } from "./rendering.js";
import { log, clearLogs } from "./logging.js";
import { createIdentity, persistIdentity, createChannel, postMessage } from "../collaboration/channel.js";
import { createPeerMap, handleMessage, currentActivity, startPresenceHeartbeat, setupBeforeUnload } from "../collaboration/presence.js";
import { spawnDemoPeer, createDemoActions, setContractFieldsLength } from "../collaboration/events.js";
import { recompileTiming, advance, completeStep, resetState, syncSlidersFromState } from "../simulation/training.js";
import { runInference } from "../inference/client.js";
import { DEFAULT_CONTRACT, DEFAULT_REQUEST, BAD_REQUEST } from "../simulation/training.js";

// Initialize state
const { S, contract: initialContract } = createAppState();
let contract = initialContract;

// Initialize collaboration
const ME = createIdentity();
persistIdentity(ME);
const peers = createPeerMap();
const chan = createChannel();

if (chan) {
  chan.onmessage = e => handleMessage(peers, ME, e.data, log, () => renderPresence(peers, ME, elements), applyRemotePatch, () => {
    contract = recompileContract({ S, contract });
    setContract({ S, contract }, contract);
  });
}

// Set up contract fields length for demo actions
setContractFieldsLength(() => contract.fields.length);

// DOM Elements
const elements = {
  // Top bar
  statusStrip: $("#statusStrip"),
  avatars: $("#avatars"),
  soloHint: $("#soloHint"),
  
  // Cluster panel
  ringCanvas: $("#ringCanvas"),
  lossCanvas: $("#lossCanvas"),
  commStats: $("#commStats"),
  replicaCountLabel: $("#replicaCountLabel"),
  replicaList: $("#replicaList"),
  versions: $("#versions"),
  strategy: $("#strategy"),
  
  // Training panel
  metrics: $("#metrics"),
  btnPlay: $("#btnPlay"),
  btnStep: $("#btnStep"),
  btnReset: $("#btnReset"),
  sReplicas: $("#sReplicas"),
  vReplicas: $("#vReplicas"),
  sBatch: $("#sBatch"),
  vBatch: $("#vBatch"),
  sSeq: $("#sSeq"),
  vSeq: $("#vSeq"),
  sLr: $("#sLr"),
  vLr: $("#vLr"),
  sAccum: $("#sAccum"),
  vAccum: $("#vAccum"),
  vGlobal: $("#vGlobal"),
  
  // Contract panel
  contractSrc: $("#contractSrc"),
  compiledTs: $("#compiledTs"),
  contractDiags: $("#contractDiags"),
  contractBadge: $("#contractBadge"),
  
  // Inference panel
  requestSrc: $("#requestSrc"),
  requestDiags: $("#requestDiags"),
  responseBox: $("#responseBox"),
  btnSampleOk: $("#btnSampleOk"),
  btnSampleBad: $("#btnSampleBad"),
  btnInfer: $("#btnInfer"),
  
  // Logs panel
  logStream: $("#logStream"),
  btnClearLogs: $("#btnClearLogs"),
  btnPeer: $("#btnPeer"),
  
  // About modal
  aboutModal: $("#aboutModal"),
  btnAbout: $("#btnAbout"),
  brandBtn: $("#brandBtn"),
  aboutClose: $("#aboutClose"),
  year: $("#year")
};

// Initialize UI
elements.contractSrc.value = S.contractSrc;
elements.requestSrc.value = S.requestSrc;
contract = recompileContractUI(S, contract, elements);
syncSlidersFromState(S, elements);
recompileTiming(S);
renderPresence(peers, ME, elements);
renderAll(S, contract, elements, peers, ME);

log("sys", "AEL Digital Studio · TF-Serving Lab bootstrapped · gRPC :8500 · REST :8501", "serving");
log("ok", `loaded ael/transformer-lm (${fmtN(PARAMS)} params · ${MODEL.layers}L/${MODEL.hidden}H/${MODEL.heads} heads)`, "serving");
log("info", `data-parallel group ready with ${S.replicas} replicas · strategy=${S.strategy}`, "ddp");
log("sys", "BroadcastChannel collaboration bus online — open a second tab to co-edit the run", "collab");
log("sys", "workbench by Ayman Elmasry · aymanelmasry.com", "brand");

postMessage(chan, { type: "hello", focus: null, activity: "observing" }, ME);

// Import needed functions
import { $, fmtN, MODEL, PARAMS } from "./utils.js";
import { applyRemotePatch } from "./utils.js";

// Event Listeners

// Learning rate slider
elements.sLr.addEventListener("input", e => {
  const t = +e.target.value / 100;
  S.lr = Math.pow(10, -5 + t * 4);
  elements.vLr.textContent = S.lr.toExponential(1);
  recompileTiming(S);
  broadcastPatch({ lr: S.lr });
});

// Replicas slider
elements.sReplicas.addEventListener("input", e => {
  S.replicas = +e.target.value;
  elements.vReplicas.textContent = S.replicas;
  elements.vGlobal.textContent = S.batch * S.replicas * S.accum;
  S.replicaStats = [];
  recompileTiming(S);
  broadcastPatch({ replicas: S.replicas });
  log("sys", `replica group rescaled → ${S.replicas} ranks (global batch ${S.batch * S.replicas * S.accum})`, "ddp");
});

// Batch slider
elements.sBatch.addEventListener("input", e => {
  S.batch = +e.target.value;
  elements.vBatch.textContent = S.batch;
  elements.vGlobal.textContent = S.batch * S.replicas * S.accum;
  recompileTiming(S);
  broadcastPatch({ batch: S.batch });
});

// Seq length slider
elements.sSeq.addEventListener("input", e => {
  S.seq = +e.target.value;
  elements.vSeq.textContent = S.seq;
  recompileTiming(S);
  broadcastPatch({ seq: S.seq });
});

// Grad accumulation slider
elements.sAccum.addEventListener("input", e => {
  S.accum = +e.target.value;
  elements.vAccum.textContent = S.accum;
  elements.vGlobal.textContent = S.batch * S.replicas * S.accum;
  recompileTiming(S);
  broadcastPatch({ accum: S.accum });
});

// Strategy select
elements.strategy.addEventListener("change", e => {
  S.strategy = e.target.value;
  recompileTiming(S);
  log("sys", `all-reduce backend switched → ${S.strategy}`, "nccl");
  broadcastPatch({ strategy: S.strategy });
});

// Play/Pause button
elements.btnPlay.addEventListener("click", () => {
  S.running = !S.running;
  elements.btnPlay.textContent = S.running ? "⏸ Pause" : "▶ Start";
  if (S.running) {
    log("ok", `training resumed at step ${S.step} · ${S.replicas}×DDP · global batch ${S.batch * S.replicas * S.accum}`, "ddp");
    postMessage(chan, { type: "log", level: "ok", msg: `started training run at step ${S.step}`, src: "ddp" }, ME);
  } else {
    log("warn", `training paused at step ${S.step}`, "ddp");
  }
});

// Step button
elements.btnStep.addEventListener("click", () => {
  completeStep(S);
  log("info", `single optimizer step executed (step ${S.step})`, "ddp");
});

// Reset button
elements.btnReset.addEventListener("click", () => {
  resetState(S);
  elements.btnPlay.textContent = "▶ Start";
  log("warn", "training state reset — weights re-initialised from seed 1337", "ddp");
});

// Clear logs
elements.btnClearLogs.addEventListener("click", clearLogs);

// Demo peer
elements.btnPeer.addEventListener("click", () => {
  const DEMO_ACTIONS = createDemoActions(S, () => syncSlidersFromState(S, elements), () => recompileTiming(S));
  spawnDemoPeer(peers, log, () => renderPresence(peers, ME, elements), DEMO_ACTIONS);
});

// Contract editor
elements.contractSrc.addEventListener("input", e => {
  S.contractSrc = e.target.value;
  contract = recompileContractUI(S, contract, elements);
  debouncedBroadcastContract();
});

let contractBroadcastTimer = null;
function debouncedBroadcastContract() {
  clearTimeout(contractBroadcastTimer);
  contractBroadcastTimer = setTimeout(() => postMessage(chan, { type: "contract", src: S.contractSrc }, ME), 420);
}

// Request editor
elements.requestSrc.addEventListener("input", e => { S.requestSrc = e.target.value; });

// Sample buttons
elements.btnSampleOk.addEventListener("click", () => {
  S.requestSrc = DEFAULT_REQUEST;
  elements.requestSrc.value = DEFAULT_REQUEST;
  elements.requestDiags.innerHTML = "";
});

elements.btnSampleBad.addEventListener("click", () => {
  S.requestSrc = BAD_REQUEST;
  elements.requestSrc.value = BAD_REQUEST;
  log("warn", "loaded deliberately invalid payload to exercise the contract validator", "client");
});

// Inference button
elements.btnInfer.addEventListener("click", () => runInference(S, contract, elements, chan));

// Focus tracking for presence
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

// Main loop
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

// Handle window resize
window.addEventListener("resize", () => { drawRing(elements.ringCanvas, S); drawLoss(elements.lossCanvas, S); });

// Broadcast patch helper
function broadcastPatch(patch) {
  postMessage(chan, { type: "state", patch }, ME);
}

// Apply remote patch
function applyRemotePatch(patch, who, color) {
  Object.assign(S, patch);
  S.replicaStats = [];
  syncSlidersFromState(S, elements);
  recompileTiming(S);
  const pretty = Object.entries(patch).map(([k, v]) =>
    `${k}=${typeof v === "number" && v < 1e-2 ? v.toExponential(1) : v}`).join(", ");
  log("sys", `${who} applied ${pretty}`, "collab", who, color);
}

// Start main loop
requestAnimationFrame(loop);