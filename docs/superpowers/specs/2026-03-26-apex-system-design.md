# APEX — Speaker Design Intelligence Platform: System Spec

**Date:** 2026-03-26
**Status:** Approved for implementation
**Owner:** Ori Shavit

---

## Vision

A multi-agent AI platform that guides speaker designers from first principles to finished build. Specialist agents (Acoustics, Enclosure, Crossover, Theory, Mechanical, Research) each maintain growing domain knowledge, coordinated by a Project Manager agent. The user interacts through a dashboard-style web app.

---

## System Decomposition

Five independent subsystems, built in order:

### Phase 1: Foundation
- Next.js 16 App Router scaffold with APEX design system (dark, technical aesthetic)
- Neon PostgreSQL schema: projects, agents, knowledge_chunks, conversations, sources
- pgvector extension for RAG embeddings
- shadcn/ui component library configured

### Phase 2: Knowledge Pipeline
- Ingest the 23 scraped ChatGPT conversations into the knowledge DB
- Book ingestion: chunk PDFs/markdown by chapter/topic, embed, store
- Forum crawler agent (Playwright MCP): DIY Audio, AudioScienceReview, Parts Express forums
- Tag taxonomy: `{domain, source_type, confidence, agent_owner}`
- Search: pgvector cosine similarity + keyword fallback

### Phase 3: Agent Architecture
- 6 specialist agents + 1 Project Manager
- Each agent: system prompt + domain knowledge context + memory (private scratchpad + shared canonical pool)
- Hybrid memory model: private scratchpad per agent → promoted to shared canonical KB after confidence threshold
- AI Gateway routing: all models via `anthropic/claude-sonnet-4-6`
- Agent-to-agent communication via Project Manager (no direct agent-to-agent calls)
- Workflow DevKit for durable multi-step agent tasks

### Phase 4: UI/Dashboard
- Left sidebar: project tree, agent status
- Main area: chat with Project Manager (routes to specialists internally)
- Right panel: knowledge explorer, sources, citations
- Dark theme, technical/engineering aesthetic (zinc palette, monospace metrics)
- AI Elements for all AI text rendering

### Phase 5: Remote & Deployment
- Vercel deployment (preview + production)
- Neon database (Vercel Marketplace integration)
- Remote Control enabled (`claude remote-control`)
- Environment variables via `vercel env pull`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router |
| UI | shadcn/ui + Tailwind CSS + Geist |
| AI SDK | Vercel AI SDK v6 + AI Gateway |
| AI UI | AI Elements |
| Database | Neon PostgreSQL + pgvector |
| ORM | Drizzle ORM |
| Agents | AI SDK Agent class + Workflow DevKit |
| Forum Crawler | Playwright MCP (dedicated sub-agent) |
| Deployment | Vercel |
| Remote | Claude Code Remote Control |

---

## Design Language: APEX Visual System

- **Theme**: Dark by default. Engineering instrument aesthetic — like a spectrum analyzer or oscilloscope UI.
- **Palette**: Zinc-950 background, zinc-900 surfaces, zinc-800 borders. Single accent: `#4f9cf9` (electric blue — frequency response curve color).
- **Typography**: Geist Sans for UI, Geist Mono for all technical values (Hz, dB, Ω, mm, parameters).
- **Data viz colors**: Blue (acoustics), green (enclosure), amber (crossover), violet (theory), slate (mechanical), cyan (research).
- **Agent cards**: Each agent has its domain color as a left border accent.
- **No gradients** except subtle radial glow on active agent. No glassmorphism.

---

## Agent Roster

| Agent | Domain | Color |
|-------|--------|-------|
| Project Manager | Coordination | white |
| Acoustics | SPL, FR, directivity, room | blue |
| Enclosure | Cabinets, ports, isobaric, BR | green |
| Crossover | Filter topology, components | amber |
| Theory | T/S params, physics, math | violet |
| Mechanical | Materials, CNC, 3D print, bracing | slate |
| Research | Forums, papers, datasheets | cyan |

---

## Knowledge Taxonomy

```
source_type: chatgpt_conversation | book_chapter | forum_thread | datasheet | research_paper
domain: acoustics | enclosure | crossover | theory | mechanical | research | general
confidence: 0.0-1.0 (auto-scored by ingestion agent)
agent_owner: null (shared) | acoustics | enclosure | crossover | theory | mechanical | research
status: private | canonical
```

---

## Process Documentation

Every completed phase produces a process doc in `docs/process/`:
- `phase-1-foundation.md`
- `phase-2-knowledge-pipeline.md`
- `phase-3-agents.md`
- `phase-4-ui.md`
- `phase-5-deployment.md`

Format: what was built, thought process, implementation decisions, how to extend it.

---

## External Resources

### NotebookLM — Speaker Building Knowledge Base
**URL:** https://notebooklm.google.com/notebook/59cf7942-cf9f-459e-9b3c-46b0702f026c
**Purpose:** Aggregated speaker design knowledge — books, conversations, research papers
**Used by:** Research Agent (Phase 3) for knowledge synthesis and citation
**Access:** Ori Shavit (ori@compulocks.com)
