/* =========================================================================
   Training Simulation Engine
   ========================================================================= */

import { PARAMS } from "./model.js";

export function createInitialState() {
  return {
    running: false,
    step: 0,
    maxSteps: 6000,
    phase: "idle",
    phaseP: 0,
    phaseT: 0,

    replicas: 4,
    batch: 16,
    seq: 512,
    lr: 3e-4,
    accum: 1,
    strategy: "ring",

    loss: 9.9,
    smoothLoss: 9.9,
    gradNorm: 1.0,
    history: [],
    tps: 0,
    lastStepMs: 52,
    lastComputeMs: 47,
    lastCommMs: 5,

    replicaStats: []
  };
}

export const DEFAULT_CONTRACT = `contract GenerationRequest {
  // required prompt string, 1..512 characters
  prompt: string @min(1) @max(512)
  max_tokens: int = 128 @range(1,1024)
  temperature: float = 0.7 @range(0.0,2.0)
  top_k: int? @range(1,100)
  top_p: float? @range(0.0,1.0)
  stream: bool = false
  stop: string[]? @maxItems(4)
}`;

export const DEFAULT_REQUEST = `{
  "prompt": "Explain tensor parallelism in one paragraph.",
  "max_tokens": 256,
  "temperature": 0.9,
  "top_k": 40,
  "stream": true,
  "stop": ["\\n\\n", "###"]
}`;

export const BAD_REQUEST = `{
  "prompt": "",
  "max_tokens": 9000,
  "temperature": "hot",
  "top_k": 250,
  "stream": true,
  "stop": ["a", "b", "c", "d", "e", "f"],
  "top_p": 3.4
}`;

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

function rnd(a, b) {
  return a + Math.random() * (b - a);
}

export function recompileTiming(S) {
  const N = S.replicas;
  const tokensPerReplica = S.batch * S.seq / S.accum;

  const flops = 6 * PARAMS * tokensPerReplica;
  const computeMs = (flops / (312e12)) * 1000 * 2.6;

  const gradBytes = PARAMS * 2 * 1.02;
  const bw = 90e9;
  const factor = S.strategy === "ring" ? 2 * (N - 1) / N
               : S.strategy === "tree" ? Math.max(0.25, Math.log2(Math.max(2, N)) / N * 2.2)
               : (N - 1) / N * 1.35;
  const commMs = N > 1 ? (gradBytes * factor) / bw * 1000 : 0;

  S.lastComputeMs = computeMs;
  S.lastCommMs = commMs;
  S.lastStepMs = computeMs + commMs + 2.4;

  const globalBatch = S.batch * N * S.accum;
  S.tps = (globalBatch * S.seq) / (S.lastStepMs / 1000);
}

export function advance(S, dt) {
  S.phaseT += dt;
  if (S.phaseT >= S.lastStepMs) {
    S.phaseT = S.phaseT % S.lastStepMs;
    completeStep(S);
  }
  const p = S.phaseT / S.lastStepMs;
  S.phaseP = p;
  S.phase = p < 0.55 ? "compute" : p < 0.86 ? "allreduce" : "update";
}

let stepCounter = 0;

export function completeStep(S) {
  S.step++;
  stepCounter++;

  const lrFactor = S.lr / 3e-4;
  const decay = 900 / Math.pow(lrFactor, 0.85);
  let base = 1.42 + 8.6 * Math.exp(-S.step / decay);

  if (lrFactor > 3.6) base += (lrFactor - 3.6) * 0.55 * (1 + Math.sin(S.step / 7));

  const noiseAmp = 0.055 * Math.sqrt(lrFactor);
  const loss = Math.max(0.4, base + rnd(-noiseAmp, noiseAmp));
  S.loss = loss;
  S.smoothLoss = S.smoothLoss * 0.85 + loss * 0.15;
  S.gradNorm = Math.max(0.05, 1.15 * Math.exp(-S.step / 1400) + rnd(-0.08, 0.08));

  S.history.push({ step: S.step, loss });
  if (S.history.length > 320) S.history.shift();

  const N = S.replicas;
  S.replicaStats = [];
  for (let i = 0; i < N; i++) {
    const straggler = i === N - 1 && N > 2 && (S.step % 17 < 4);
    S.replicaStats.push({
      rank: i,
      loss: loss + rnd(-0.045, 0.045) + (straggler ? 0.09 : 0),
      gradNorm: S.gradNorm * rnd(0.9, 1.1),
      util: clamp(rnd(88, 99) - (straggler ? 22 : 0), 40, 99.5),
      straggler
    });
  }

  if (stepCounter % 20 === 0) {
    // Logging is handled by the UI layer
  }
  if (lrFactor > 3.6 && S.step % 25 === 0) {
    // LR instability warning
  }
  if (S.step % 250 === 0 && S.step > 0) {
    // Checkpoint log
  }
  if (S.step >= S.maxSteps) {
    S.running = false;
  }
}

export function resetState(S) {
  S.step = 0;
  S.loss = 9.9;
  S.smoothLoss = 9.9;
  S.gradNorm = 1.0;
  S.history = [];
  S.phaseT = 0;
  S.phase = "idle";
  S.running = false;
  S.replicaStats = [];
  stepCounter = 0;
}

export function syncSlidersFromState(S, elements) {
  elements.sReplicas.value = S.replicas; elements.vReplicas.textContent = S.replicas;
  elements.sBatch.value = S.batch;       elements.vBatch.textContent = S.batch;
  elements.sSeq.value = S.seq;           elements.vSeq.textContent = S.seq;
  elements.sAccum.value = S.accum;       elements.vAccum.textContent = S.accum;
  elements.vLr.textContent = S.lr.toExponential(1);
  elements.sLr.value = Math.round((Math.log10(S.lr) + 5) / 4 * 100);
  elements.vGlobal.textContent = S.batch * S.replicas * S.accum;
  elements.strategy.value = S.strategy;
}