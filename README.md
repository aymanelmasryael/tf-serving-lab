# TF-Serving Lab

Interactive browser-based simulation workbench for distributed Transformer
experimentation, TensorFlow Serving workflows, real-time collaboration, and
type-safe inference contracts.

Built by **Ayman Elmasry** · Founder of AEL Digital Studio ·
https://www.aymanelmasry.com/

---

## About

TF-Serving Lab is a design and engineering artefact — a self-contained browser
application that **models**, but does not run, a distributed Transformer
training and serving pipeline. It was built as an interactive showcase for
AEL Digital Studio, exploring how cluster topology, all-reduce strategies,
contract-driven inference validation, and cross-tab collaboration can feel
inside a single-page UI with no backend.

The lab is a **design and teaching tool**, not a runtime for machine learning.

---

## Implemented / Simulated

**UI and interaction**
- Branded topbar with AEL logo and founder attribution
- About modal with bio, studio tagline, contact links
- Six live panels: Cluster Topology, Training Run, Inference Contract,
  Inference Client, Log Stream, Presence avatars
- Responsive layout down to a single column on narrow viewports

**Simulation**
- Replica-ring canvas with animated all-reduce packets and straggler highlighting
- Training step loop with loss curve, gradient norm, throughput, ETA
- Hyperparameter sliders: replicas, batch, sequence length, LR, grad accumulation
- All-reduce strategy switching: ring, tree, flat, each with its own timing model
- Per-replica statistics (utilization, loss, straggler flag)
- TF Serving model-version panel (canary / stable routing percentages)

**Contract system**
- Contract DSL: contract Name { field: type @decorator = default }
- Types: string, int, float, bool, any, json
- Modifiers: optional marker, array marker, default literal
- Decorators: min, max, range, maxItems, pattern, enum
- Live TypeScript interface projection with syntax highlighting
- Inline compiler diagnostics with line numbers
- Runtime validation of the JSON request against the parsed contract

**Inference simulation**
- Contract-first request validation
- Modeled queue, prefill, decode timing
- Canned generated text (not produced by any model)
- Response payload mirrors a real TF Serving response shape

**Collaboration**
- Cross-tab sync via the browser BroadcastChannel API (channel name: tfs-lab)
- Peer presence with heartbeat every 1.6 seconds and pruning after 5.2 seconds
- Focus chips showing which panel each peer is editing
- Shared state patches (lr, batch, replicas, strategy, accum)
- Contract text sync across tabs
- Log message mirroring
- Demo peer button spawns a scripted local participant

## Not Implemented

- Real distributed TensorFlow training
- Real TensorFlow Serving backend (no gRPC 8500, no REST 8501)
- Real model inference — the response is canned text
- GPU or TPU execution
- Production collaboration server (BroadcastChannel is same-origin only)
- Persistent experiment storage (state resets on refresh)
- Authentication or authorization
- Nested contract types, unions, or custom decorators

---

## 1. Project Overview

The lab exists to explore the ergonomics of data-parallel replica groups,
all-reduce strategies, a small contract DSL, contract-first inference
validation, and cross-tab collaboration — all inside a single HTML file with
no build step and no dependencies.

---

## 2. Architecture

The application ships as a single self-contained file:

    index.html          the live app, HTML + CSS + JS inline
    tf-serving-lab.html identical historical alias

Logical layers inside the file:

    UI controls: sliders, buttons, textareas, canvases
        |
        v
    Application state (the S object)
        |
        v
    Simulation layer
      model shape + parameter count
      cluster timing + all-reduce model
      training step loop + loss curve
      metrics: perplexity, throughput, ETA
        |
        v
    Contract layer
      DSL parser
      TypeScript projection
      runtime validator
      diagnostics renderer
        |
        v
    Inference simulation
        |
        v
    Collaboration layer (parallel)
      BroadcastChannel
        presence (peer map + heartbeat)
        state patches
        log forwarding
        contract sync

---

## 3. Simulation Model

Fixed GPT-2-small-class shape: vocab 50257, hidden 768, layers 12,
heads 12, maxSeq 1024.

