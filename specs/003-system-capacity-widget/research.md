# Research: System Capacity Widget

## 1. Where hardware detection runs

**Decision**: Detect CPU, GPU, and memory on the **backend** (Python), exposed via a new
`GET /api/system/capacity` endpoint. The frontend fetches it once per page load, the same
pattern `sourcesApi.ts` already uses for `GET /api/sources`.

**Rationale**: Browsers deliberately limit hardware fingerprinting — `navigator.hardwareConcurrency`
gives a logical core count at best, and there is no standard, unmasked way to read a CPU model
name, RAM size, or GPU model from JavaScript. The project's backend is already a Python process
running on (or with visibility into) the same host the user runs RAG on, per the constitution's
Fixed Technology Stack (Principle IV), so it is the natural and only reliable place to source this
data. This also matches the existing `sources` module's request/response shape, keeping the
addition consistent with the codebase.

**Alternatives considered**:
- Browser-only detection (`navigator.hardwareConcurrency`, WebGPU adapter info): rejected — core
  count only, no RAM, no real GPU name, and WebGPU adapter info is often masked for privacy.
- A separate native helper process/binary: rejected — unnecessary complexity (violates Principle
  III, YAGNI) when the existing FastAPI backend can do this directly.

## 2. CPU and memory detection

**Decision**: Add `psutil` as a new backend dependency for cross-platform CPU core count and
total memory (`psutil.virtual_memory().total`). Use Python's stdlib `platform` module
(`platform.processor()` / `platform.uname()`) for a best-effort processor name string, since a
human-readable model name (e.g., "Apple M2 Pro") is not reliably available cross-platform without
shelling out to OS-specific tools.

**Rationale**: `psutil` is a small, actively maintained, pure-C-extension library with wheels for
macOS/Linux/Windows — no compiler toolchain needed at install time — and is the de facto standard
for this exact task in the Python ecosystem. It keeps `pyproject.toml` additions to one line,
consistent with Principle III (minimal footprint) and Principle IV (doesn't change the framework,
language, vector DB, or containerization approach — just adds one introspection library, same
category as `python-multipart` added in 002).

**Alternatives considered**:
- `py-cpuinfo`: richer CPU name/flags but heavier and slower on first call; unnecessary for a
  name + core count display.
- Shelling out per-OS (`system_profiler` on macOS, `wmic` on Windows, `/proc/cpuinfo` on Linux)
  for every field: rejected as the primary mechanism — fragile, OS-branchy, and duplicates what
  `psutil` already normalizes. (Still used narrowly for GPU — see below — where no cross-platform
  library exists.)

## 3. GPU detection

**Decision**: Best-effort NVIDIA GPU detection by shelling out to `nvidia-smi --query-gpu=name
--format=csv,noheader` with a short timeout, when the binary is present on `PATH`. If the binary
is absent, the call fails, times out, or returns no output, treat the machine as having **no
dedicated GPU** — this is not an error state, it's the expected majority case (per FR-003 and the
spec's Assumptions).

**Rationale**: There is no single cross-platform Python library that reliably reports a real GPU
model name for NVIDIA, Apple Silicon, and integrated GPUs alike without adding a heavy or
platform-specific dependency. `nvidia-smi` covers the case that actually matters for this
feature's purpose — a *dedicated* GPU usable for local embedding acceleration — and is already
installed wherever NVIDIA GPU passthrough is configured. Apple Silicon's integrated GPU and
generic integrated graphics are intentionally **not** reported as a "dedicated GPU": they don't
change the capacity math the same way a discrete NVIDIA card does, and mis-reporting them as a
capacity boost would overstate what the machine can do. This also means: when the backend runs in
the project's default `docker-compose.yml` (no GPU passthrough configured), the widget will
correctly show "no dedicated GPU detected" for virtually all users out of the box — matching the
edge case already called out in the spec, not a bug to fix later.

