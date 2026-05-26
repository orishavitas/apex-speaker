# Review: {TASK-ID}
**Reviewer:** Claude (Evaluator)  
**Reviewed:** {YYYY-MM-DD HH:MM}  
**Task type:** {task_type}

---

## Verdict

{APPROVED | NEEDS_CHANGES | REJECTED}

---

## Criteria Results

| Criterion | Result | Notes |
|---|---|---|
| {criterion from task packet} | PASS / FAIL / PARTIAL | {notes} |

---

## Defects

{Specific issues found. Reference file + line where possible.}

- `{file:line}` — {what's wrong}

---

## Recommendation

{What the executor should do next. If NEEDS_CHANGES: specific changes required. If REJECTED: root cause and suggested approach.}

---

## Evidence Checked

- [ ] Result file exists and fields populated
- [ ] No placeholders in result
- [ ] Test results present and passing
- [ ] Changed files match stated scope
- [ ] No unexpected scope expansion
- [ ] Writeback contract fulfilled
