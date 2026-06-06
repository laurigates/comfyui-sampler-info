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
# Documentation artifacts
##########

# Regenerate docs/picker.png and docs/tooltip.png via the screenshot generator.
# Builds web/dist/ first — it is the served extension (WEB_DIRECTORY) and is
# git-ignored, so the Docker COPY needs it present on disk.
[group: "docs"]
screenshots: build
    docker build -f screenshots/Dockerfile -t comfyui-sampler-info-screenshots .
    docker run --rm -v "$(pwd)/docs:/out" comfyui-sampler-info-screenshots