**Alternatives considered**:
- `pynvml` / `GPUtil`: both are thin wrappers around the same NVIDIA driver calls `nvidia-smi`
  exposes; adding a dependency buys nothing over a subprocess call and `GPUtil` is effectively
  unmaintained.
- Attempting AMD/Intel GPU detection too: rejected for this iteration — no dedicated-GPU-relevant
  local embedding acceleration path exists for those in this project yet (no strategy plugged in
  that would use it), so detecting them adds complexity without changing what the user can
  currently do. Can be added later without changing the API contract if a strategy that uses them
  is introduced.

## 4. Capacity estimate formula

**Decision**: Compute two independent figures — **max PDF count** and **max total size (GB)** —
from a single 0–1 "capacity score" that weights the three detected signals:

```
capacity_score = (0.6 × ram_component) + (0.25 × cpu_component) + (0.15 × gpu_component)

ram_component = min(total_ram_gb / RAM_REFERENCE_GB, 1.0)      # RAM_REFERENCE_GB = 32
cpu_component = min(logical_cores / CPU_REFERENCE_CORES, 1.0)  # CPU_REFERENCE_CORES = 16
gpu_component = 1.0 if dedicated GPU detected else 0.0

max_pdf_count      = round(BASE_PDF_COUNT × max(capacity_score, MIN_SCORE))       # BASE_PDF_COUNT = 300
max_total_size_gb  = round(BASE_SIZE_GB × max(capacity_score, MIN_SCORE), 1)      # BASE_SIZE_GB = 6.0
```

`MIN_SCORE` (e.g., `0.1`) puts a floor under the estimate so a very low-resource machine still
gets a small, non-zero, non-alarming figure rather than `0` (per the spec's edge case: "the
estimate still renders... rather than failing or showing a negative/zero value without
explanation").

**Rationale**: RAM dominates the weighting (60%) because it is what actually bounds how much can
be chunked, embedded, and held in a local vector index at once during the full pipeline (FR-006);
CPU cores affect throughput more than ceiling (25%); a dedicated GPU is a meaningful but
secondary accelerant for embedding specifically, not the sole determinant (15%) — this matches
clarification Q2 ("weighted combination... rather than one factor dominating"). Reference
constants (`32 GB` / `16 cores`) are chosen as a reasonable "high-end consumer workstation"
ceiling so the score spans a usable 0–1 range across the realistic hardware this single-user local
tool runs on, per Principle III. All constants are named, in one place (`capacity estimate`
service module), and unit-testable — satisfying FR-010 (lower-resource machine → visibly lower
estimate) directly, since the formula is monotonic in each input.

**Alternatives considered**:
- A lookup table of hardware "tiers" (e.g., "low/medium/high" → fixed numbers): rejected — coarser
  than a continuous formula, and doesn't satisfy FR-010's requirement that estimates be visibly
  different across a range of real hardware, not just three buckets.
- Modeling actual embedding-model memory costs (vector dimensions, chunk size, index type):
  rejected for this feature — no embedding model or chunk strategy is chosen yet anywhere in the
  product (per spec Assumptions, Principle I pluggability), so a precise model-based estimate
  would be false precision. The chosen formula is explicitly an order-of-magnitude heuristic,
  consistent with FR-007's "labeled as an estimate" requirement.

## 5. Refresh behavior

**Decision**: Compute fresh on every `GET /api/system/capacity` call; no caching, no persistence,
no background job. The frontend calls it once when the Data Sources screen mounts.

**Rationale**: Matches the "static snapshot" clarification (not tracking uploads) — hardware
doesn't change mid-session for this single-user local tool, so per-mount computation is simple,
correct, and avoids adding a cache-invalidation concern for a sub-second computation (Principle
III, YAGNI).

**Alternatives considered**: Caching the result in memory for the process lifetime — rejected as
unnecessary complexity; the detection calls are cheap enough (`psutil` calls, one subprocess) that
caching has no measurable benefit here.
