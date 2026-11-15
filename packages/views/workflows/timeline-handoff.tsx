"use client";

import { CornerDownRight } from "@multica/ui/icons";
import { useActorName } from "@multica/core/workspace/hooks";
import { cn } from "@multica/ui/lib/utils";
import { ActorAvatar } from "../common/actor-avatar";
import { useT } from "../i18n";
import { PlainBriefCard } from "./plain-brief-card";
import { isReviewVerdict } from "./plain-brief";

/** Verdict chip styling: a pass reads quiet, a reject reads as a stop. */
const verdictChipClass: Record<string, string> = {
  pass: "border-brand/40 bg-brand/10 text-brand",
  reject: "border-destructive/40 bg-destructive/10 text-destructive",
  conditional_pass: "border-warning/50 bg-warning/10 text-warning",
};

/** The reviewer's conclusion of a review exit, as one timeline line (AR-06). */
function TimelineVerdict({ details }: { details: Record<string, string> }) {
  const { t } = useT("issues");
  const verdict = details.review_verdict;
  if (!isReviewVerdict(verdict)) return null;
  const reasons = (details.review_reasons ?? "").split(",").filter(Boolean);
  const reasonText = reasons.length > 0
    ? reasons.map((reason) => t(($) => ($.workflows.verdict.reason as Record<string, string>)[reason] ?? reason)).join(t(($) => $.workflows.list_separator))
    : "";
  const note = details.review_note ?? "";
  return (
    <div className="mt-1 space-y-1">
      <p className="flex flex-wrap items-center gap-1.5 text-caption">
        <span
          className={cn(
            "inline-flex items-center rounded-xs border px-1.5 py-0.5 font-medium",
            verdictChipClass[verdict],
          )}
        >
          {t(($) => $.workflows.verdict.chip[verdict])}
        </span>
        {reasonText && <span className="text-muted-foreground">{reasonText}</span>}
        {note && <span className="text-muted-foreground">· {note}</span>}
      </p>
      {verdict === "conditional_pass" && note && (
        <p className="text-caption leading-5 text-muted-foreground">
          {t(($) => $.workflows.verdict.conditional_open)}
        </p>
      )}
    </div>
  );
}

/**
 * The handoff half of a status-change timeline entry (MUL-7420): who the
 * workflow step handed the issue to, whether their run started, and the brief
 * that run received. The brief reads through its plain-language layers
 * (MUL-8620): a conclusion with risk tags, the decision facts, and the raw
 * evidence folded below. Renders nothing for an ordinary status change; a
 * review exit with no handoff still renders the reviewer's verdict.
 */
export function TimelineHandoff({ details }: { details: Record<string, string> }) {
  const { t } = useT("issues");
  const { getActorName } = useActorName();
  const type = details.handoff_to_type;
  const id = details.handoff_to_id;
  const note = details.handoff_note ?? "";
  const hasVerdict = isReviewVerdict(details.review_verdict);
  if (!type && !id && !hasVerdict) return null;
  const ran = details.handoff_run === "true";
  const name = type && id ? getActorName(type, id) : "";
  return (
    <div className="mt-1 space-y-2">
      {type && id && (
        <div className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
          <CornerDownRight aria-hidden className="size-3 shrink-0" />
          <span>{t(($) => $.workflows.timeline.handed_to)}</span>
          <ActorAvatar actorType={type} actorId={id} size="xs" profileLink={false} />
          <span className="font-medium text-foreground">{name}</span>
          {type === "member" ? (
            <span>{t(($) => $.workflows.timeline.member_no_run)}</span>
          ) : ran ? (
            <>
              <span>{t(($) => $.workflows.timeline.run_started)}</span>
            </>
          ) : null}
        </div>
      )}
      {hasVerdict && <TimelineVerdict details={details} />}
      {note && (
        <PlainBriefCard brief={note} compact />
      )}
    </div>
  );
}
