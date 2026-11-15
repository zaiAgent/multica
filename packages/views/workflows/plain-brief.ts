// The plain-language layer for handoff briefs and handoff notes
// (MUL-8620, the review-improvement plan AR-01…AR-03).
//
// A brief or note reaches two very different readers. The next agent reads it
// as instructions; a human reviewer reads it as the thing they must judge.
// This module turns the raw text into the three layers the reviewer needs:
// a one-line conclusion with risk tags, the decision facts (the next move,
// the steps, the plain meaning of the technical terms it uses), and the
// evidence — the untouched raw text, kept folded one click away.
//
// The parsers are deliberately defensive: briefs and notes are free text that
// can be anything, so every layer degrades to "not found" instead of guessing.
// A brief with no recognizable structure still renders its headline and its
// evidence; nothing is invented between them.

/** Severity levels of a risk tag (AR-03). Ordered low → high. */
export type RiskSeverity = "low" | "medium" | "high";

/** The risk families a text can earn, one per scan entry (AR-03). */
export type RiskKey = "data_loss" | "irreversible" | "external_effect" | "network_fetch";

/** One risk tag extracted from a text: what kind of action it names. */
export interface RiskTag {
  /** Stable key, for the localized label `workflows.plain.risk.<key>`. */
  key: RiskKey;
  severity: RiskSeverity;
}

/** The glossary entries, one per term (AR-02). */
export type TermKey =
  | "force_push"
  | "run_command"
  | "install_packages"
  | "publish_public"
  | "run_tests"
  | "build"
  | "push_remote"
  | "commit"
  | "merge_branches"
  | "reset_hard"
  | "docker"
  | "deploy_cluster"
  | "fetch_network"
  | "delete_files"
  | "secrets"
  | "db_migration"
  | "pull_request"
  | "issue_status";

/** One technical term found in a text, with its plain-language meaning. */
export interface GlossaryTerm {
  /** The term as written in the text (e.g. "npm publish"). */
  matched: string;
  /** Stable key, for the localized explanation `workflows.plain.term.<key>`. */
  key: TermKey;
}

/** The three-layer reading of a brief or note (AR-01). */
export interface PlainBrief {
  /** Conclusion layer: the first line that states what this is about. */
  headline: string;
  /**
   * Decision layer: the move the text says happens next, when it says one
   * (`multica issue status MUL-1 in_review — hands off to X` style). Null when
   * the text names no move.
   */
  nextMove: string | null;
  /** Decision layer: instruction lines the text carries (max 4). */
  steps: string[];
  /** Risk tags the text earned, deduplicated, worst severity first. */
  risks: RiskTag[];
  /** Technical terms the text uses, first occurrence per key. */
  terms: GlossaryTerm[];
  /** Evidence layer: the text exactly as it arrived. */
  raw: string;
}

// Risk scan table (AR-03): each entry names one family of risky action.
// Patterns match whole commands and flags, not substrings of longer words,
// so "deploy" does not fire inside "deployment-review" prose — the leading
// and trailing boundaries below anchor on word edges where it matters.
const RISK_PATTERNS: { key: RiskKey; severity: RiskSeverity; pattern: RegExp }[] = [
  // Data loss: destructive, unrecoverable.
  { key: "data_loss", severity: "high", pattern: /\brm\s+-[a-z]*r[a-z]*f\b|\bgit\s+clean\b|\bdrop\s+table\b|\btruncate\s+table\b|\bshred\b/i },
  // Irreversible history rewrite / privilege escalation.
  { key: "irreversible", severity: "high", pattern: /--force(?!-with-lease)|\bpush\s+-f\b|\breset\s+--hard\b|\bsudo\b|\bchmod\s+-R\b|\bchown\s+-R\b/i },
  // External effect: leaves the machine — publish, push, deploy.
  { key: "external_effect", severity: "medium", pattern: /\bnpm\s+publish\b|\bpublish\b|\bdocker\s+push\b|\bgit\s+push\b|\bkubectl\b|\bdeploy\b|\brelease\b/i },
  // Network fetch: reads from outside, writes nothing.
  { key: "network_fetch", severity: "low", pattern: /\bcurl\b|\bwget\b|\bhttps?:\/\/\S+\b|\bfetch\b|\bdownload\b/i },
];

