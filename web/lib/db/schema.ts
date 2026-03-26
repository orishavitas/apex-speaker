import {
  pgTable, text, varchar, timestamp, uuid, real, integer,
  boolean, jsonb, customType, index, uniqueIndex, pgEnum
} from "drizzle-orm/pg-core";

// pgvector custom type (not natively exported from drizzle-orm/pg-core)
const vector = customType<{ data: number[]; config: { dimensions: number } }>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
});

// Enums
export const agentDomainEnum = pgEnum("agent_domain", [
  "manager", "acoustics", "enclosure", "crossover", "theory", "mechanical", "research"
]);

export const sourceTypeEnum = pgEnum("source_type", [
  "chatgpt_conversation", "book_chapter", "forum_thread", "datasheet", "research_paper", "notebooklm"
]);

export const knowledgeStatusEnum = pgEnum("knowledge_status", [
  "private", "canonical"
]);

// Agents — identity, config, and status per domain
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  domain: agentDomainEnum("domain").notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  systemPrompt: text("system_prompt"),
  isActive: boolean("is_active").default(true),
  knowledgeChunkCount: integer("knowledge_chunk_count").default(0),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Projects — a user's speaker build
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  goals: jsonb("goals").$type<string[]>().default([]),
  constraints: jsonb("constraints").$type<Record<string, string>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Conversations — chat history per project
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id),
  role: varchar("role", { length: 20 }).notNull(), // user | assistant
  agentDomain: agentDomainEnum("agent_domain").default("manager"),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Knowledge chunks — RAG-indexed knowledge units
export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceType: sourceTypeEnum("source_type").notNull(),
  agentDomain: agentDomainEnum("agent_domain").notNull(),
  title: varchar("title", { length: 512 }),
  content: text("content").notNull(),
  summary: text("summary"),
  tags: jsonb("tags").$type<string[]>().default([]),
  confidence: real("confidence").default(0.7),
  status: knowledgeStatusEnum("status").default("canonical"),
  embedding: vector("embedding", { dimensions: 1536 }),
  sourceUrl: text("source_url"),
  sourcePath: text("source_path"),
  chunkIndex: integer("chunk_index").default(0),
  parentId: uuid("parent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  domainIdx: index("knowledge_domain_idx").on(table.agentDomain),
  statusIdx: index("knowledge_status_idx").on(table.status),
  sourceChunkIdx: uniqueIndex("knowledge_source_chunk_idx").on(table.sourcePath, table.chunkIndex),
  // HNSW index created post-push via: CREATE INDEX ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
}));

// Agent memory — private scratchpad per agent per project
export const agentMemory = pgTable("agent_memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id).notNull(),
  agentDomain: agentDomainEnum("agent_domain").notNull(),
  key: varchar("key", { length: 255 }).notNull(),
  value: text("value").notNull(),
  isPromoted: boolean("is_promoted").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Sources — ingestion registry (includes NotebookLM)
export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 512 }).notNull(),
  sourceType: sourceTypeEnum("source_type").notNull(),
  url: text("url"),
  filePath: text("file_path"),
  notebooklmUrl: text("notebooklm_url"), // NotebookLM notebook link
  totalChunks: integer("total_chunks").default(0),
  isIngested: boolean("is_ingested").default(false),
  ingestedAt: timestamp("ingested_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
