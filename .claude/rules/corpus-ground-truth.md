---
paths:
  - "web/data/**/*.json"
  - "scripts/**"
---

# Corpus Facts Come From Ground Truth, Not From Memory

The corpus (`web/data/*.json`) is the pack. Its whole credibility rests on the
facts in it being right — and the rule "don't extend the corpus with information
you're not sure about" (CLAUDE.md) had **no mechanism** behind it until now.
Three factual misses shipped or nearly shipped in one day: a sampler
recommendation taken from a top-ranked blog that the shipped ComfyUI template
contradicts, a claim about what `beta57` *does* that computing the schedule
falsified, and a model missing from the corpus entirely because nothing ever
asked what the install offers.

## Before editing the corpus

1. **Invoke the `comfyui-plugin:comfy-corpus-validation` skill.** It carries the
   source-of-truth ladder, the three protocols, and the two parsing traps.
2. **Run `just corpus-check`.** It probes a live ComfyUI host and reports
   coverage gaps, re-verifies every vendor-default recipe against the template
   it cites, and prints the *measured* step allocation beside any prose that
   claims one.

## The one rule to remember

> **A claim about ComfyUI is only as good as the highest rung you verified it
> on. Never write a Tier-3 claim (blog, tutorial, Civitai, model memory) that a
> Tier-1/2 source could settle but didn't.**

Tier 1 is executable: `/object_info`, `comfy/samplers.py`, the custom-node
source, and *computing the sigma curve*. Tier 2 is what the vendor actually
ships: the workflow template's KSampler widget values **are** the vendor's
default recipe. When two secondary sources disagree, resolve at Tier 1/2 or
write nothing — never pick the better-ranked blog.

Anything you cannot settle that way is still allowed in the corpus, but it must
say so: `source.kind` ∈ `vendor-default` | `vendor-doc` | `pack-provided` |
`community` | `empirical` | `paper`. An honest `community` label is worth more
than a confident-sounding sentence with no provenance.
