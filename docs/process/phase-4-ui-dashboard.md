# Phase 4: UI/Dashboard — Process Document

**Date:** 2026-03-27
**Status:** Complete
**Branch:** phase-4-ui-dashboard

---

## What Was Built

A functional chat dashboard backed by the 7-agent system, with real-time streaming, domain routing indicators, and starter prompts.

### Deliverables

| Component | Location | Purpose |
|-----------|----------|---------|
| DomainBadge | `web/components/apex/chat/domain-badge.tsx` | Colored badge showing which specialist is active |
| MessageBubble | `web/components/apex/chat/message-bubble.tsx` | Chat message display with streaming cursor |
| ChatInput | `web/components/apex/chat/chat-input.tsx` | Textarea with Enter-to-send, shift+Enter for newline |
| Chat page | `web/app/dashboard/chat/page.tsx` | Full chat UI with useChat, domain routing, starter prompts |
| Dashboard layout | `web/app/dashboard/layout.tsx` | Shared sidebar + main layout for all dashboard pages |
| Dashboard home | `web/app/dashboard/page.tsx` | Landing page with phase status grid and Chat link |
| shadcn components | `web/components/ui/textarea.tsx`, `input.tsx` | Added via `npx shadcn@latest add` |

---

## Design Decisions

### AI SDK v6 Chat API

The v6 `useChat` hook no longer accepts `{ api, input, setInput, append }`. The new pattern requires:
1. A `Chat` instance with a `DefaultChatTransport` (from `"ai"`)
2. Pass the `Chat` instance to `useChat({ chat })`
3. Call `sendMessage({ text })` instead of `append({ role: "user", content })`
4. Manage `input` state manually (standard `useState`)

This is more explicit — the transport is a first-class object, not an implicit config option.

### Domain Routing via Custom `fetch`

The `X-Routed-Domain` header from the manager route is captured by passing a custom `fetch` wrapper to `DefaultChatTransport`. The wrapper reads the header before returning the response to the transport. `onResponse` no longer exists in v6 — `fetch` is the correct interception point.

### Message Content Extraction (UIMessage v6 Format)

In v6, messages are `UIMessage` objects with a `parts` array instead of a plain `content` string. Text is extracted by filtering `parts` where `p.type === "text"` and joining the `text` fields. This handles streaming — parts accumulate as the response streams in.

### Static vs Dynamic Routes

`/dashboard/chat` is `○ (Static)` in the build output — it's a pure client component (`"use client"`) with no server-side data. All AI calls happen client → `/api/agents/manager` at runtime. This is correct and ideal for Vercel edge delivery.

### Starter Prompts

5 domain-spanning starter prompts are shown when the chat is empty. Clicking one fills the input (doesn't auto-submit) — this lets the user review and edit before sending.

---

## Issues Encountered + Fixes

| Issue | Fix |
|-------|-----|
| `useChat` `api`, `input`, `setInput`, `append` don't exist in v6 | Rewrote using `Chat` + `DefaultChatTransport` + `sendMessage` + manual `useState` |
| `onResponse` not in `HttpChatTransportInitOptions` | Used custom `fetch` wrapper to intercept response headers |
| `msg.content` doesn't exist on v6 UIMessage | Extracted text from `msg.parts.filter(p => p.type === "text")` |

---

## How to Run

```bash
cd web && npm run dev
# open http://localhost:3000
# → redirects to /dashboard
# → click "Open Chat" or "Chat" in sidebar
```

No database required to run the chat — agents respond from their system prompts alone when `DATABASE_URL` is not set. RAG context is silently skipped.

---

## Next Phase

**Phase 5: Vercel Deployment**
- `vercel link` → link to Vercel project
- Neon via Vercel Marketplace: `vercel integration add neon`
- `vercel env pull` → populate `.env.local` with `DATABASE_URL` + OIDC tokens
- `npx drizzle-kit push` → create schema in Neon
- `npm run ingest` → embed 23 conversations
- `npm run register-notebooklm` → register NotebookLM source
- `vercel deploy` → preview deployment
- `vercel deploy --prod` → production

NotebookLM URL: https://notebooklm.google.com/notebook/59cf7942-cf9f-459e-9b3c-46b0702f026c
