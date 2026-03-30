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
  "manager", "acoustics", "enclosure", "crossover", "theory", "mechanical", "research", "vituixcad"
]);

export const sourceTypeEnum = pgEnum("source_type", [
  "chatgpt_conversation", "book_chapter", "forum_thread", "datasheet", "research_paper", "notebooklm",
  "vituixcad_project", "driver_measurement"
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

// ── NEW ENUMS ─────────────────────────────────────────────────────────────────

export const vituixcadProjectTypeEnum = pgEnum("vituixcad_project_type", [
  "vxp", "vxd", "vxb",
]);

export const driverTypeEnum = pgEnum("driver_type", [
  "woofer", "midrange", "tweeter", "supertweeter", "subwoofer",
  "fullrange", "compression_driver", "ribbon", "planar", "coaxial",
]);

export const moduleTypeEnum = pgEnum("module_type", [
  "two_way", "three_way", "four_way", "mtm", "dappo", "subwoofer_only",
]);

export const hornTypeEnum = pgEnum("horn_type", [
  "direct_radiator", "waveguide", "tractrix", "exponential",
  "conical", "oblate_spheroidal", "le_cleach", "transmission_line",
]);

// ── TABLE: vituixcad_projects ─────────────────────────────────────────────────

export const vituixcadProjects = pgTable("vituixcad_projects", {
  id:            uuid("id").primaryKey().defaultRandom(),
  projectId:     uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  fileType:      vituixcadProjectTypeEnum("file_type").notNull(),
  fileName:      text("file_name").notNull(),
  fileHash:      text("file_hash").notNull(),
  parsedData:    jsonb("parsed_data").notNull(),
  schemaVersion: integer("schema_version").notNull().default(1),
  embedding:     vector("embedding", { dimensions: 1536 }),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  fileHashIdx: uniqueIndex("vxp_file_hash_idx").on(t.fileHash),
  projectIdx:  index("vxp_project_idx").on(t.projectId),
}));

// ── TABLE: driver_database ────────────────────────────────────────────────────

export const driverDatabase = pgTable("driver_database", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  manufacturer:         text("manufacturer").notNull(),
  model:                text("model").notNull(),
  driverType:           driverTypeEnum("driver_type").notNull(),
  nominalDiameterMm:    real("nominal_diameter_mm"),
  nominalImpedanceOhm:  real("nominal_impedance_ohm"),
  reOhm:                real("re_ohm"),
  leMh:                 real("le_mh"),
  bl:                   real("bl"),
  fsHz:                 real("fs_hz"),
  qts:                  real("qts"),
  qes:                  real("qes"),
  qms:                  real("qms"),
  vasLiters:            real("vas_liters"),
  mmsGrams:             real("mms_grams"),
  cmsMmPerN:            real("cms_mm_per_n"),
  rmsKgS:               real("rms_kg_s"),
  sdCm2:                real("sd_cm2"),
  xmaxMm:               real("xmax_mm"),
  sensitivity1m1w:      real("sensitivity_1m1w"),
  powerWatts:           real("power_watts"),
  throatDiameterMm:     real("throat_diameter_mm"),
  compressionRatio:     real("compression_ratio"),
  datasheetUrl:         text("datasheet_url"),
  measurementFrdUrl:    text("measurement_frd_url"),
  source:               text("source").notNull().default("manual"),
  rawData:              jsonb("raw_data"),
  createdAt:            timestamp("created_at").defaultNow().notNull(),
  updatedAt:            timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  manufacturerModelIdx: uniqueIndex("driver_mfr_model_idx").on(t.manufacturer, t.model),
  typeIdx:              index("driver_type_idx").on(t.driverType),
  fsIdx:                index("driver_fs_idx").on(t.fsHz),
}));

// ── TABLE: design_state ───────────────────────────────────────────────────────

export const designState = pgTable("design_state", {
  id:                       uuid("id").primaryKey().defaultRandom(),
  projectId:                uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).unique().notNull(),
  moduleType:               moduleTypeEnum("module_type").notNull().default("two_way"),
  numWays:                  integer("num_ways").notNull().default(2),
  waysConfig:               jsonb("ways_config").notNull().default([]),
  cabinetVolumeLiters:      real("cabinet_volume_liters"),
  cabinetMaterialMm:        real("cabinet_material_mm"),
  cabinetDampingFactor:     real("cabinet_damping_factor"),
  activeVituixcadProjectId: uuid("active_vituixcad_project_id"),
  version:                  integer("version").notNull().default(1),
  createdAt:                timestamp("created_at").defaultNow().notNull(),
  updatedAt:                timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  projectIdx: index("design_state_project_idx").on(t.projectId),
}));
