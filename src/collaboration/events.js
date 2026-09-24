/* =========================================================================
   Demo Peer Simulation
   ========================================================================= */

import { NAMES, COLORS, pick } from "./channel.js";

export function createDemoActions(S, syncSlidersFromStateFn, recompileTimingFn) {
  return [
    () => { S.lr = clamp(S.lr * rnd(0.6, 1.5), 1e-5, 3e-3); syncSlidersFromStateFn(); recompileTimingFn(); return `swept learning rate → ${S.lr.toExponential(1)}`; },
    () => { S.batch = clamp(Math.round(S.batch * rnd(0.5, 1.8)), 1, 64); syncSlidersFromStateFn(); recompileTimingFn(); return `resized micro-batch → ${S.batch}`; },
    () => { S.replicas = clamp(S.replicas + pick([-1, 1, 1, 2]), 1, 16); syncSlidersFromStateFn(); recompileTimingFn(); return `rescaled replica group → ${S.replicas} ranks`; },
    () => `profiled step ${S.step}: ${S.lastStepMs.toFixed(1)}ms (comm ${S.lastCommMs.toFixed(1)}ms)`,
    () => `checked contract checksum · ${contractFieldsLength()} fields verified`,
    () => pick(["warming KV-cache shard 3", "rotating TF Serving model version v3-canary", "validated gradient bucket alignment", "prefetching eval batch 118"])
  ];
}

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

function rnd(a, b) {
  return a + Math.random() * (b - a);
}

let contractFieldsLength = () => 0;
export function setContractFieldsLength(fn) {
  contractFieldsLength = fn;
}

export function spawnDemoPeer(peers, logFn, renderPresenceFn, DEMO_ACTIONS) {
  const id = "demo-" + Math.random().toString(36).slice(2, 7);
  const p = {
    id, name: pick(NAMES) + "-" + Math.floor(Math.random() * 90 + 10),
    color: pick(COLORS), focus: null, activity: "idle",
    lastSeen: Date.now(), demo: true
  };
  peers.set(id, p);
  logFn("sys", `demo collaborator ${p.name} joined`, "collab", p.name, p.color);
  renderPresenceFn();

  const tick = () => {
    if (!peers.has(id)) return;
    p.focus = pick(["train", "contract", "infer", null, "cluster"]);
    p.lastSeen = Date.now();
    if (Math.random() < 0.45) {
      logFn("info", pick(DEMO_ACTIONS)(), "collab", p.name, p.color);
    }
    renderPresenceFn();
    setTimeout(tick, rnd(2600, 6200));
  };
  setTimeout(tick, 1200);
}