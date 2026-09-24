<div align="center">

<img src="assets/logo.svg" alt="AEL Digital Studio" width="120" height="120">

# ⚡ AEL TF-Serving Lab

**Interactive browser-based simulation workbench for distributed Transformer experimentation,
TensorFlow Serving workflows, real-time collaboration, and type-safe inference contracts.**

[![License: MIT](https://img.shields.io/badge/License-MIT-0074FF.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![TensorFlow Serving](https://img.shields.io/badge/TF%20Serving-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](https://www.tensorflow.org/tfx/guide/serving)

[**Live Demo**](https://aymanelmasryael.github.io/tf-serving-lab/) ·
[**Documentation**](docs/) ·
[**Report Bug**](https://github.com/aymanelmasryael/tf-serving-lab/issues)

</div>

---

## 📖 Overview

**AEL TF-Serving Lab** is a dependency-free interactive workbench that simulates
end-to-end transformer training under **Distributed Data Parallelism (DDP)**,
deploys the model via **TensorFlow Serving** semantics, and enforces inference
request contracts through a custom **type-safe DSL** — all with **live multi-user
collaboration** via the BroadcastChannel API.

> This is an **architectural prototype and simulation**. It runs entirely in the
> browser with zero external dependencies.

---

## ✨ Features

### 🧠 Distributed Training Simulation
- **3 All-Reduce strategies**: Ring (NCCL), Tree (NCCL), Flat (Parameter Server)
- Real-time metrics: Loss, Perplexity, Grad Norm, Tokens/sec, Scaling Efficiency
- Straggler detection and LR instability modeling
- Live loss chart with EMA smoothing

### 📜 Type-Safe Contract DSL
- Custom DSL → TypeScript interface generation → Runtime validation
- Decorators: `@min`, `@max`, `@range`, `@pattern`, `@enum`, `@maxItems`
- Optional fields, defaults, array types, live compiler diagnostics

### 🔌 Inference Client
- Contract-validated request/response cycle
- Simulated queue / prefill / decode timings
- Model version routing (canary / stable)
- 400 Bad Request on contract violations

### 👥 Real-Time Collaboration
- BroadcastChannel API for cross-tab sync
- Peer presence, focus indicators, shared state
- Demo peer simulation for single-user testing

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/aymanelmasryael/tf-serving-lab.git
cd tf-serving-lab

# Option 1: Local HTTP server (full collaboration)
python3 -m http.server 8080
# Open http://localhost:8080 in multiple tabs

# Option 2: Direct file open (single-user)
open index.html
```

---

## 🏗️ Architecture

```
Browser UI (index.html)
        │
        ▼
┌───────────────────────────────────────────────┐
│            Application State                  │
│              (src/ui/state.js)                │
└───────────────────────────────────────────────┘
        │
   ┌────┼──────────────┬──────────────┐
   ▼    ▼              ▼              ▼
┌──────────┐  ┌──────────────┐  ┌──────────────┐
│Simulation│  │  Contracts   │  │Collaboration │
│  Layer   │  │    Layer     │  │    Layer     │
├──────────┤  ├──────────────┤  ├──────────────┤
│model.js  │  │parser.js     │  │channel.js    │
│training  │  │compiler.js   │  │presence.js   │
│cluster   │  │validator.js  │  │events.js     │
│metrics   │  │diagnostics.js│  └──────────────┘
└──────────┘  └──────────────┘
   │                 │
   └────────┬────────┘
            ▼
    ┌────────────────┐
    │   Inference    │
    │     Layer      │
    │  (client.js)   │
    └────────────────┘
```

For the full architecture breakdown, see [docs/architecture.md](docs/architecture.md).

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | Module responsibilities, data flow, collaboration protocol |
| [Contract System](docs/contract-system.md) | DSL grammar, decorators, parser, validator, diagnostics |
| [Simulation Model](docs/simulation-model.md) | Formulas for timing, loss, and inference simulation |

---

## 📁 Project Structure

```
tf-serving-lab/
├── index.html
├── README.md
├── LICENSE
├── .gitignore
├── src/
│   ├── ui/             # Main entry, state, rendering, logging
│   ├── simulation/     # Model, training engine, cluster, metrics
│   ├── contracts/      # DSL parser, compiler, validator, diagnostics
│   ├── inference/      # Request handler, response generation
│   └── collaboration/  # BroadcastChannel, presence, demo peers
├── docs/               # Technical documentation
└── assets/             # Logo, preview images
```

---

## 🧪 Experiments to Try

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Set Replicas = 1 → watch loss | Slower throughput |
| 2 | Increase Replicas to 16 | Lower scaling efficiency (comm overhead) |
| 3 | Switch strategy ring → tree | Different all-reduce timing |
| 4 | Set LR to maximum | Loss instability in chart |
| 5 | Click invalid → Validate & Infer | 6 contract violations shown |
| 6 | Open second tab | Peer avatar appears |
| 7 | Click + demo peer | Simulated collaborators with activity |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| UI | HTML5, CSS3 (Grid + Custom Properties), Vanilla JavaScript ES Modules |
| Rendering | Canvas 2D API, requestAnimationFrame |
| Collaboration | BroadcastChannel API |
| Dependencies | **Zero** — no npm packages, no build step |

---

## 🤝 Contributing

Contributions are welcome! Please follow Conventional Commits:

```bash
git checkout -b feature/your-feature
git commit -m "feat(contract): add @email decorator"
git push origin feature/your-feature
```

---

## 📄 License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

---

## 👤 Author

<div align="center">

**Ayman Elmasry**  
Visionary · AI Orchestrator · Brand Designer  
Founder @ **AEL Digital Studio**

📍 Dubai · Egypt · Kuwait

[![Website](https://img.shields.io/badge/Website-aymanelmasry.com-0074FF?style=for-the-badge)](https://www.aymanelmasry.com/)
[![Portfolio](https://img.shields.io/badge/Portfolio-aymanelmasry.me-0074FF?style=for-the-badge)](https://aymanelmasry.me/)
[![Email](https://img.shields.io/badge/Email-info@aymanelmasry.com-0074FF?style=for-the-badge)](mailto:info@aymanelmasry.com)

</div>

<div align="center">

**Made with ⚡ by AEL Digital Studio**

</div>