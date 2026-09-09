export interface Bible {
  names: string[];
  headings: string[];
  text: string;
}

/**
 * Words that are routinely capitalized because of where they sit in a
 * sentence, not because they are proper nouns. Only applied at sentence
 * start: a capitalized "Will" or "Grace" in mid-sentence is far more likely
 * to be a character than a stray auxiliary verb.
 */
const POSITIONAL_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "almost", "already", "also",
  "although", "always", "an", "and", "another", "any", "anyone", "anything", "around", "as",
  "at", "away", "back", "because", "been", "before", "behind", "being", "below", "beneath",
  "beside", "between", "beyond", "both", "but", "by", "can", "could", "did", "do", "does",
  "down", "during", "each", "either", "else", "enough", "even", "every", "everyone",
  "everything", "except", "far", "few", "finally", "first", "for", "found", "from", "get",
  "give", "got", "had", "half", "has", "have", "he", "hear", "heard", "her", "here", "hers",
  "herself", "him", "himself", "his", "how", "however", "if", "in", "inside", "instead",
  "into", "is", "it", "its", "itself", "just", "keep", "last", "later", "least", "left",
  "less", "let", "like", "look", "looked", "made", "make", "many", "maybe", "me", "might",
  "mine", "more", "most", "much", "must", "my", "myself", "near", "nearly", "neither",
  "never", "next", "no", "nobody", "none", "nor", "not", "nothing", "now", "of", "off",
  "often", "on", "once", "one", "only", "onto", "or", "other", "others", "our", "ours",
  "out", "outside", "over", "own", "past", "perhaps", "please", "put", "rather", "really",
  "right", "said", "same", "saw", "say", "see", "seemed", "she", "should", "since", "so",
  "some", "somehow", "someone", "something", "sometimes", "somewhere", "soon", "still",
  "stop", "such", "sure", "take", "than", "that", "the", "their", "theirs", "them",
  "themselves", "then", "there", "these", "they", "thing", "think", "this", "those",
  "though", "three", "through", "thus", "till", "to", "together", "too", "took", "toward",
  "towards", "try", "turn", "turned", "two", "under", "until", "up", "upon", "us", "very",
  "was", "we", "well", "went", "were", "what", "when", "where", "whether", "which", "while",
  "who", "whom", "whose", "why", "will", "with", "within", "without", "would", "yes", "yet",
  "you", "your", "yours", "yourself",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "may", "june", "july", "august", "september",
  "october", "november", "december",
]);

/**
 * Headings that describe the structure of a codex file rather than naming
 * anything in the story.
 */
const STRUCTURAL_HEADINGS = new Set([
  "characters", "character", "world", "world lore", "lore", "items", "item", "plot ideas",
  "plot", "beats", "beat sheet", "outline", "notes", "manuscript", "protagonist",
  "antagonist", "summary", "synopsis", "timeline", "glossary", "index", "archive",
  "imported", "usage ledger", "analytics", "eval",
]);

export function isStructuralHeading(title: string): boolean {
  return STRUCTURAL_HEADINGS.has(title.trim().toLowerCase());
}

/**
 * True when the character at `index` begins a sentence, so its capitalization
 * carries no evidence about proper-noun-ness.
 */
function isSentenceInitial(text: string, index: number): boolean {
  for (let i = index - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "\n" || ch === "\r") return true;
    if (/\s/.test(ch) || `"'“‘’([—–-*_`.includes(ch)) continue;
    return ".!?:;#>|".includes(ch);
  }
  return true;
}

/**
 * Blanks out regions that are not narrative prose, preserving offsets so
 * sentence-position checks stay accurate. Headings, front matter, code fences
 * and editor annotations would otherwise contribute a steady stream of
 * false positives.
 */
function maskNonProse(text: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  return text
    .replace(/^---\r?\n[\s\S]*?\r?\n---/, blank)
    .replace(/```[\s\S]*?```/g, blank)
    .replace(/^[ \t]*#{1,6}[ \t].*$/gm, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/`[^`\n]*`/g, blank);
}

export interface NameMatch {
  name: string;
  /** Offset of the name within the original `prose` string. */
  index: number;
  length: number;
}

/**
 * Every occurrence of a proper-noun-looking phrase that the series bible does
 * not know about, with its offset so callers can point at the exact text.
 * Heuristic by nature: it is a prompt for the writer to check a name, not a
 * hard error.
 */
export function findUnknownNames(prose: string, bible: Bible): NameMatch[] {
  const known = new Set(
    bible.names.map((n) => n.trim().toLowerCase()).filter((n) => n.length > 0),
  );
  const scanned = maskNonProse(prose);
  const out: NameMatch[] = [];

  for (const m of scanned.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g)) {
    const parts = m[1].split(/\s+/);
    const at = m.index ?? 0;
    let offset = at;

    // Drop a leading word only when sentence position already explains its
    // capital letter. A positional word capitalized mid-sentence ("told Will
    // to wait") is kept, because there it most likely is a name.
    if (isSentenceInitial(scanned, at) && POSITIONAL_WORDS.has(parts[0].toLowerCase())) {
      const dropped = parts.shift() as string;
      offset += m[1].slice(dropped.length).search(/\S/) + dropped.length;
    }
    if (parts.length === 0) continue;

    const candidate = parts.join(" ");
    if (known.has(candidate.toLowerCase()) || isStructuralHeading(candidate)) continue;

    out.push({ name: candidate, index: offset, length: candidate.length });
  }

  return out;
}

/** Distinct unknown names, in first-seen order. */
export function unknownNames(prose: string, bible: Bible): string[] {
  return [...new Set(findUnknownNames(prose, bible).map((m) => m.name))];
}

export function bibleLockPrompt(bible: Bible, allowException: boolean): string {
  const list = bible.names.slice(0, 80).join(", ") || "(empty bible)";
  const extra = allowException
    ? "New proper names are allowed only if marked [canon-exception]."
    : "Do not invent proper names, places, or factions outside this list.";
  return `Series bible lock. Canonical names:\n${list}\n${extra}`;
}
