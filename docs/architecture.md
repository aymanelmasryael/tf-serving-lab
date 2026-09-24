# Architecture Documentation

## Actual Implementation Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BROWSER UI (index.html)                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      APPLICATION STATE (src/ui/state.js)                    │
│  • S: Simulation state (step, loss, replicas, batch, lr, etc.)             │
│  • contract: Parsed contract representation                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            ▼                        ▼                        ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│   SIMULATION LAYER    │ │   CONTRACT LAYER      │ │  COLLABORATION LAYER  │
│                       │ │                       │ │                       │
│ src/simulation/       │ │ src/contracts/        │ │ src/collaboration/    │
│ ├─ model.js           │ │ ├─ parser.js          │ │ ├─ channel.js         │
│ ├─ training.js        │ │ ├─ compiler.js        │ │ ├─ presence.js        │
│ ├─ cluster.js         │ │ ├─ validator.js       │ │ └─ events.js          │
│ └─ metrics.js         │ │ └─ diagnostics.js     │ │                       │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
            │                        │                        │
            └────────────────────────┼────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      INFERENCE LAYER (src/inference/)                       │
│  • client.js: Request handling, validation, response orchestration         │
│  • response.js: Response generation with simulated timings                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UI RENDERING (src/ui/)                              │
│  • main.js: Bootstrap, event wiring, main loop                             │
│  • rendering.js: DOM updates for all panels                                │
│  • logging.js: Log stream management                                       │
│  • utils.js: Shared utilities ($, $$, fmtN, fmtMs, clamp, rnd, esc)        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Module Responsibilities

### Simulation Layer

| Module | Responsibility |
|--------|----------------|
| `model.js` | Model architecture config (vocab, hidden, layers, heads), parameter count calculation |
| `training.js` | Training state machine, step advancement, loss/grad computation, timing recompilation |
| `cluster.js` | Canvas rendering: ring topology, loss chart, replica list, model versions |
| `metrics.js` | Status strip, metrics grid rendering |

### Contract Layer

| Module | Responsibility |
|--------|----------------|
| `parser.js` | DSL → parsed representation (name, fields[], diags[]) |
| `compiler.js` | Parsed contract → TypeScript interface + syntax highlighting |
| `validator.js` | Runtime JSON validation against parsed contract |
| `diagnostics.js` | Diagnostic rendering (errors, warnings, ok) |

### Collaboration Layer

| Module | Responsibility |
|--------|----------------|
| `channel.js` | BroadcastChannel wrapper, identity creation, message posting |
| `presence.js` | Peer map, message handling, heartbeat, activity tracking |
| `events.js` | Demo peer spawning, simulated peer actions |

### Inference Layer

| Module | Responsibility |
|--------|----------------|
| `client.js` | Parse request, validate, generate response, log, broadcast |
| `response.js` | Simulated response generation (timings, tokens, text) |

### UI Layer

| Module | Responsibility |
|--------|----------------|
| `main.js` | App initialization, DOM element cache, event listeners, main loop |
| `rendering.js` | Presence rendering, contract recompile UI, full render orchestration |
| `logging.js` | Log line creation, truncation, scroll |
| `utils.js` | DOM helpers, formatting, math utilities |

## Data Flow

```
User Interaction (sliders, buttons, editors)
         │
         ▼
Event Handlers (main.js) → Mutate S (state)
         │
         ├──────────────────┐
         ▼                  ▼
recompileTiming(S)    BroadcastChannel.postMessage({type:"state", patch})
         │                  │
         ▼                  ▼
   Update S.*          Remote tabs receive → applyRemotePatch()
         │                  │
         └──────────────────┘
                  │
                  ▼
         renderAll(S, contract, elements, peers, ME)
                  │
         ┌────────┼────────┐
         ▼        ▼        ▼
   drawRing  drawLoss  renderMetrics
   renderCluster  renderStatusStrip  renderPresence
```

## Collaboration Protocol

**Message Types:**
- `hello` — Initial announcement on tab load
- `presence` — Periodic heartbeat (focus, activity)
- `bye` — Tab close/unload
- `state` — Hyperparameter changes (lr, replicas, batch, seq, accum, strategy)
- `contract` — Contract source edits (debounced 420ms)
- `log` — Log line broadcast for shared log stream

**Channel:** `BroadcastChannel("tfs-lab")`

**Peer Timeout:** 5200ms (removed from peer map if no heartbeat)

## Future Production Architecture (NOT IMPLEMENTED)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TRAINING PLANE                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ TensorFlow / tf.distribute.Strategy                                 │   │
│  │  • MirroredStrategy (multi-GPU, single host)                        │   │
│  │  • MultiWorkerMirroredStrategy (multi-host)                         │   │
│  │  • TPUStrategy (Cloud TPU)                                          │   │
│  │  • ParameterServerStrategy (legacy)                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Model Checkpoint / Export                                           │   │
│  │  • CheckpointManager (step-based)                                   │   │
│  │  • SavedModel export (signatures, concrete functions)               │   │
│  │  • Optimizer state (for resumption)                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ MODEL ARTIFACT (GCS / S3 / local filesystem)                        │   │
│  │  ├── saved_model.pb                                                 │   │
│  │  ├── variables/                                                     │   │
│  │  └── assets/                                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVING PLANE                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ TensorFlow Serving (ModelServer)                                    │   │
│  │  • Model version policy (latest, specific, all)                     │   │
│  │  • Batching (dynamic, max_batch_size, batch_timeout_micros)         │   │
│  │  • gRPC (port 8500) + REST (port 8501)                              │   │
│  │  • Model warmup                                                     │   │
│  │  • Metrics (Prometheus /summary)                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                    ┌───────────────┴───────────────┐                       │
│                    ▼                               ▼                       │
│            ┌───────────────┐               ┌───────────────┐               │
│            │ gRPC Clients  │               │ REST Clients  │               │
│            │ (Predict,     │               │ (POST /v1/    │               │
│            │  StreamPredict)                │  models/...)  │               │
│            └───────────────┘               └───────────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
```

**This production architecture is NOT implemented in this workbench.** The workbench simulates the *developer experience* of such a system.