# AEL TF-Serving Lab

**Interactive browser-based simulation workbench for distributed Transformer experimentation, TensorFlow Serving workflows, real-time collaboration, and type-safe inference contracts.**

![License: MIT](https://img.shields.io/badge/License-MIT-0074FF.svg)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![TensorFlow Serving](https://img.shields.io/badge/TF%20Serving-FF6F00?logo=tensorflow&logoColor=white)

---

## Project Overview

**AEL TF-Serving Lab** is an **interactive, dependency-free** workbench that simulates end-to-end transformer training under distributed data parallelism, deploys the model via TensorFlow Serving semantics, and enforces inference request contracts through a custom type-safe DSL — all with live multi-user collaboration.

This is an **architectural prototype and simulation**. It runs entirely in the browser with zero external dependencies. No real TensorFlow, no real GPU computation, no actual distributed training cluster. Everything is simulated with mathematically grounded approximations.

---

## Core Capabilities

### Distributed Training Simulation (IMPLEMENTED / SIMULATED)
- **Three All-Reduce strategies**: Ring (NCCL), Tree (NCCL), Flat (Parameter Server)
- **Real-time metrics**: Loss, Perplexity, Gradient Norm, Tokens/sec, Scaling Efficiency
- **Straggler detection**: Simulates slow replicas and their impact on step time
- **Learning-rate instability**: Loss curve diverges when LR exceeds stable band
- **Gradient accumulation**: Multi-step gradient accumulation before optimizer update
- **Live loss chart**: Real-time loss visualization with EMA smoothing

### Interactive Control Panel (IMPLEMENTED)
| Control | Range | Impact |
|---------|-------|--------|
| Replicas | 1→16 | Number of parallel DDP ranks |
| Batch / replica | 1→64 | Micro-batch size per rank |
| Seq length | 128→2048 | Transformer context window |
| Learning rate | 1e-5→1e-1 (log) | Optimizer step size |
| Grad accumulation | 1→8 | Steps before weight update |

### Type-Safe Contract DSL (IMPLEMENTED)
- Custom DSL for defining inference request contracts
- Parser → TypeScript interface generation → Runtime validation
- Decorators: `@min`, `@max`, `@range`, `@pattern`, `@enum`, `@maxItems`
- Optional fields with defaults (`?`, `= default`)
- Array types (`string[]`, `int[]`, etc.)
- Live compiler diagnostics with line numbers

### Inference Simulation (IMPLEMENTED / SIMULATED)
- Contract-validated request/response cycle
- Simulated queue, prefill, decode timings
- Model version routing (canary/stable)
- Token usage reporting
- 400 Bad Request on contract violations

### Real-Time Collaboration (IMPLEMENTED)
- **BroadcastChannel** API for cross-tab communication
- Peer presence with avatars and focus indicators
- Shared state: contract edits, hyperparameter changes, logs
- Demo peer simulation for single-user testing

### TensorFlow Serving Semantics (SIMULATED)
- Model version traffic splitting (v1/v2/v3-canary)
- gRPC :8500 / REST :8501 endpoints (simulated)
- Request contract validation at serving boundary

---

## Architecture

```
Browser UI (index.html)
    ↓
Application State (src/ui/state.js)
    ↓
┌─────────────────────────────────────────────────────────┐
│                    Simulation Layer                      │
│  ├─ Cluster Topology (src/simulation/cluster.js)        │
│  ├─ Training Engine (src/simulation/training.js)        │
│  ├─ Metrics (src/simulation/metrics.js)                 │
│  └─ Model Config (src/simulation/model.js)              │
├─────────────────────────────────────────────────────────┤
│                    Contract Layer                        │
│  ├─ Parser (src/contracts/parser.js)                    │
│  ├─ Compiler (src/contracts/compiler.js)                │
│  ├─ Validator (src/contracts/validator.js)              │
│  └─ Diagnostics (src/contracts/diagnostics.js)          │
├─────────────────────────────────────────────────────────┤
│                    Inference Layer                       │
│  ├─ Client (src/inference/client.js)                    │
│  └─ Response (src/inference/response.js)                │
├─────────────────────────────────────────────────────────┤
│                   Collaboration Layer                    │
│  ├─ Channel (src/collaboration/channel.js)              │
│  ├─ Presence (src/collaboration/presence.js)            │
│  └─ Events (src/collaboration/events.js)                │
└─────────────────────────────────────────────────────────┘
    ↓
UI Rendering (src/ui/rendering.js, src/ui/logging.js, src/ui/main.js)
```

---

## Simulation Model

The simulation uses mathematically grounded approximations:

| Component | Formula |
|-----------|---------|
| **Model Params** | `vocab×hidden + maxSeq×hidden + layers×(12×hidden²+13×hidden) + 2×hidden` ≈ 124M |
| **Compute/step** | `6 × PARAMS × tokens_per_replica / (312 TFLOPs) × 2.6` |
| **All-Reduce (Ring)** | `2 × (N-1)/N × grad_bytes / 90 GB/s` |
| **All-Reduce (Tree)** | `log₂(N)/N × 2.2 × grad_bytes / 90 GB/s` |
| **All-Reduce (Flat)** | `(N-1)/N × 1.35 × grad_bytes / 90 GB/s` |
| **Loss decay** | `1.42 + 8.6 × exp(-step / (900 / LR_factor^0.85))` |
| **LR instability** | Extra noise when `LR > 3.6 × 3e-4` |

**These are simulations, not real measurements.** They approximate the *qualitative behavior* of distributed training for educational and architectural exploration purposes.

---

## Contract System

The contract pipeline:

```
Contract DSL Source
       ↓
   Parser
       ↓
Parsed Representation (name, fields[], diags[])
       ↓
TypeScript Generator → Interface Definition
       ↓
Runtime Validator → Diagnostics (errors/warnings)
       ↓
Inference Request → Validated Payload → Simulated Response
```

**Supported types**: `string`, `int`, `float`, `bool`, `any`, `json`, arrays (`[]`), optional (`?`), defaults (`= value`)

**Supported decorators**: `@min(n)`, `@max(n)`, `@range(min,max)`, `@pattern(regex)`, `@enum(v1,v2,...)`, `@maxItems(n)`

---

## Collaboration Model

```
Tab A ──┐
        ├── BroadcastChannel "tfs-lab" ──→ Peer Discovery
Tab B ──┘         │
                  ├── Presence (name, color, focus, activity)
                  ├── State Sync (hyperparameters, contract)
                  └── Log Broadcast
```

- Zero-configuration, works on `localhost` and `file://` (with browser flags)
- Peer timeout: 5.2 seconds
- Heartbeat interval: 1.6 seconds

---

## Inference Workflow

1. **Write Contract** in DSL editor (top-right panel)
2. **Compile** → Auto-generates TypeScript interface + diagnostics
3. **Write Request** in JSON (bottom-right panel) or load sample (valid/invalid)
4. **Validate & Infer** → Runtime validation against contract
5. **Response** → Simulated TF Serving response with timings

---

## Running Locally

### Option 1: Direct file open (limited collaboration)
```bash
# Open index.html directly in browser
# Note: BroadcastChannel requires HTTP/HTTPS, not file://
# Collaboration will not work in this mode
open index.html
```

### Option 2: Local HTTP server (full collaboration)
```bash
# Python 3
python3 -m http.server 8080

# Node.js (npx)
npx serve .

# PHP
php -S localhost:8080
```
Then open `http://localhost:8080` in multiple tabs to test collaboration.

---

## Project Structure

```
tf-serving-lab/
├── index.html                    # Entry point
├── README.md                     # This file
├── .gitignore
├── src/
│   ├── ui/
│   │   ├── styles.css           # All styles (extracted from original)
│   │   ├── main.js              # Application bootstrap
│   │   ├── state.js             # State management
│   │   ├── rendering.js         # DOM rendering
│   │   ├── logging.js           # Log stream
│   │   └── utils.js             # Shared utilities
│   ├── simulation/
│   │   ├── model.js             # Model configuration & param count
│   │   ├── training.js          # Training engine & state
│   │   ├── cluster.js           # Cluster topology rendering
│   │   └── metrics.js           # Metrics & status strip
│   ├── contracts/
│   │   ├── parser.js            # DSL parser
│   │   ├── compiler.js          # TypeScript generator + highlighter
│   │   ├── validator.js         # Runtime validator
│   │   └── diagnostics.js       # Diagnostic rendering
│   ├── inference/
│   │   ├── client.js            # Inference request handler
│   │   └── response.js          # Response generation
│   └── collaboration/
│       ├── channel.js           # BroadcastChannel wrapper
│       ├── presence.js          # Peer presence management
│       └── events.js            # Demo peer simulation
├── docs/
│   ├── architecture.md          # Architecture documentation
│   ├── contract-system.md       # Contract DSL documentation
│   └── simulation-model.md      # Simulation formulas documentation
└── assets/
    └── screenshots/             # Screenshots (add manually)
```

---

## Current Limitations

| Limitation | Description |
|------------|-------------|
| **No real TensorFlow** | All computation is simulated in JavaScript |
| **No real GPU** | FLOP calculations are approximations |
| **No real distributed cluster** | Single-threaded simulation with timing models |
| **No model checkpointing** | State is in-memory only |
| **BroadcastChannel only** | No WebRTC/WebSocket fallback for cross-origin |
| **Single model** | Fixed GPT-2 small architecture (124M params) |
| **No authentication** | Collaboration is open to any tab on same origin |

---

## Future Architecture (NOT IMPLEMENTED)

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRAINING PLANE                           │
│  TensorFlow / tf.distribute.Strategy (MirroredStrategy, TPUStrategy) │
│                           ↓                                     │
│              Model Checkpoint / Export (SavedModel)             │
│                           ↓                                     │
│                      MODEL ARTIFACT                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        SERVING PLANE                            │
│  TensorFlow Serving (ModelServer, gRPC/REST, batching, versioning) │
│                           ↓                                     │
│                     REST :8501  /  gRPC :8500                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Inference Clients (this workbench)
```

**This production backend is NOT currently implemented.** The workbench simulates the *interface* and *workflow* of such a system.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Author

**Ayman Elmasry** — Founder, AEL Digital Studio  
🌐 [www.aymanelmasry.com](https://www.aymanelmasry.com/) · 📧 [info@aymanelmasry.com](mailto:info@aymanelmasry.com) · 🔗 [aymanelmasry.me](https://aymanelmasry.me/)

*Dubai · Egypt · Kuwait*