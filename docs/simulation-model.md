# Simulation Model Documentation

## Model Configuration

Fixed GPT-2 small architecture:

| Parameter | Value |
|-----------|-------|
| Vocabulary | 50,257 |
| Hidden size | 768 |
| Layers | 12 |
| Attention heads | 12 |
| Max sequence length | 1,024 |

**Total parameters: ~124.4M**

Calculation:
```
embeddings = vocab × hidden + maxSeq × hidden = 50,257 × 768 + 1,024 × 768 = 38.6M + 0.8M
per_layer = 12 × hidden² + 13 × hidden = 12 × 768² + 13 × 768 = 7.1M + 10K
total = embeddings + layers × per_layer + 2 × hidden
      = 39.4M + 12 × 7.1M + 1.5K ≈ 124.4M
```

## Training Simulation

### State Variables

| Variable | Initial | Description |
|----------|---------|-------------|
| `step` | 0 | Current training step |
| `maxSteps` | 6,000 | Total steps to run |
| `running` | false | Training active flag |
| `phase` | "idle" | "compute" \| "allreduce" \| "update" |
| `phaseP` | 0 | Phase progress [0,1] |
| `phaseT` | 0 | Phase time accumulator (ms) |

### Hyperparameters (User-Controlled)

| Variable | Range | Default | Description |
|----------|-------|---------|-------------|
| `replicas` | 1–16 | 4 | Data-parallel ranks |
| `batch` | 1–64 | 16 | Micro-batch per replica |
| `seq` | 128–2048 (×128) | 512 | Sequence length |
| `lr` | 1e-5–1e-1 (log) | 3e-4 | Learning rate |
| `accum` | 1–8 | 1 | Gradient accumulation steps |
| `strategy` | ring/tree/flat | ring | All-reduce algorithm |

**Derived:**
- `globalBatch = batch × replicas × accum`
- `tokensPerStep = globalBatch × seq`

### Timing Model (`recompileTiming`)

```javascript
// Compute time (ms)
tokensPerReplica = batch × seq / accum
flops = 6 × PARAMS × tokensPerReplica
computeMs = (flops / 312e12) × 1000 × 2.6

// Communication time (ms)
gradBytes = PARAMS × 2 × 1.02  // bfloat16 + 2% overhead
bw = 90e9  // 90 GB/s (NVLink/H100 approx)

factor = strategy === "ring" ? 2 × (N-1)/N
       : strategy === "tree" ? max(0.25, log2(max(2,N))/N × 2.2)
       : (N-1)/N × 1.35

commMs = N > 1 ? (gradBytes × factor) / bw × 1000 : 0

// Total step time
lastStepMs = computeMs + commMs + 2.4  // 2.4ms optimizer overhead

// Throughput
tps = (globalBatch × seq) / (lastStepMs / 1000)
```

**Assumptions:**
- 312 TFLOPs theoretical (H100 FP16)
- 2.6× utilization factor (real-world efficiency)
- 90 GB/s inter-GPU bandwidth
- bfloat16 gradients (2 bytes/param) + 2% bucket overhead
- Ring: 2(N-1)/N bandwidth factor (standard)
- Tree: log2(N)/N × 2.2 (hierarchical reduction overhead)
- Flat: (N-1)/N × 1.35 (parameter server fan-in/out)

### Phase Simulation (`advance`)

```
phaseT += dt
if phaseT >= lastStepMs:
    phaseT = phaseT % lastStepMs
    completeStep()

phaseP = phaseT / lastStepMs

phase = phaseP < 0.55     ? "compute"
      : phaseP < 0.86     ? "allreduce"
      :                   "update"
```

Phase durations:
- Compute: 55% of step
- All-reduce: 31% of step
- Update: 14% of step

### Step Completion (`completeStep`)

```javascript
lrFactor = lr / 3e-4
decay = 900 / lrFactor^0.85

base = 1.42 + 8.6 × exp(-step / decay)

// LR instability: extra oscillation when lr > 3.6 × base_lr
if lrFactor > 3.6:
    base += (lrFactor - 3.6) × 0.55 × (1 + sin(step / 7))

noiseAmp = 0.055 × sqrt(lrFactor)
loss = max(0.4, base + random(-noiseAmp, noiseAmp))

smoothLoss = smoothLoss × 0.85 + loss × 0.15  // EMA α=0.15
gradNorm = max(0.05, 1.15 × exp(-step/1400) + random(-0.08, 0.08))

history.push({ step, loss })
if history.length > 320: shift()

// Per-replica stats
for i in 0..N-1:
    straggler = (i === N-1 && N > 2 && step % 17 < 4)
    replicaStats[i] = {
        rank: i,
        loss: loss + random(-0.045, 0.045) + (straggler ? 0.09 : 0),
        gradNorm: gradNorm × random(0.9, 1.1),
        util: clamp(random(88,99) - (straggler ? 22 : 0), 40, 99.5),
        straggler
    }
```

