// Splits a ChatGPT-style conversation markdown file into chunks.
// Strategy: split on speaker boundaries (User/Assistant turns),
// then merge small turns into ~800-token blocks to minimize chunk count.

export interface Chunk {
  content: string;
  chunkIndex: number;
  title: string;
}

const MAX_CHARS = 3200;      // ~800 tokens at avg 4 chars/token
const HARD_CAP_CHARS = 28000; // ~7000 tokens — OpenAI text-embedding-3-small limit is 8192 tokens

export function chunkConversation(rawContent: string, title: string): Chunk[] {
  // Strip frontmatter
  const body = rawContent.replace(/^---[\s\S]*?---\n/, "").trim();

  // Split on the separator lines between turns (--- on its own line)
  const turns = body.split(/\n---\n/).map((t) => t.trim()).filter(Boolean);

  const chunks: Chunk[] = [];
  let buffer = "";
  let chunkIndex = 0;

  for (const turn of turns) {
    if (buffer.length + turn.length > MAX_CHARS && buffer.length > 0) {
      chunks.push({
        content: buffer.trim(),
        chunkIndex,
        title: `${title} [${chunkIndex + 1}]`,
      });
      chunkIndex++;
      buffer = turn;
    } else {
      buffer = buffer ? `${buffer}\n\n---\n\n${turn}` : turn;
    }
  }

  if (buffer.trim()) {
    chunks.push({
      content: buffer.trim(),
      chunkIndex,
      title: `${title} [${chunkIndex + 1}]`,
    });
  }

  // Fallback: if no turn markers found, do fixed-size split
  if (chunks.length === 0) {
    const words = body.split(/\s+/);
    let block = "";
    let idx = 0;
    for (const word of words) {
      block += (block ? " " : "") + word;
      if (block.length >= MAX_CHARS) {
        chunks.push({ content: block, chunkIndex: idx, title: `${title} [${idx + 1}]` });
        idx++;
        block = "";
      }
    }
    if (block) chunks.push({ content: block, chunkIndex: idx, title: `${title} [${idx + 1}]` });
    if (chunks.length === 0) {
      chunks.push({ content: body, chunkIndex: 0, title });
    }
  }

  // Hard-cap: split any chunk that exceeds the embedding model's token limit
  const result: Chunk[] = [];
  let resultIdx = 0;
  for (const chunk of chunks) {
    if (chunk.content.length <= HARD_CAP_CHARS) {
      result.push({ ...chunk, chunkIndex: resultIdx++ });
    } else {
      const words = chunk.content.split(/\s+/);
      let block = "";
      for (const word of words) {
        if (block.length + word.length + 1 > HARD_CAP_CHARS && block.length > 0) {
          result.push({ content: block.trim(), chunkIndex: resultIdx, title: `${title} [${resultIdx + 1}]` });
          resultIdx++;
          block = word;
        } else {
          block = block ? `${block} ${word}` : word;
        }
      }
      if (block.trim()) {
        result.push({ content: block.trim(), chunkIndex: resultIdx, title: `${title} [${resultIdx + 1}]` });
        resultIdx++;
      }
    }
  }

  return result;
}
