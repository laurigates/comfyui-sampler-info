# comfyui-sampler-info — task runner. Run `just` (or `just --list`)
# for available recipes.

set positional-arguments

# Show available recipes.
default:
    @just --list

##########
# Documentation artifacts
##########

# Regenerate docs/picker.png and docs/tooltip.png via the screenshot generator.
[group: "docs"]
screenshots:
    docker build -f screenshots/Dockerfile -t comfyui-sampler-info-screenshots .
    docker run --rm -v "$(pwd)/docs:/out" comfyui-sampler-info-screenshots
