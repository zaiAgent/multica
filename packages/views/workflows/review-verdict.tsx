"use client";

import { cn } from "@multica/ui/lib/utils";
import { useT } from "../i18n";
import { REVIEW_REASONS, REVIEW_VERDICTS, type ReviewReason, type ReviewVerdict } from "./plain-brief";

/** Verdict option styling: a pass reads quiet, a reject reads as a stop. */
const verdictClass: Record<ReviewVerdict, string> = {
  pass: "border-brand/50 bg-brand/5",
  reject: "border-destructive/40 bg-destructive/5",
  conditional_pass: "border-warning/50 bg-warning/10",
};

/**
 * The human reviewer's conclusion (AR-04, MUL-8620): one verdict of pass /
 * reject / conditional-pass, reason chips instead of prose (AR-05), and an
 * optional one-line note. It rides the status change the reviewer is already
 * making — a separate form nobody would fill — and lands in the timeline
 * entry of that change as one readable line.
 */
export function ReviewVerdictInput({
  verdict,
  onVerdict,
  reasons,
  onToggleReason,
  note,
  onNote,
}: {
  verdict: ReviewVerdict;
  onVerdict: (verdict: ReviewVerdict) => void;
  reasons: ReviewReason[];
  onToggleReason: (reason: ReviewReason) => void;
  note: string;
  onNote: (note: string) => void;
}) {
  const { t } = useT("issues");

  return (
    <div className="space-y-3 rounded-lg border border-surface-border bg-muted/40 p-3.5">
      <div>
        <p className="text-body font-medium">{t(($) => $.workflows.verdict.title)}</p>
        <p className="mt-0.5 text-caption leading-5 text-muted-foreground">
          {t(($) => $.workflows.verdict.hint)}
        </p>
      </div>

      <div role="radiogroup" aria-label={t(($) => $.workflows.verdict.title)} className="space-y-1.5">
        {REVIEW_VERDICTS.map((option) => {
          const selected = option === verdict;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onVerdict(option)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                selected ? verdictClass[option] : "border-surface-border hover:bg-accent/60",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-brand" : "border-input",
                )}
              >
                {selected && <span className="size-2 rounded-full bg-brand" />}
              </span>
              <span className="min-w-0">
                <span className="block text-body font-medium">
                  {t(($) => $.workflows.verdict.option[option])}
                </span>
                <span className="block text-caption leading-5 text-muted-foreground">
                  {t(($) => $.workflows.verdict.option_hint[option])}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {verdict !== "pass" && (
        <>
          <div>
            <p className="text-caption font-medium">{t(($) => $.workflows.verdict.reasons_label)}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {REVIEW_REASONS.map((reason) => {
                const picked = reasons.includes(reason);
                return (
                  <button
                    key={reason}
                    type="button"
                    aria-pressed={picked}
                    onClick={() => onToggleReason(reason)}
                    className={cn(
                      "rounded-xs border px-2 py-1 text-caption transition-colors",
                      picked
                        ? "border-brand/60 bg-brand/10 text-brand"
                        : "border-surface-border bg-background text-muted-foreground hover:bg-accent/60",
                    )}
                  >
                    {t(($) => $.workflows.verdict.reason[reason])}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="review-verdict-note" className="block text-caption font-medium">
              {t(($) => $.workflows.verdict.note_label)}
            </label>
            <textarea
              id="review-verdict-note"
              value={note}
              rows={2}
              maxLength={500}
              onChange={(e) => onNote(e.target.value)}
              placeholder={t(($) => $.workflows.verdict.note_placeholder)}
              className="field-sizing-content min-h-16 w-full rounded-md border border-input bg-background px-2.5 py-2 text-body outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            />
          </div>
        </>
      )}
    </div>
  );
}
