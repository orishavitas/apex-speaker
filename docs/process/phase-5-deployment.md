# Phase 5: Vercel Deployment — Process Document

**Date:** 2026-03-27
**Status:** In Progress
**Branch:** phase-4-ui-dashboard (deploy from this branch → promote to main)

---

## Deployment Checklist

### Step 1: Push repo to GitHub

The `apex-speaker` repo needs to be on GitHub for Vercel to connect to it.

```bash
cd /c/Users/OriShavit/documents/github/apex-speaker

# If no remote set yet:
gh repo create orishavitas/apex-speaker --private --source=. --push
# OR if repo already exists:
git remote add origin https://github.com/orishavitas/apex-speaker.git
git push -u origin phase-4-ui-dashboard
```

### Step 2: Link to Vercel

```bash
cd web
vercel link
# → Select scope: your personal or team account
# → Link to existing project? No (create new)
# → Project name: apex-speaker
# → Root directory: . (already in web/)
```

### Step 3: Add Neon via Vercel Marketplace

```bash
vercel integration add neon
# → Opens browser → complete Neon setup
# → Auto-provisions DATABASE_URL into Vercel env vars
```

### Step 4: Pull env vars locally

```bash
vercel env pull .env.local
# → Writes DATABASE_URL + VERCEL_OIDC_TOKEN to web/.env.local
```

### Step 5: Push schema to Neon

```bash
# In Neon SQL editor, first run:
# CREATE EXTENSION IF NOT EXISTS vector;

npx drizzle-kit push
# → Creates all 6 tables in Neon
```

### Step 6: Create HNSW index

In Neon SQL editor:
```sql
CREATE INDEX ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
```

### Step 7: Seed agents + ingest knowledge

```bash
# Start dev server to seed via API
npm run dev &
curl -X POST http://localhost:3000/api/agents/seed
pkill -f "next dev"

# Run ingestion pipeline (requires DATABASE_URL + AI Gateway OIDC)
npm run ingest
npm run register-notebooklm
```

### Step 8: Deploy to Vercel

```bash
vercel deploy                    # Preview deployment
vercel deploy --prod             # Production deployment
```

### Step 9: Verify deployment

```bash
# Check health
curl https://apex-speaker.vercel.app/api/health

# Check knowledge stats
curl https://apex-speaker.vercel.app/api/knowledge/stats

# Test a search
curl -X POST https://apex-speaker.vercel.app/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{"query": "passive radiator tuning", "domain": "enclosure", "limit": 3}'
```

---

## Environment Variables Required

| Variable | Source | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | Neon via `vercel env pull` | Neon PostgreSQL connection string |
| `VERCEL_OIDC_TOKEN` | Auto-provisioned by Vercel | AI Gateway authentication |
| `NOTEBOOKLM_URL` | Manual | NotebookLM notebook URL |

Set `NOTEBOOKLM_URL` manually:
```bash
vercel env add NOTEBOOKLM_URL
# value: https://notebooklm.google.com/notebook/59cf7942-cf9f-459e-9b3c-46b0702f026c
```

---

## Architecture After Deployment

```
User Browser
  → Vercel Edge (CDN)
    → /dashboard/chat (static, served from edge)
    → /api/agents/manager (serverless function)
      → Vercel AI Gateway (anthropic/claude-sonnet-4-6)
      → Neon PostgreSQL (pgvector knowledge chunks)
      → agent_memory table (per-project scratchpad)
```

---

## What Works Without DB

If Neon is not connected (no DATABASE_URL):
- Chat works — agents answer from their training/system prompts
- RAG context is skipped (graceful degradation)
- Memory is skipped (graceful degradation)
- Stats API returns error (expected)

NotebookLM URL: https://notebooklm.google.com/notebook/59cf7942-cf9f-459e-9b3c-46b0702f026c