Parameter count, exact for the declared shape:

    params = vocab * hidden + maxSeq * hidden
           + layers * (12 * hidden^2 + 13 * hidden)
           + 2 * hidden

Step timing (roofline estimate, not a benchmark):

    compute_ms = 6 * params * (batch * seq / accum) / 312e12 * 1000 * 2.6
    comm_ms    = params * 2 * 1.02 * factor / 90e9 * 1000
    step_ms    = compute_ms + comm_ms + 2.4

All-reduce factor per strategy:

    ring: 2 * (N - 1) / N
    tree: max(0.25, log2(N) / N * 2.2)
    flat: (N - 1) / N * 1.35

Throughput, global batch, and scaling efficiency:

    global_batch = batch * replicas * accum
    tps          = global_batch * seq / (step_ms / 1000)
    efficiency   = compute_ms / (compute_ms + comm_ms) * 100

Loss progression: base = 1.42 + 8.6 * exp(-step / decay) with
decay = 900 / (lr / 3e-4)^0.85. An oscillating instability term is added
when lr / 3e-4 > 3.6. The displayed curve is an EMA with alpha = 0.15.

Inference timing:

    queue_ms   = rand(1.2, 6.5) * (running ? 2.4 : 1)
    prefill_ms = 6 + prompt_tokens * 0.34 * (stream ? 1 : 1.15)
    decode_ms  = max_tokens * rand(0.72, 1.05) * (replicas > 8 ? 1.18 : 1)
    total_ms   = queue + prefill + decode

---

## 4. Contract System

Example contract:

    contract GenerationRequest {
      prompt: string @min(1) @max(512)
      max_tokens: int = 128 @range(1,1024)
      temperature: float = 0.7 @range(0.0,2.0)
      top_k: int? @range(1,100)
      top_p: float? @range(0.0,1.0)
      stream: bool = false
      stop: string[]? @maxItems(4)
    }

Pipeline: DSL -> parser -> TypeScript projection -> diagnostics -> runtime
validation -> inference request.

---

## 5. Collaboration Model

Channel name: tfs-lab. There is no server.

    hello     initial join from a new tab
    presence  heartbeat: name, color, focus, activity
    state     partial patch of S: lr, batch, replicas, strategy, accum
    log       mirrored log line
    contract  contract text sync
    bye       tab closing

Open a second browser tab to the same URL and peers appear within about
two seconds. The demo peer button spawns a scripted local participant.

---

## 6. Inference Workflow

1. Edit the contract DSL in the Inference Contract panel.
2. The parser emits a field list; the compiler emits a TypeScript interface;
   diagnostics render live.
3. Edit a JSON request in the Inference Client panel.
4. Press Validate and Infer.
5. On success, a simulated response with modeled timing is returned.
6. On failure, a 400-style error block is rendered.

---

## 7. Running Locally

No build step. No dependencies.

    python3 -m http.server 8000

Then open http://localhost:8000/ in any modern browser. You can also open
index.html directly by double-clicking it.

---

## 8. Project Structure

    tf-serving-lab/
      index.html               live app, self-contained
      tf-serving-lab.html      identical historical alias
      README.md
      .gitignore
      assets/
        screenshots/
          .gitkeep

Additional directories (docs, src) may be added later.

---

## 9. Current Limitations

- Single-file architecture — all logic is inline in index.html
- Simulation only — no real TensorFlow, no real training, no GPU execution
- No persistence — refreshing the tab resets everything
- BroadcastChannel only — collaboration is per-browser, same-origin tabs
- Fixed model shape — GPT-2 small parameters, not user-configurable
- Approximate timing — roofline estimates, not measured benchmarks
- Canned output — generated text is a fixed string, not model output

---

## 10. Future Architecture (NOT implemented)

    TRAINING PLANE          TensorFlow / tf.distribute
            |
            v
    MODEL ARTIFACT          SavedModel export
            |
            v
    SERVING PLANE           TensorFlow Serving, REST 8501 / gRPC 8500
            |
            v
    Inference Clients       this lab's contract layer

None of this backend is implemented here. The contract layer is shaped so
it could eventually serve as the client boundary for such a pipeline.

---

## 11. License

MIT (c) Ayman Elmasry · AEL Digital Studio...content...
