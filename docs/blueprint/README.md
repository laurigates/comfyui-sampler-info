# Blueprint

Blueprint development structure for **comfyui-sampler-info**.

## Layout

```
docs/
├── blueprint/
│   ├── manifest.json        # Version tracking and configuration
│   ├── work-orders/         # Task packages for subagents
│   │   ├── completed/
│   │   └── archived/
│   ├── ai_docs/             # Curated documentation (on-demand)
│   │   ├── libraries/
│   │   └── project/
│   └── README.md            # This file
├── prds/                    # Product Requirements Documents
├── adrs/                    # Architecture Decision Records
└── prps/                    # Product Requirement Prompts

.claude/
├── rules/                   # Modular rules (development, testing, document-management)
└── skills/                  # Custom skill overrides
```

## Commands

| Command | Description |
|---------|-------------|
| `/blueprint:status` | Check version and configuration |
| `/blueprint:upgrade` | Upgrade to latest format version |
| `/blueprint:derive-prd` | Derive PRD from existing documentation |
| `/blueprint:derive-adr` | Derive ADRs from codebase analysis |
| `/blueprint:derive-plans` | Derive docs from git history |
| `/blueprint:derive-rules` | Derive rules from git commit decisions |
| `/blueprint:prp-create` | Create a Product Requirement Prompt |
| `/blueprint:generate-rules` | Generate rules from PRDs |
| `/blueprint:sync` | Check for stale generated content |
| `/blueprint:promote` | Move generated content to custom layer |
| `/blueprint:claude-md` | Update CLAUDE.md |

## Document Types

- **PRD** (`docs/prds/`) — Product Requirements Documents. Describe *what* to build and *why*.
- **ADR** (`docs/adrs/`) — Architecture Decision Records. Capture significant design choices.
- **PRP** (`docs/prps/`) — Product Requirement Prompts. Implementation-ready task packages.
