// Run: npm run register-notebooklm
// Registers the NotebookLM notebook as a first-class source in the DB.
// Does NOT pre-ingest content — content is accessed live by the Research Agent via URL.

import * as path from "path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../.env.local") });

import { db } from "../lib/db";
import { sources } from "../lib/db/schema";
import { eq } from "drizzle-orm";

const NOTEBOOKLM_URL =
  process.env.NOTEBOOKLM_URL ||
  "https://notebooklm.google.com/notebook/59cf7942-cf9f-459e-9b3c-46b0702f026c";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL not set in .env.local");
    process.exit(1);
  }

  console.log("\n📓 Registering NotebookLM source...\n");

  const existing = await db
    .select()
    .from(sources)
    .where(eq(sources.notebooklmUrl, NOTEBOOKLM_URL));

  if (existing.length > 0) {
    console.log("✓ NotebookLM source already registered:", existing[0].id);
    return;
  }

  const inserted = await db
    .insert(sources)
    .values({
      name: "APEX Speaker Design — NotebookLM Knowledge Base",
      sourceType: "notebooklm",
      url: NOTEBOOKLM_URL,
      notebooklmUrl: NOTEBOOKLM_URL,
      totalChunks: 0,
      isIngested: false, // Accessed live, not pre-chunked
    })
    .returning();

  console.log("✅ NotebookLM source registered:", inserted[0].id);
  console.log("   URL:", NOTEBOOKLM_URL);
  console.log("\n   Research Agent will surface this notebook during domain queries.\n");
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
