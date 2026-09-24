/* =========================================================================
   Inference Client
   ========================================================================= */

import { validateBody } from "../contracts/validator.js";
import { renderDiags } from "../contracts/diagnostics.js";
import { postMessage } from "../collaboration/channel.js";
import { log } from "../ui/logging.js";

const CANNED_TEXT =
  "Tensor parallelism splits each weight matrix across the accelerator mesh, so every rank computes a " +
  "partial matmul and the shards are reconciled with an all-reduce before the next layer. Data parallelism " +
  "instead replicates the whole model and partitions the global batch; gradients are averaged with a ring " +
  "all-reduce whose cost is 2(N-1)/N times the gradient size, which is why overlap with the backward pass " +
  "and gradient bucketing dominate scaling efficiency beyond eight replicas.";

function rnd(a, b) {
  return a + Math.random() * (b - a);
}

export function runInference(S, contract, elements, chan) {
  let body;
  try { body = JSON.parse(S.requestSrc); }
  catch (e) {
    renderDiags(elements.requestDiags, [{ path: "$", sev: "error", msg: "malformed JSON — " + e.message }], "");
    elements.responseBox.textContent = "— rejected before reaching the model server —";
    log("err", "inference rejected: malformed JSON payload", "client");
    return;
  }

  const diags = validateBody(body, contract);
  const errors = diags.filter(d => d.sev === "error");
  renderDiags(elements.requestDiags, diags, `payload satisfies ${contract.name} — forwarded to TF Serving`);

  if (errors.length) {
    elements.responseBox.textContent = "— 400 Bad Request · contract violation —\n" +
      errors.map(e => `${e.path}: ${e.msg}`).join("\n");
    log("err", `inference rejected: ${errors.length} contract violation(s)`, "client");
    postMessage(chan, { type: "log", level: "warn", msg: `contract violation (${errors.length}) on inference request`, src: "client" });
    return;
  }

  const req = {};
  for (const f of contract.fields) {
    req[f.name] = (body[f.name] !== undefined && body[f.name] !== null) ? body[f.name] : f.def;
  }

  const promptTokens = Math.max(1, Math.round((req.prompt || "").length / 4));
  const maxTok = req.max_tokens || 128;
  const queue = rnd(1.2, 6.5) * (S.running ? 2.4 : 1);
  const prefill = 6 + promptTokens * 0.34 * (req.stream ? 1 : 1.15);
  const decode = maxTok * rnd(0.72, 1.05) * (1 + (S.replicas > 8 ? 0.18 : 0));
  const total = queue + prefill + decode;

  const resp = {
    model: "ael/transformer-lm",
    version: S.running ? "v3-canary" : "v2",
    contract: contract.name + " ✓ validated",
    generated_text: CANNED_TEXT.slice(0, Math.max(80, Math.min(CANNED_TEXT.length, maxTok * 2))),
    usage: { prompt_tokens: promptTokens, completion_tokens: maxTok },
    timings_ms: {
      queue: +queue.toFixed(2),
      prefill: +prefill.toFixed(2),
      decode: +decode.toFixed(2),
      total: +total.toFixed(2)
    },
    sampling: { temperature: req.temperature, top_k: req.top_k ?? null, top_p: req.top_p ?? null }
  };

  elements.responseBox.textContent = JSON.stringify(resp, null, 2);
  log("ok", `200 OK · ${maxTok} tokens in ${total.toFixed(1)}ms (${(maxTok / (decode / 1000)).toFixed(1)} tok/s)`, "serving");
  postMessage(chan, { type: "log", level: "info", msg: `ran inference on ${contract.name} · ${total.toFixed(1)}ms`, src: "serving" });
}