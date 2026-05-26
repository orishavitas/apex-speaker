# Task Packet: {TASK-ID}
**Type:** {task_type}  
**Priority:** {P0|P1|P2|P3}  
**Executor:** {Claude|Codex|Mixed}  
**Repo:** {repo path}  
**Branch:** task/{task-id-slug}  
**Created:** {YYYY-MM-DD}  
**monday item:** {item ID or URL}

---

## Objective

{One paragraph. What needs to be achieved and why.}

---

## Context

{Relevant background. Link to wiki pages. Prior decisions that apply.}

- Wiki: `{wiki page path}`
- Decision: `{decision record link}`

---

## Inputs

{Files, repos, prior outputs the agent needs to read before starting.}

- `{file path}`
- `.agent-harness/outbox/{prior-task-id}.result.md`

---

## Scope

{Exactly what is in scope. Be specific about files, functions, systems.}

---

## Out of Scope

{What the agent must not touch. Be explicit.}

---

## Acceptance Criteria

- [ ] {Specific, checkable criterion}
- [ ] {Another criterion}
- [ ] Writeback contract fulfilled (result file written, all fields populated)
- [ ] Verification commands pass

---

## Constraints

{Hard rules the agent must follow.}

- Branch: `task/{task-id-slug}`
- Do not modify: `{protected files}`
- Do not call: `{restricted APIs or services}`

---

## Verification Commands

```bash
# Run these after implementation. Results go to artifacts/{task-id}/test_results.txt
{verification commands}
```

---

## Writeback Contract

The agent MUST write the following before this task can be marked Done:

| Artifact | Path |
|---|---|
| Result file | `.agent-harness/outbox/{TASK-ID}.result.md` |
| Test results | `.agent-harness/artifacts/{TASK-ID}/test_results.txt` |
| Session log | `.agent-harness/logs/{TASK-ID}.log` |

Result file must include: `summary`, `changed_files`, `commands_run`, `results`, `risks`, `follow_ups`, `monday_update`.  
No placeholders (TBD, TODO) allowed.

---

## Notes

{Any additional context, links, or considerations.}
