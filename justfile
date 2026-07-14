# comfyui-sampler-info — task runner. Run `just` (or `just --list`)
# for available recipes.

set positional-arguments

# Show available recipes.
default:
    @just --list

##########
# Build
##########

# Compile the TypeScript source to web/dist/ (ESM) and copy the corpus.
# See ADR-0010.
[group: "build"]
build:
    bun run build

# Typecheck the TypeScript source without emitting.
[group: "build"]
typecheck:
    bun run typecheck

##########
# Corpus
##########

# Verify the corpus against ComfyUI ground truth: coverage gaps, vendor-default
# recipes, and the measured behaviour of every scheduler that prose claims
# something about. See .claude/rules/corpus-ground-truth.md.
#
# The probe half must run where ComfyUI lives (it needs torch + the shipped
# workflow templates + a live /object_info), so this pipes it over SSH to the
# GPU host and feeds its JSON to the stdlib-only local check. CI has neither a
# ComfyUI nor a GPU, so this is a maintainer tool, not a CI gate — a deliberate
# local/CI-parity deviation. The offline half of the contract (schema, cross-
# references, the subgraph parser) IS in pytest and does run in CI.
[group: "corpus"]
corpus-check host=env("COMFY_SSH_HOST", "popos.intra.lakuz.com") comfy_root=env("COMFY_ROOT", "/mnt/sabrent/comfyui-workspace/ComfyUI"):
    mkdir -p tmp
    ssh {{host}} '{{comfy_root}}/.venv/bin/python - --comfy-root {{comfy_root}}' < scripts/corpus_probe.py > tmp/ground-truth.json
    uv run python scripts/corpus_check.py tmp/ground-truth.json

##########
# Documentation artifacts
##########

# Regenerate docs/picker.png and docs/tooltip.png via the screenshot generator.
# Builds web/dist/ first — it is the served extension (WEB_DIRECTORY) and is
# git-ignored, so the Docker COPY needs it present on disk.
[group: "docs"]
screenshots: build
    docker build -f screenshots/Dockerfile -t comfyui-sampler-info-screenshots .
    docker run --rm -v "$(pwd)/docs:/out" comfyui-sampler-info-screenshots
