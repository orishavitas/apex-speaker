## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

---

## Nexus Dispatch Contract

This repo uses Nexus for task dispatch and verification.

**Dispatch source:** `.agent-harness/inbox/{task-id}.md` — read the task packet before starting any work.
**Writeback:** `.agent-harness/outbox/{task-id}.result.md` — populate all required fields, no placeholders.
**Evidence:** `.agent-harness/artifacts/{task-id}/test_results.txt` — save test output here.
**monday:** Mirror-only behind `NEXUS_MONDAY_ENABLED=false`. Do not read monday for dispatch, state, or acceptance criteria.

### Required Result Fields

- `summary` — what was done
- `changed_files` — every file modified/created/deleted
- `commands_run` — exact commands in order
- `results` — test output, verification output
- `risks` — what might still break
- `follow_ups` — tasks to create next
- `monday_update` — one paragraph human-facing update

### Vault Ingest (Automatic)

Every session triggers vault ingest at Stop via `session_stop.py` → `vault_ingest_agent.py` (Mapper role).
This runs automatically — no manual action needed.

**Verify last ingest:**
```bash
tail -5 .agent-harness/logs/vault-ingest.ndjson
# Look for: "event": "vault_ingest_complete"
```

**Manual re-run if hook failed:**
```bash
python C:\Users\OriShavit\Documents\GitHub\project_nexus\scripts\vault_ingest_agent.py --runtime codex --session-id manual --repo-path C:\Users\OriShavit\Documents\GitHub\apex-speaker
```

**Constraint:** Do not write directly to `system/`, `projects/`, or `raw/repos/` in the vault. Only `vault_ingest_agent.py` (the Mapper role) writes there.

### Completion Anchors

Every completed task must update before claiming done:
- `TODO.md` — mark completed work, set next actionable item
- `MEMORY.md` — refresh current state, latest verified task, blockers
- `CHANGELOG.md` — add dated entry for what changed

Name the completing agent and session date: e.g. "Completed by Codex during the 2026-05-25 session."
