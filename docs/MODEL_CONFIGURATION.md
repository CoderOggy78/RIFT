# RIFT Model Configuration & Local Gemma Setup

> *Between what agents intend and what they do.*

RIFT relies exclusively on local inference powered by **Google's open-weight Gemma models** via [Ollama](https://ollama.ai). No cloud API keys, credit cards, or proprietary cloud LLMs are required.

---

## 1. Supported Gemma Models

RIFT supports all instruction-tuned variants of Google Gemma:

| Model ID | Architecture | Parameter Count | Context Window | Recommended Hardware | Primary Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`gemma2:9b`** *(Default)* | Gemma 2 Instruction | 9 Billion | 8,192 tokens | 16 GB+ RAM / Apple Silicon (M1/M2/M3) / 8 GB+ VRAM | **Recommended**: Deep causal reasoning, complex multi-step trace synthesis, nuanced remediation. |
| **`gemma2:2b`** | Gemma 2 Instruction | 2.6 Billion | 8,192 tokens | 8 GB RAM / Low-power laptops / CI test runners | Fast local execution, automated regression pipelines, low-memory environments. |
| **`gemma:7b`** | Gemma 1 Instruction | 8.5 Billion | 8,192 tokens | 16 GB RAM / 8 GB VRAM | Legacy Gemma 1 compatibility and benchmarking. |

---

## 2. Configuration Environment Variables

Configure model parameters in `/Users/oggy/RIFT/.env` or export them in your shell:

```env
# ==============================================================================
# RIFT GEMMA AI INFERENCE CONFIGURATION
# ==============================================================================

# Target Gemma model tag (must match an Ollama model tag)
GEMMA_MODEL=gemma2:9b

# Ollama local daemon endpoint
OLLAMA_BASE_URL=http://localhost:11434

# Inference timeout in seconds (prevents hanging investigation jobs)
GEMMA_TIMEOUT_SECONDS=120

# Maximum token budget for sliding-window trace context
GEMMA_MAX_CONTEXT_TOKENS=8192

# Sampling temperature (0.0 - 0.2 recommended for deterministic investigation)
GEMMA_TEMPERATURE=0.1

# Nucleus sampling parameter
GEMMA_TOP_P=0.9

# Active system prompt version for reproducibility and audit logging
GEMMA_PROMPT_VERSION=v1.0.0
```

---

## 3. Step-by-Step Local Setup with Ollama

### Step 1: Install Ollama
Download and install Ollama from [ollama.ai](https://ollama.ai):
- **macOS**: `brew install ollama` or download the native macOS app.
- **Linux**: `curl -fsSL https://ollama.com/install.sh | sh`
- **Windows**: Download the Windows preview installer from [ollama.com](https://ollama.com).

### Step 2: Start the Ollama Service
Ensure the Ollama daemon is running locally on port 11434:

```bash
# In a terminal session or background service
ollama serve
```

Verify that the daemon is listening:
```bash
curl http://localhost:11434/api/tags
# Expected: {"models": [...]}
```

### Step 3: Pull the Recommended Gemma Model
Download Google's official `gemma2:9b` weights:

```bash
ollama pull gemma2:9b
```

*(Alternatively, for low-memory environments, pull `ollama pull gemma2:2b`)*

Verify the downloaded model:
```bash
ollama list
# Output should list:
# NAME            ID              SIZE      MODIFIED
# gemma2:9b       c1707d76b7e3    5.4 GB    ...
```

---

## 4. Verifying Model Connectivity in RIFT

### Option A: Using the RIFT Web UI
1. Navigate to `http://localhost:5173/settings`.
2. Locate the **"Local Gemma AI Model"** section.
3. Click **"Test Gemma Connection"**.
4. The dashboard will query `POST /api/models/test` and display:
   - Real-time connection status (`ready` or diagnostic code)
   - Measured round-trip ping latency (ms)
   - Configured model tag and context window size
   - Actionable terminal instructions if the daemon is offline

### Option B: Using the Backend REST API
Query the health check endpoint:

```bash
curl -X GET http://localhost:8000/api/models/status
```

Response when Ollama is running and model is loaded:
```json
{
  "status": "ready",
  "model_name": "gemma2:9b",
  "base_url": "http://localhost:11434",
  "context_length": 8192,
  "parameter_size": "9B",
  "prompt_version": "v1.0.0",
  "setup_instructions": null
}
```

Response when Ollama is offline:
```json
{
  "status": "ollama_unavailable",
  "model_name": "gemma2:9b",
  "base_url": "http://localhost:11434",
  "context_length": 8192,
  "parameter_size": "9B",
  "prompt_version": "v1.0.0",
  "setup_instructions": "1. Install Ollama: https://ollama.ai\n2. Start Ollama: ollama serve\n3. Pull model: ollama pull gemma2:9b"
}
```

---

## 5. Hardware Acceleration & Performance Tuning

- **macOS (Apple Silicon)**: Ollama automatically leverages Apple Metal and unified memory. Inference for `gemma2:9b` achieves ~30–45 tokens/second on M1/M2/M3 Pro/Max chips.
- **Linux / Windows (NVIDIA CUDA)**: Ollama automatically detects CUDA compute devices. An NVIDIA RTX 3060 (12GB) or higher runs `gemma2:9b` at ~40–60 tokens/second.
- **CPU Inference**: If no GPU is available, Ollama falls back to AVX2/AVX-512 CPU instructions. For CPU-only environments, `gemma2:2b` is strongly recommended for sub-10 second turnaround.
