# comfyui-sampler-info — task runner. Run `just` (or `just --list`)
# for available recipes.

set positional-arguments

# Show available recipes.
default:
    @just --list

##########
# Assets
##########

# Requires rsvg-convert (librsvg): `brew install librsvg` / `apt-get install librsvg2-bin`.
# pyproject [tool.comfy] Icon/Banner point at the raw GitHub PNG URLs, so the
# registry shows a broken image until you rasterize and commit the PNGs.
#
# Rasterize icon.svg + banner.svg to the PNGs the registry serves (commit them).
[group: "assets"]
assets:
    # Placeholder gate: the scaffold ships a letter-initial glyph so the SVGs are
    # valid from commit one, but no pack may PUBLISH it — pyproject already points
    # Icon/Banner at the PNGs this recipe writes, so a forgotten placeholder ships
    # a generic letter tile to registry.comfy.org (nearly happened on
    # comfyui-output-swap). Draw the bespoke pictogram, delete the marker comment.
    grep -q 'PLACEHOLDER-GLYPH' icon.svg banner.svg && { echo "icon.svg/banner.svg still carry the PLACEHOLDER-GLYPH marker — replace the letter glyph with a bespoke pictogram (family spec: #ffb02e line-art on the dark tile) and delete the marker comment before rasterizing."; exit 1; } || true
    rsvg-convert -w 400 -h 400 icon.svg -o icon.png
    rsvg-convert -w 1344 -h 576 banner.svg -o banner.png
    # Consistency gate: the family tile must trim to 346x346+27+27 on a 400x400
    # canvas. A mismatch means the icon drifted off the family spec (wrong
    # canvas size or a full-bleed tile) — see comfy-registry-lifecycle. Skipped
    # when ImageMagick's `identify` is absent (rsvg-convert is the only hard dep).
    command -v identify >/dev/null 2>&1 && { test "$(identify -format '%wx%h/%@' icon.png)" = "400x400/346x346+27+27" || { echo "icon.png off family spec (want 400x400/346x346+27+27)"; exit 1; }; } || true

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
# Builds web/dist/ first so the Docker COPY picks up the current bundle rather
# than whatever was last committed. web/dist/ is generated but git-TRACKED —
# ci.yml runs `git diff --exit-code -- web/dist` and fails when it is stale, so
# it has to be committed alongside any src/ or web/data/ change. This comment
# used to call it git-ignored, which contradicted CLAUDE.md in the same repo.
[group: "docs"]
screenshots: build
    docker build -f screenshots/Dockerfile -t comfyui-sampler-info-screenshots .
    docker run --rm -v "$(pwd)/docs:/out" comfyui-sampler-info-screenshots
