export type AgentDomain =
  | "acoustics"
  | "enclosure"
  | "crossover"
  | "theory"
  | "mechanical"
  | "research"
  | "manager";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentChatRequest {
  projectId?: string;
  messages: ChatMessage[];
  domain?: AgentDomain;
}

export interface KnowledgeContext {
  chunkId: string;
  title: string | null;
  content: string;
  sourceUrl: string | null;
  similarity: number;
  domain: AgentDomain;
}
