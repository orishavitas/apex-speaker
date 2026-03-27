# APEX — Next Session TODO

**Last updated:** 2026-03-27
**Branch:** master (all phases merged, ready to deploy)

---

## Phase 5: Vercel Deployment

These steps require manual terminal commands — run them in order.

### Step 1 — Push repo to GitHub
```bash
cd /c/Users/OriShavit/documents/github/apex-speaker
gh repo create orishavitas/apex-speaker --private --source=. --push
```

### Step 2 — Link to Vercel
```bash
cd web
vercel link
# → Select personal account
# → Create new project: apex-speaker
# → Root directory: . (already in web/)
```

### Step 3 — Add Neon via Vercel Marketplace
```bash
vercel integration add neon
# → Browser opens → complete Neon setup
# → Auto-provisions DATABASE_URL
```

### Step 4 — Pull env vars locally
```bash
vercel env pull .env.local
# → Creates web/.env.local with DATABASE_URL + VERCEL_OIDC_TOKEN
```

### Step 5 — Push schema to Neon
```bash
# In Neon SQL editor first:
# CREATE EXTENSION IF NOT EXISTS vector;

npx drizzle-kit push
# → Creates all 6 tables
```

### Step 6 — Create HNSW index (Neon SQL editor)
```sql
CREATE INDEX ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
```

### Step 7 — Seed agents + ingest knowledge
```bash
npm run dev &
curl -X POST http://localhost:3000/api/agents/seed
pkill -f "next dev"

npm run ingest
npm run register-notebooklm
```

### Step 8 — Set NotebookLM env var
```bash
vercel env add NOTEBOOKLM_URL
# value: https://notebooklm.google.com/notebook/59cf7942-cf9f-459e-9b3c-46b0702f026c
```

### Step 9 — Deploy
```bash
vercel deploy          # preview
vercel deploy --prod   # production
```

### Step 10 — Verify
```bash
curl https://apex-speaker.vercel.app/api/health
curl https://apex-speaker.vercel.app/api/knowledge/stats
```

---

## Post-Deployment: Nice to Have

- [ ] Add project-level memory UI (view/edit `agent_memory` per project)
- [ ] Knowledge search UI at `/knowledge` (hook up the existing sidebar link)
- [ ] Sources page at `/sources` (list all ingested files with chunk counts)
- [ ] Bump sidebar version to `v0.5.0 — Phase 5`
- [ ] Add a "New Chat" button that clears the conversation
- [ ] Stream the active domain badge transition with a subtle animation
- [ ] Add dark/light theme toggle (currently zinc-dark hardcoded)

---

## Environment Variables Required

| Variable | Source |
|----------|--------|
| `DATABASE_URL` | Neon via `vercel env pull` |
| `VERCEL_OIDC_TOKEN` | Auto-provisioned by Vercel |
| `NOTEBOOKLM_URL` | Manual: `vercel env add` |

---

## Key Files

| File | Purpose |
|------|---------|
| `web/app/api/agents/manager/route.ts` | Keyword routing → domain specialist |
| `web/app/api/agents/[domain]/route.ts` | 6 specialist agents with RAG + memory |
| `web/lib/db/index.ts` | Lazy Neon proxy (no eval-time errors) |
| `web/lib/agents/system-prompts.ts` | Deep domain system prompts |
| `web/scripts/ingest-conversations.ts` | `npm run ingest` pipeline |
| `web/app/dashboard/chat/page.tsx` | AI SDK v6 chat UI |
| `docs/process/phase-5-deployment.md` | Full deployment reference |
