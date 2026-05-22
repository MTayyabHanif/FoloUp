"use client";

import { AlertTriangle, CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { AnalyticsV2 } from "@/types/response";

// ---------------------------------------------------------------------------
// Self-contained local primitives (no shared component dependencies, so this
// file ships independently of the existing callInfo internals).
// ---------------------------------------------------------------------------

function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[#e0e5d5] bg-white px-5 py-4 ${className}`}
    >
      {title ? (
        <header className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#3a3a3a]">
          {title}
        </header>
      ) : null}
      {children}
    </section>
  );
}

function GaugeNumber({
  value,
  ariaLabel,
  dim = false,
}: {
  value: number;
  ariaLabel: string;
  dim?: boolean;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className={`flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-[#c5ccb6] bg-[#fbfdf6] text-2xl font-semibold text-[#0a1d08] ${
        dim ? "opacity-50" : ""
      }`}
    >
      {value}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recommendation styling
// ---------------------------------------------------------------------------

type Rec = AnalyticsV2["recommendation"];
type Confidence = AnalyticsV2["confidence"];

const REC_LABEL: Record<Rec, string> = {
  strong_yes: "Strong Yes",
  yes: "Yes",
  lean_yes: "Lean Yes",
  lean_no: "Lean No",
  no: "No",
  insufficient_data: "Insufficient Data",
};

// Full-width verdict-banner tint (Decision OD-4). Light-mode only —
// removed the dark:* variants because the project doesn't have a real
// dark-mode design system. Tailwind's default `darkMode: 'media'` was
// triggering these from OS-level prefers-color-scheme:dark and rendering
// the banner with hardcoded near-black text on near-black backgrounds.
const REC_TINT: Record<Rec, string> = {
  strong_yes: "bg-green-50 border-green-200",
  yes: "bg-green-50 border-green-200",
  lean_yes: "bg-amber-50 border-amber-200",
  lean_no: "bg-amber-50 border-amber-300",
  no: "bg-red-50 border-red-200",
  insufficient_data: "bg-stone-100 border-stone-300",
};

const REC_GLYPH: Record<Rec, ReactNode> = {
  strong_yes: <CheckCircle2 className="h-6 w-6 text-green-700" aria-hidden />,
  yes: <CheckCircle2 className="h-6 w-6 text-green-700" aria-hidden />,
  lean_yes: <CheckCircle2 className="h-6 w-6 text-amber-700" aria-hidden />,
  lean_no: <XCircle className="h-6 w-6 text-amber-700" aria-hidden />,
  no: <XCircle className="h-6 w-6 text-red-700" aria-hidden />,
  insufficient_data: <MinusCircle className="h-6 w-6 text-stone-500" aria-hidden />,
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  insufficient: "Insufficient signal",
};

const DIMENSION_LABEL: Record<AnalyticsV2["dimensions"][number]["name"], string> = {
  role_fit: "Role fit",
  depth_of_knowledge: "Depth of knowledge",
  communication: "Communication",
  problem_solving: "Problem solving",
  examples_evidence: "Examples & evidence",
  professionalism: "Professionalism",
};

const SEVERITY_LABEL: Record<AnalyticsV2["redFlags"][number]["severity"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const SEVERITY_BADGE_CLASS: Record<
  AnalyticsV2["redFlags"][number]["severity"],
  string
> = {
  high: "bg-red-100 text-red-800 border-red-300",
  medium: "bg-amber-100 text-amber-800 border-amber-300",
  low: "bg-stone-100 text-stone-700 border-stone-300",
};

// ---------------------------------------------------------------------------
// Verdict banner
// ---------------------------------------------------------------------------

function VerdictBanner({ analytics }: { analytics: AnalyticsV2 }) {
  const isInsufficient = analytics.recommendation === "insufficient_data";
  const isLowConfidence =
    analytics.confidence === "low" || analytics.confidence === "insufficient";
  const highSeverityCount = analytics.redFlags.filter(
    (f) => f.severity === "high",
  ).length;

  return (
    <div
      className={`rounded-2xl border px-6 py-5 ${REC_TINT[analytics.recommendation]}`}
      role="region"
      aria-label={`Hiring verdict: ${REC_LABEL[analytics.recommendation]}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          {REC_GLYPH[analytics.recommendation]}
          <div>
            <p className="text-2xl font-semibold text-[#0a1d08]">
              {REC_LABEL[analytics.recommendation]}
            </p>
            <p className="text-sm text-[#53614d]">
              {CONFIDENCE_LABEL[analytics.confidence]}
            </p>
          </div>
        </div>

        {!isInsufficient ? (
          <GaugeNumber
            value={analytics.overallScore}
            ariaLabel={`${analytics.overallScore} out of 100 — ${REC_LABEL[analytics.recommendation]}`}
            dim={isLowConfidence}
          />
        ) : null}
      </div>

      {isLowConfidence && !isInsufficient ? (
        <p className="mt-3 text-sm italic text-[#7a3535]">
          Limited signal — treat score as indicative only.
        </p>
      ) : null}

      {isInsufficient ? (
        <div className="mt-4 space-y-2 text-sm text-[#3a3a3a]">
          <p className="font-medium">
            This session had insufficient candidate signal to produce a score.
          </p>
          {analytics.hardRulesTriggered.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5">
              {analytics.hardRulesTriggered.map((r, i) => (
                <li key={`${r.rule}-${i}`}>{r.detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {highSeverityCount > 0 ? (
        <a
          href="#red-flags"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-red-700 underline"
        >
          <AlertTriangle className="h-4 w-4" />
          {highSeverityCount} high-severity flag{highSeverityCount === 1 ? "" : "s"}
        </a>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------

function DimensionsCard({ dimensions }: { dimensions: AnalyticsV2["dimensions"] }) {
  if (dimensions.length === 0) {return null;}
  return (
    <Card title="Dimensions">
      <div className="space-y-3">
        {dimensions.map((d) => {
          const weightPct = `${Math.round(d.weight * 100)}%`;
          const hasQuotes = d.evidenceQuotes.length > 0;
          // v3 rubric-aware: assessed === false means no question targeted
          // this dimension (or hard cap forced unassessed). Excluded from
          // overallScore; render "Not assessed" instead of a score.
          const isUnassessed = d.assessed === false;

          return (
            <details
              key={d.name}
              className="rounded-xl border border-[#e0e5d5] bg-white px-4 py-3 open:bg-[#fbfdf6]"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#0a1d08]">
                    {DIMENSION_LABEL[d.name]}
                  </span>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                    {weightPct}
                  </span>
                </div>
                {isUnassessed ? (
                  <span
                    className="inline-flex items-center rounded-full bg-stone-100 border border-stone-300 text-stone-600 text-xs px-2 py-0.5"
                    title={`Not assessed — no question targeted ${DIMENSION_LABEL[d.name]}`}
                  >
                    Not assessed
                  </span>
                ) : (
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-lg font-semibold text-[#0a1d08]">
                      {d.score}
                    </span>
                    <span className="text-sm text-[#53614d]">/10</span>
                  </div>
                )}
              </summary>
              <div className="mt-3 space-y-2 text-sm text-[#53614d]">
                {isUnassessed ? (
                  <>
                    <p className="italic text-stone-500">
                      No question in this interview targeted{" "}
                      {DIMENSION_LABEL[d.name]}, so the scorer had no
                      opportunity to evaluate it. This dimension is excluded
                      from the overall score.
                    </p>
                    {d.feedback ? <p>{d.feedback}</p> : null}
                  </>
                ) : (
                  <>
                    <p>{d.feedback}</p>
                    {hasQuotes ? (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-[#3a3a3a]">
                          Evidence
                        </p>
                        <ul className="mt-1 space-y-1">
                          {d.evidenceQuotes.map((q, i) => (
                            <li
                              key={i}
                              className="rounded border-l-2 border-[#c5ccb6] bg-[#fbfdf6] px-2 py-1 italic"
                            >
                              “{q}”
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-xs italic text-stone-500">No candidate evidence</p>
                    )}
                  </>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Red flags
// ---------------------------------------------------------------------------

function RedFlagsCard({ redFlags }: { redFlags: AnalyticsV2["redFlags"] }) {
  if (redFlags.length === 0) {return null;}
  return (
    <Card title="Red flags">
      <div id="red-flags" className="space-y-3">
        {redFlags.map((f, i) => (
          <div key={i} className="rounded-xl border border-[#e0e5d5] bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-[#0a1d08]">{f.flag}</p>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
                  SEVERITY_BADGE_CLASS[f.severity]
                }`}
              >
                {SEVERITY_LABEL[f.severity]}
              </span>
            </div>
            {f.evidenceQuote ? (
              <p className="mt-2 rounded border-l-2 border-[#c5ccb6] bg-[#fbfdf6] px-2 py-1 text-xs italic text-[#53614d]">
                “{f.evidenceQuote}”
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Per-question
// ---------------------------------------------------------------------------

function PerQuestionCard({
  perQuestionScores,
}: {
  perQuestionScores: AnalyticsV2["perQuestionScores"];
}) {
  if (perQuestionScores.length === 0) {return null;}
  return (
    <Card title="Per-question detail">
      <ScrollArea className="max-h-[320px] overflow-auto pr-1">
        <div className="space-y-3">
          {perQuestionScores.map((q, i) => (
            <div
              key={i}
              className="rounded-xl border border-[#e0e5d5] bg-white px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-[#0a1d08]">
                  {i + 1}. {q.question}
                </p>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
                    q.answered
                      ? "border-green-300 bg-green-50 text-green-800"
                      : "border-stone-300 bg-stone-50 text-stone-600"
                  }`}
                >
                  {q.answered ? `Answered · ${q.score ?? 0}/5` : "Not answered"}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#53614d]">{q.summary}</p>
              {q.evidenceQuotes.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {q.evidenceQuotes.map((qt, j) => (
                    <li
                      key={j}
                      className="rounded border-l-2 border-[#c5ccb6] bg-[#fbfdf6] px-2 py-1 text-xs italic text-[#53614d]"
                    >
                      “{qt}”
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Top-level v2 view
// ---------------------------------------------------------------------------

export function AnalyticsV2View({ analytics }: { analytics: AnalyticsV2 }) {
  const isInsufficient = analytics.recommendation === "insufficient_data";

  return (
    <div className="space-y-6">
      <VerdictBanner analytics={analytics} />

      <Card title="Overall feedback">
        <p className="text-sm leading-6 text-[#53614d]">
          {analytics.overallFeedback || (
            <span className="italic text-stone-500">No feedback available</span>
          )}
        </p>
      </Card>

      {analytics.hardRulesTriggered.length > 0 && !isInsufficient ? (
        <Card title={`Hard rules (${analytics.hardRulesTriggered.length})`}>
          <ul className="space-y-1 text-sm text-[#53614d]">
            {analytics.hardRulesTriggered.map((r, i) => (
              <li key={`${r.rule}-${i}`}>
                <span className="font-medium text-[#0a1d08]">{r.rule}:</span>{" "}
                {r.detail}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {!isInsufficient ? (
        <>
          <DimensionsCard dimensions={analytics.dimensions} />
          <RedFlagsCard redFlags={analytics.redFlags} />
          <PerQuestionCard perQuestionScores={analytics.perQuestionScores} />
          {analytics.evidenceGaps.length > 0 ? (
            <Card title={`Evidence gaps (${analytics.evidenceGaps.length})`}>
              <ul className="list-disc space-y-1 pl-5 text-sm text-[#53614d]">
                {analytics.evidenceGaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : (
        <RedFlagsCard redFlags={analytics.redFlags} />
      )}
    </div>
  );
}
