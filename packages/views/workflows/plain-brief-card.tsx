"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "@multica/ui/icons";
import { cn } from "@multica/ui/lib/utils";
import { useT } from "../i18n";
import { BriefBlock } from "./handoff-form";
import { parsePlainBrief, type PlainBrief, type RiskSeverity } from "./plain-brief";

/** Severity styling for a risk tag (AR-03): high states itself, low whispers. */
const riskClass: Record<RiskSeverity, string> = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-warning/40 bg-warning/10 text-warning",
  low: "border-surface-border bg-muted text-muted-foreground",
};

/**
 * The three-layer reading of a handoff brief or note (AR-01, MUL-8620):
 * a one-line conclusion with risk tags, the decision facts — the move the
 * reviewer is allowing, the steps it names, the plain meaning of the
 * technical terms it uses — and the evidence, the raw text folded one click
 * away. Renders nothing when there is no text, so callers can mount it
 * unconditionally.
 */
export function PlainBriefCard({
  brief,
  loading,
  compact = false,
}: {
  brief: string | undefined;
  loading?: boolean;
  /** Timeline mode: the evidence layer starts open, the layers tighten. */
  compact?: boolean;
}) {
  const { t } = useT("issues");
  const [evidenceOpen, setEvidenceOpen] = useState(compact);
  const plain: PlainBrief | null = useMemo(() => (brief ? parsePlainBrief(brief) : null), [brief]);
  if (loading || !plain || !brief) return null;

  const hasDecision = plain.nextMove !== null || plain.steps.length > 0 || plain.terms.length > 0;

  return (
    <div className={cn("rounded-lg border border-surface-border", compact ? "bg-transparent" : "bg-muted/40")}>
      {/* Conclusion layer: one line that answers "what is this about?" (AR-01). */}
      {plain.headline !== "" && (
        <div className={cn("space-y-1.5", compact ? "p-2" : "p-3.5")}>
          <p className="text-body font-medium leading-6">{plain.headline}</p>
          {plain.risks.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {plain.risks.map((risk) => (
                <span
                  key={risk.key}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-xs border px-1.5 py-0.5 text-micro font-medium",
                    riskClass[risk.severity],
                  )}
                >
                  {t(($) => $.workflows.plain.risk[risk.key])}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Decision layer: the move being allowed, the steps, the plain terms. */}
      {hasDecision && (
        <div className={cn("space-y-2 border-t border-surface-border", compact ? "p-2" : "p-3.5")}>
          {plain.nextMove && (
            <p className="text-caption leading-5">
              <span className="font-medium text-foreground">{t(($) => $.workflows.plain.next_move_label)}</span>{" "}
              {plain.nextMove}
            </p>
          )}
          {plain.steps.length > 0 && (
            <div className="text-caption leading-5">
              <span className="font-medium">{t(($) => $.workflows.plain.steps_label)}</span>
              <ul className="mt-1 space-y-0.5">
                {plain.steps.slice(0, 4).map((step, i) => (
                  <li key={i} className="text-muted-foreground">
                    · {step}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {plain.terms.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-micro">
              <span className="font-medium text-muted-foreground">{t(($) => $.workflows.plain.terms_label)}</span>
              {plain.terms.map((term) => (
                <span key={term.key} className="rounded-xs border border-surface-border bg-background px-1.5 py-0.5">
                  <code className="font-mono">{term.matched}</code>
                  <span aria-hidden className="mx-1 text-muted-foreground">→</span>
                  {t(($) => $.workflows.plain.term[term.key])}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Evidence layer: the raw text, one click away (AR-01 军规 5). */}
      <div className={cn("border-t border-surface-border", compact ? "px-2 pb-2" : "px-3.5 pb-3.5")}>
        <button
          type="button"
          onClick={() => setEvidenceOpen((v) => !v)}
          aria-expanded={evidenceOpen}
          className="flex items-center gap-1 py-2 text-caption font-medium text-brand hover:underline"
        >
          {evidenceOpen ? (
            <ChevronDown aria-hidden className="size-3.5" />
          ) : (
            <ChevronRight aria-hidden className="size-3.5" />
          )}
          {t(($) => $.workflows.plain.evidence_toggle)}
        </button>
        {evidenceOpen && <BriefBlock brief={brief} />}
      </div>
    </div>
  );
}
