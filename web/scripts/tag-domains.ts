// Maps each conversation filename to its primary agent domain(s)
// Used by the ingestion script to set agentDomain on knowledge_chunks

type AgentDomain = "acoustics" | "enclosure" | "crossover" | "theory" | "mechanical" | "research" | "manager";

export const FILE_DOMAIN_MAP: Record<string, AgentDomain[]> = {
  "01-branch-rs180-pr-system-review.md": ["enclosure", "acoustics"],
  "02-rs180-pr-system-review.md": ["enclosure", "acoustics"],
  "03-port-vs-passive-radiator.md": ["enclosure"],
  "04-branch-branch-speaker-design-options.md": ["research"],
  "05-branch-speaker-design-options.md": ["research"],
  "06-speaker-design-options.md": ["research"],
  "07-cardioid-speakers-amp-options.md": ["acoustics", "crossover"],
  "08-iso-barric-subwoofer-performance.md": ["enclosure", "acoustics"],
  "09-find-subwoofer-match.md": ["research", "acoustics"],
  "10-3d-printed-speaker-enclosure.md": ["mechanical", "enclosure"],
  "11-x-and-m-horns.md": ["acoustics", "theory"],
  "12-isobaric-speaker-design-research.md": ["enclosure", "theory"],
  "13-wtw-pa-speaker-design.md": ["acoustics", "crossover"],
  "14-os-se-waveguide-summary.md": ["acoustics", "theory"],
  "15-waveguide-design-summary.md": ["acoustics"],
  "16-waveguide-curve-design.md": ["acoustics", "theory"],
  "17-create-squircle-in-solidworks.md": ["mechanical"],
  "18-ported-isobaric-woofer-design.md": ["enclosure"],
  "19-bookshelf-speaker-design-request.md": ["research", "crossover"],
  "20-isobaric-pr-bass-design.md": ["enclosure", "acoustics"],
  "21-horn-loading-dome-tweeters.md": ["acoustics", "theory"],
  "22-midrange-above-tweeter.md": ["acoustics", "crossover"],
  "23-breaking-thermal-limits.md": ["theory", "acoustics"],
};

// Primary domain = first in the array (chunk is tagged with this)
export function getPrimaryDomain(filename: string): AgentDomain {
  const domains = FILE_DOMAIN_MAP[filename];
  if (!domains || domains.length === 0) return "research";
  return domains[0];
}