**Key Behaviors:**
- Loss decays exponentially with LR-dependent time constant
- High LR (>1.08e-3) adds oscillatory instability term
- Noise amplitude scales with √LR
- Grad norm decays exponentially from 1.15
- Last replica straggles periodically (steps % 17 < 4)
- Stragglers: +0.09 loss, -22% utilization

### Logging (Automatic)

| Interval | Log |
|----------|-----|
| Every 20 steps | `step X · loss Y · gn Z · Tms/step · K tok/s` |
| Every 25 steps (if LR high) | `loss instability detected — LR exceeds stable band` |
| Every 250 steps | `checkpoint written to gs://ael/ckpt/step-X (124M params)` |
| At maxSteps | `run complete at step X · final loss Y` |

## Inference Simulation

### Request Processing

```javascript
promptTokens = max(1, round(prompt.length / 4))
maxTok = max_tokens || 128

queue = random(1.2, 6.5) × (running ? 2.4 : 1)
prefill = 6 + promptTokens × 0.34 × (stream ? 1 : 1.15)
decode = maxTok × random(0.72, 1.05) × (replicas > 8 ? 1.18 : 1)
total = queue + prefill + decode
```

### Response Object

```json
{
  "model": "ael/transformer-lm",
  "version": "v3-canary" | "v2",
  "contract": "GenerationRequest ✓ validated",
  "generated_text": "<truncated canned text>",
  "usage": { "prompt_tokens": N, "completion_tokens": M },
  "timings_ms": {
    "queue": 2.34,
    "prefill": 45.67,
    "decode": 123.45,
    "total": 171.46
  },
  "sampling": { "temperature": 0.9, "top_k": 40, "top_p": 0.95 }
}
```

**Assumptions:**
- 4 chars ≈ 1 token (rough GPT-2 estimate)
- Prefill: ~0.34ms/token (varies with stream mode)
- Decode: ~0.72-1.05ms/token (slower with more replicas)
- Queue delay higher when training active (contention)
- Canned text truncated to ~2×max_tokens chars

## Scaling Efficiency

```javascript
eff = computeMs / (computeMs + commMs) × 100
idealTps = tps / (eff / 100)
```

- 100% = compute-bound (ideal)
- <55% = communication-bound (highlighted red)
- 55-80% = balanced (yellow)
- >80% = compute-dominated (green)

## Visualization

### Ring Topology Canvas
- N nodes on circle radius 32% of min(w,h)
- Core shows "NCCL" or "PS" with pulsing gradient during allreduce
- Animated gradient particles flow along edges during allreduce
- Nodes pulse during compute phase
- Straggler nodes highlighted yellow

### Loss Chart Canvas
- Raw loss: thin blue line (38% opacity)
- EMA loss: bold blue line with glow shadow (α=0.12)
- Y-axis auto-scales with 12% padding
- Minimum 0.6 range
- Current point highlighted

## Metrics Computed

| Metric | Formula |
|--------|---------|
| Perplexity | exp(min(20, smoothLoss)) |
| Tokens seen | step × globalBatch × seq |
| ETA | (maxSteps - step) × lastStepMs / 1000 |
| Scaling efficiency | computeMs / (computeMs + commMs) × 100 |
| Ideal TPS | tps / (efficiency / 100) |

## Limitations & Approximations

| Aspect | Simulation | Reality |
|--------|------------|---------|
| Compute | Analytical FLOP model | Kernel-level, memory-bound |
| Communication | Bandwidth-only model | Latency, topology, congestion |
| Loss curve | Parametric decay + noise | Data-dependent, architecture-specific |
| Stragglers | Deterministic periodic | Hardware, OS, network variance |
| LR instability | Sinusoidal perturbation | Divergence, gradient explosion |
| Inference | Fixed formulas | KV-cache, batching, speculative decode |
| Model | Fixed 124M GPT-2 | Arbitrary architectures |

**These are qualitative approximations for architectural exploration only. Do not use for capacity planning or performance prediction.**