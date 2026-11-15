import { describe, expect, it } from "vitest";
import {
  REVIEW_REASONS,
  REVIEW_VERDICTS,
  glossaryTerms,
  isReviewVerdict,
  parsePlainBrief,
  riskTags,
} from "./plain-brief";

// A brief rendered the way the server renders one (issueworkflow.Brief), with
// step instructions that name genuinely risky commands.
const BRIEF = `This project's workflow — Ship fast (LinkLite)

You are handling the "Implement" step of MUL-7.

Step instructions:
> Run the implementation and cover it with tests.
> When it is done, run npm publish to release the package.
> Do not rewrite git history; a member reviews the diff.

Statuses in this workflow:
- \`todo\` 待办 — hands off to Coder
- \`in_progress\` 进行中 — hands off to Reviewer
- \`in_review\` 待审 — hands off to Project Lead   ← current

Your moves:
Step done      → multica issue status MUL-7 in_review — hands off to Reviewer
`;

const NOTE = `Finished the data migration and wrote tests.
I had to run rm -rf on the generated cache and git push --force to fix the branch.
Question: should I also drop table staging_rows?`;

describe("riskTags", () => {
  it("tags destructive and external-effect commands with their severities", () => {
    expect(riskTags("run rm -rf ./cache now")).toEqual(
      expect.arrayContaining([{ key: "data_loss", severity: "high" }]),
    );
  });

  it("orders worst severity first and deduplicates families", () => {
    const risks = riskTags("npm publish after git push --force");
    expect(risks.map((r) => r.key)).toEqual(["irreversible", "external_effect"]);
  });

  it("does not fire on past-tense prose", () => {
    // "deployed" is narration, not a deploy command — no tag at all.
    expect(riskTags("the service was deployed yesterday")).toEqual([]);
  });

  it("ignores force-with-lease, which is the safe force form", () => {
    expect(riskTags("git push --force-with-lease").map((r) => r.key)).not.toContain("irreversible");
  });

  it("returns nothing for plain text", () => {
    expect(riskTags("update the README and add two tests")).toEqual([]);
  });
});

describe("glossaryTerms", () => {
  it("maps the commands a brief uses to plain-language keys", () => {
    const keys = glossaryTerms("run npm publish and then docker push").map((t) => t.key);
    expect(keys).toContain("publish_public");
    expect(keys).toContain("docker");
  });

  it("prefers the longest match: git push --force is force_push, not push_remote", () => {
    expect(glossaryTerms("git push --force origin main").map((t) => t.key)).toContain("force_push");
  });

  it("keeps the matched spelling for display", () => {
    expect(glossaryTerms("run npm install").find((t) => t.key === "install_packages")?.matched).toBe("npm install");
  });
});

describe("parsePlainBrief", () => {
  const plain = parsePlainBrief(BRIEF);

  it("takes the title line as the conclusion headline", () => {
    expect(plain.headline).toBe("This project's workflow — Ship fast (LinkLite)");
  });

  it("extracts the move the reviewer is being asked to allow", () => {
    expect(plain.nextMove).toBe("Step done      → multica issue status MUL-7 in_review — hands off to Reviewer");
  });

  it("keeps the step instructions as decision-layer steps, skipping the status catalog", () => {
    expect(plain.steps).toEqual([
      "Run the implementation and cover it with tests.",
      "When it is done, run npm publish to release the package.",
      "Do not rewrite git history; a member reviews the diff.",
    ]);
  });

  it("flags the publish command as a risk", () => {
    expect(plain.risks.map((r) => r.key)).toContain("external_effect");
  });

  it("keeps the raw text as evidence", () => {
    expect(plain.raw).toBe(BRIEF);
  });

  it("reads a free-form handoff note the same way", () => {
    const note = parsePlainBrief(NOTE);
    expect(note.headline).toBe("Finished the data migration and wrote tests.");
    expect(note.risks.map((r) => r.key)).toContain("data_loss");
    expect(note.risks.map((r) => r.key)).toContain("irreversible");
  });

  it("degrades to headline + evidence for an unstructured text", () => {
    const bare = parsePlainBrief("just one line");
    expect(bare.headline).toBe("just one line");
    expect(bare.steps).toEqual([]);
    expect(bare.nextMove).toBeNull();
  });

  it("returns all-empty layers for empty input", () => {
    const empty = parsePlainBrief("");
    expect(empty.headline).toBe("");
    expect(empty.risks).toEqual([]);
    expect(empty.terms).toEqual([]);
  });
});

describe("review verdicts", () => {
  it("accepts exactly the three conclusions", () => {
    expect(REVIEW_VERDICTS).toEqual(["pass", "reject", "conditional_pass"]);
    for (const verdict of REVIEW_VERDICTS) expect(isReviewVerdict(verdict)).toBe(true);
    expect(isReviewVerdict("approve")).toBe(false);
    expect(isReviewVerdict(null)).toBe(false);
  });

  it("offers reason chips instead of free prose", () => {
    expect(REVIEW_REASONS.length).toBeGreaterThan(3);
  });
});