// Glossary (AR-02): a technical term and the plain action it names. Matched
// longest-first so "git push --force" resolves to force_push, not push_remote.
const GLOSSARY_PATTERNS: { key: TermKey; pattern: RegExp }[] = [
  { key: "force_push", pattern: /\bgit\s+push\s+(--force(?!-with-lease)|-f)\b/i },
  { key: "run_command", pattern: /\bbash\b|\bsh\s+-c\b|\bexec\b/i },
  { key: "install_packages", pattern: /\bnpm\s+(install|ci|add)\b|\bpnpm\s+(install|add)\b|\byarn\s+(add|install)\b/i },
  { key: "publish_public", pattern: /\bnpm\s+publish\b|\bdocker\s+push\b/i },
  { key: "run_tests", pattern: /\b(vitest|jest|pytest|go\s+test)\b|\brun\s+tests\b|\bmake\s+test\b/i },
  { key: "build", pattern: /\bmake\b|\bnpm\s+run\s+build\b|\bpnpm\s+build\b|\bgo\s+build\b/i },
  { key: "push_remote", pattern: /\bgit\s+push\b/i },
  { key: "commit", pattern: /\bgit\s+commit\b/i },
  { key: "merge_branches", pattern: /\bgit\s+(merge|rebase)\b/i },
  { key: "reset_hard", pattern: /\bgit\s+reset\s+--hard\b|\brm\s+-[a-z]*r[a-z]*f\b/i },
  { key: "docker", pattern: /\bdocker\b/i },
  { key: "deploy_cluster", pattern: /\bkubectl\b|\bhelm\b/i },
  { key: "fetch_network", pattern: /\bcurl\b|\bwget\b|\bhttps?:\/\//i },
  { key: "delete_files", pattern: /\brm\s+-[a-z]*r[a-z]*f?\b/i },
  { key: "secrets", pattern: /\bsecret|token|credential|\.env\b|api[_-]?key\b/i },
  { key: "db_migration", pattern: /\bmigration\b|\bmigrate\b|\bsqlc\b/i },
  { key: "pull_request", pattern: /\bpull\s+request\b|\bPR\b/i },
  { key: "issue_status", pattern: /\bmultica\s+issue\s+(status|update)\b/i },
];

const SEVERITY_ORDER: Record<RiskSeverity, number> = { low: 0, medium: 1, high: 2 };

/** The risk tags a text earned, deduplicated, worst first. */
export function riskTags(text: string): RiskTag[] {
  if (!text) return [];
  const found = new Map<RiskKey, RiskTag>();
  for (const { key, severity, pattern } of RISK_PATTERNS) {
    if (pattern.test(text) && !found.has(key)) found.set(key, { key, severity });
  }
  return [...found.values()].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
}

/** The technical terms a text uses, first occurrence per key, longest match wins. */
export function glossaryTerms(text: string): GlossaryTerm[] {
  if (!text) return [];
  const found = new Map<TermKey, GlossaryTerm>();
  // Longest-first ordering of the glossary keeps "git push --force" from
  // being reported as plain "git push".
  const ordered = [...GLOSSARY_PATTERNS].sort((a, b) =>
    (b.pattern.source.length - a.pattern.source.length),
  );
  for (const { key, pattern } of ordered) {
    const match = pattern.exec(text);
    if (match && !found.has(key)) found.set(key, { matched: match[0], key });
  }
  return [...found.values()];
}

// A line that carries no content to a reader: separators and bare headings.
const NONCONTENT = /^(?:[-=]{3,}|#{1,6})$/;

/** One line cleaned of quoting, heading, and list markers. */
function cleanLine(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, "")
    .replace(/^>\s?/, "")
    .replace(/^\s*[-*]\s+/, "")
    .replace(/^\s*\d+[.)]\s+/, "")
    .trim();
}

/**
 * The "Your moves" / next-status line a workflow brief states: a status
 * change command, or a sentence that names handing off. Returned verbatim
 * (cleaned); the caller localizes around it.
 *
 * The status catalog also says "hands off to X" on every column, so the
 * command form wins whenever one exists, and a bare hands-off line only
 * counts when it is not a catalog entry (those start with the status key).
 */
function findNextMove(lines: string[]): string | null {
  for (const line of lines) {
    if (/multica\s+issue\s+status\s+\S+\s+\S+/.test(line)) return cleanLine(line);
  }
  for (const line of lines) {
    if (!/hands\s+off\s+to\s+\S+/.test(line)) continue;
    const cleaned = cleanLine(line);
    if (/^`/.test(cleaned)) continue;
    return cleaned;
  }
  return null;
}

/** Parses a brief or handoff note into its three review layers. */
export function parsePlainBrief(raw: string): PlainBrief {
  const text = raw ?? "";
  const lines = text.split("\n");
  const cleaned = lines.map(cleanLine);

  // Conclusion: the first line that says something. A pure header
  // ("Statuses in this workflow") never beats a real sentence, but any real
  // first line wins even when the brief opens with its title.
  const headline = cleaned.find((line) => line !== "" && !NONCONTENT.test(line)) ?? "";

  // Steps: quoted instruction lines. In a workflow brief they are the
  // "Step instructions:" block; in a free-form handoff note, quoted or
  // dashed lines play the same role.
  const steps: string[] = [];
  for (const line of lines) {
    if (steps.length >= 4) break;
    if (!(/^>\s?\S/.test(line) || /^\s*[-*]\s+\S/.test(line))) continue;
    const step = cleanLine(line);
    // Status-catalog lines ("`todo` …") duplicate the move layer; skip them.
    if (step === "" || /^`/.test(step)) continue;
    steps.push(step);
  }

  const nextMove = findNextMove(lines);

  return {
    headline,
    nextMove,
    steps,
    risks: riskTags(text),
    terms: glossaryTerms(text),
    raw: text,
  };
}

/** The reviewer-facing conclusion verdict of a human review (AR-04). */
export const REVIEW_VERDICTS = ["pass", "reject", "conditional_pass"] as const;
export type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];

/** True when value names a review verdict. */
export function isReviewVerdict(value: unknown): value is ReviewVerdict {
  return typeof value === "string" && (REVIEW_VERDICTS as readonly string[]).includes(value);
}

/** The reason chips a reviewer can pick instead of writing prose (AR-05). */
export const REVIEW_REASONS = [
  "goal_met",
  "quality_below_bar",
  "scope_crept",
  "risk_not_worth_it",
  "needs_human_check",
  "incomplete_evidence",
] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];
