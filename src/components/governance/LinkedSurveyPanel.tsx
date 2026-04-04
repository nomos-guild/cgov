import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoteProgress } from "@/components/ui/vote-progress";
import type {
  ProposalSurveyMethodResult,
  ProposalSurveyResponse,
  ProposalSurveyRoleResult,
  ProposalSurveyTallyPhase,
  ProposalSurveyTallyResponse,
  ResponderRole,
  SurveyQuestion,
  SurveyWeightingMode,
} from "@/types/governance";
import {
  BUILTIN_SURVEY_METHODS,
  isCustomSurveyMethod,
} from "@/lib/surveyMetadata";
import type { VoteSegment } from "@/lib/voteBreakdownCalculator";
import { cn } from "@/lib/utils";

interface LinkedSurveyPanelProps {
  survey: ProposalSurveyResponse | null;
  tally: ProposalSurveyTallyResponse | null;
  isSurveyLoading?: boolean;
  isTallyLoading?: boolean;
  surveyError?: string | null;
  tallyError?: string | null;
  isGame?: boolean;
}

interface SurveyLegendItem {
  label: string;
  value: number;
  percent: number;
  color: string;
}

interface ChoiceMethodResultShape {
  options: string[];
  optionTotals: number[];
}

interface NumericMethodResultShape {
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
}

interface CustomMethodResultShape {
  customValueTotals: Record<string, number>;
}

const ROLE_ORDER: ResponderRole[] = ["DRep", "SPO", "CC", "Stakeholder"];

const ROLE_LABELS: Record<ResponderRole, string> = {
  DRep: "DReps",
  SPO: "SPOs",
  CC: "CC",
  Stakeholder: "Stakeholders",
};

const QUESTION_DONUT_COLORS = [
  "#22C55E",
  "#8C200B",
  "#0EA5E9",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#64748B",
];

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function getTallyPhaseLabel(
  phase: ProposalSurveyTallyPhase,
  finalizationEpoch: number | null
): string {
  if (phase === "provisional") {
    return finalizationEpoch !== null
      ? `Provisional until epoch ${integerFormatter.format(finalizationEpoch)}`
      : "Provisional";
  }

  if (phase === "finalization_pending") {
    return "Finalization pending";
  }

  return "Finalized";
}

function getTallyPhaseTone(
  phase: ProposalSurveyTallyPhase
): "outline" | "secondary" {
  return phase === "finalized" ? "secondary" : "outline";
}

function getApplicableRoles(
  survey: ProposalSurveyResponse | null,
  tally: ProposalSurveyTallyResponse | null
): ResponderRole[] {
  const linkedRoleWeighting = survey?.linkValidation.linkedRoleWeighting;
  if (linkedRoleWeighting && Object.keys(linkedRoleWeighting).length > 0) {
    return ROLE_ORDER.filter((role) => linkedRoleWeighting[role]);
  }

  const surveyRoleWeighting = survey?.surveyDetails?.roleWeighting;
  if (surveyRoleWeighting && Object.keys(surveyRoleWeighting).length > 0) {
    return ROLE_ORDER.filter((role) => surveyRoleWeighting[role]);
  }

  const tallyRoles = new Set(
    tally?.roleResults.map((roleResult) => roleResult.responderRole) ?? []
  );
  return ROLE_ORDER.filter((role) => tallyRoles.has(role));
}

function getRoleWeightingMode(
  role: ResponderRole,
  survey: ProposalSurveyResponse | null,
  tally: ProposalSurveyTallyResponse | null
): SurveyWeightingMode | null {
  return (
    survey?.linkValidation.linkedRoleWeighting?.[role] ??
    survey?.surveyDetails?.roleWeighting?.[role] ??
    tally?.roleResults.find((roleResult) => roleResult.responderRole === role)
      ?.weightingMode ??
    null
  );
}

function getRoleResult(
  role: ResponderRole,
  tally: ProposalSurveyTallyResponse | null
): ProposalSurveyRoleResult | null {
  return (
    tally?.roleResults.find((roleResult) => roleResult.responderRole === role) ??
    null
  );
}

function getMethodResult(
  role: ResponderRole,
  questionId: string,
  tally: ProposalSurveyTallyResponse | null
): ProposalSurveyMethodResult | null {
  return (
    getRoleResult(role, tally)?.methodResults.find((result) => {
      const resultRecord = result as Record<string, unknown>;
      return resultRecord.questionId === questionId;
    }) ?? null
  );
}

function parseChoiceMethodResult(
  result: ProposalSurveyMethodResult | null
): ChoiceMethodResultShape | null {
  if (!result) return null;
  const record = result as Record<string, unknown>;
  const options = Array.isArray(record.options)
    ? record.options.filter(
        (option): option is string => typeof option === "string"
      )
    : [];
  const optionTotals = Array.isArray(record.optionTotals)
    ? record.optionTotals.filter(
        (total): total is number => typeof total === "number"
      )
    : [];
  return {
    options,
    optionTotals,
  };
}

function parseNumericMethodResult(
  result: ProposalSurveyMethodResult | null
): NumericMethodResultShape | null {
  if (!result) return null;
  const record = result as Record<string, unknown>;
  return {
    count: typeof record.count === "number" ? record.count : 0,
    min: typeof record.min === "number" ? record.min : null,
    max: typeof record.max === "number" ? record.max : null,
    mean: typeof record.mean === "number" ? record.mean : null,
  };
}

function parseCustomMethodResult(
  result: ProposalSurveyMethodResult | null
): CustomMethodResultShape | null {
  if (!result) return null;
  const record = result as Record<string, unknown>;
  const customValueTotals =
    record.customValueTotals &&
    typeof record.customValueTotals === "object" &&
    !Array.isArray(record.customValueTotals)
      ? (record.customValueTotals as Record<string, number>)
      : {};

  return {
    customValueTotals,
  };
}

function formatWeightedValue(
  value: number,
  weightingMode: SurveyWeightingMode | null
): string {
  if (weightingMode === "CredentialBased") {
    return integerFormatter.format(value);
  }

  if (Math.abs(value) >= 1000) {
    return `${compactFormatter.format(value)} ADA`;
  }

  return `${decimalFormatter.format(value)} ADA`;
}

function formatCenterValue(
  value: number,
  weightingMode: SurveyWeightingMode | null
): string {
  if (weightingMode === "CredentialBased") {
    return integerFormatter.format(value);
  }

  return Math.abs(value) >= 1000
    ? `${compactFormatter.format(value)} ADA`
    : `${decimalFormatter.format(value)} ADA`;
}

function formatNumericValue(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return Number.isInteger(value)
    ? integerFormatter.format(value)
    : decimalFormatter.format(value);
}

function formatCustomValue(rawKey: string): string {
  try {
    const parsed = JSON.parse(rawKey) as unknown;
    if (typeof parsed === "string") {
      return parsed;
    }
    return JSON.stringify(parsed);
  } catch {
    return rawKey;
  }
}

function buildLegendItems(
  question: SurveyQuestion,
  result: ChoiceMethodResultShape | null
): SurveyLegendItem[] {
  const optionLabels =
    question.options && question.options.length > 0
      ? question.options
      : result?.options ?? [];
  const optionTotals = result?.optionTotals ?? [];
  const totalSelections = optionTotals.reduce((sum, value) => sum + value, 0);

  return optionLabels.map((label, index) => {
    const value = optionTotals[index] ?? 0;
    return {
      label,
      value,
      percent: totalSelections > 0 ? (value / totalSelections) * 100 : 0,
      color: QUESTION_DONUT_COLORS[index % QUESTION_DONUT_COLORS.length],
    };
  });
}

function buildChoiceSegments(items: SurveyLegendItem[]): VoteSegment[] {
  return items
    .filter((item) => item.value > 0)
    .map((item, index) => ({
      type: `option-${index}`,
      percent: item.percent,
      value: item.value,
      color: item.color,
      label: item.label,
    }));
}

function SummaryCard({
  role,
  weightingMode,
  title,
  rows,
  emptyMessage,
  isGame,
  children,
}: {
  role: ResponderRole;
  weightingMode: SurveyWeightingMode | null;
  title?: string;
  rows: Array<{ label: string; value: string }>;
  emptyMessage?: string;
  isGame: boolean;
  children?: React.ReactNode;
}) {
  const hasRows = rows.length > 0;

  return (
    <div
      className={cn(
        "w-full rounded-3xl border px-4 py-4 shadow-elevation-2",
        isGame
          ? "game-detail-card"
          : "border-border/40 bg-card dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "text-sm font-medium",
              isGame ? "text-white" : "text-muted-foreground"
            )}
          >
            {ROLE_LABELS[role]}
          </div>
          {title ? (
            <div
              className={cn(
                "mt-1 break-words text-base font-semibold",
                isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
              )}
            >
              {title}
            </div>
          ) : null}
        </div>
        {weightingMode ? (
          <Badge
            variant="outline"
            className="max-w-full whitespace-normal break-words rounded-none px-2 py-1 text-2xs leading-tight"
          >
            {weightingMode}
          </Badge>
        ) : null}
      </div>

      {hasRows ? (
        <div className="mt-4 space-y-2">
          {children}
          {rows.map((row) => (
            <div
              key={`${role}-${title}-${row.label}`}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <span
                className={cn(
                  "min-w-0 flex-1 text-muted-foreground",
                  isGame && "text-white/70"
                )}
              >
                {row.label}
              </span>
              <span
                className={cn(
                  "shrink-0 font-mono",
                  isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
                )}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div
          className={cn(
            "mt-4 text-sm text-muted-foreground",
            isGame && "text-white/70"
          )}
        >
          {emptyMessage ?? "No valid responses have been tallied for this role yet."}
        </div>
      )}
    </div>
  );
}

function ChoiceRoleBlock({
  question,
  role,
  weightingMode,
  result,
}: {
  question: SurveyQuestion;
  role: ResponderRole;
  weightingMode: SurveyWeightingMode | null;
  result: ProposalSurveyMethodResult | null;
}) {
  const choiceResult = parseChoiceMethodResult(result);
  const items = buildLegendItems(question, choiceResult);
  const segments = buildChoiceSegments(items);
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex min-w-0 w-full flex-col items-center gap-3 sm:w-[240px]">
      <div className="flex w-full items-center justify-center">
        <VoteProgress
          title={ROLE_LABELS[role]}
          segments={segments}
          valueUnit={weightingMode === "CredentialBased" ? "count" : "ada"}
          className="shrink-0"
          fixedWidth={240}
          showTooltip
          animate={false}
          interactive
          centerText={total > 0 ? formatCenterValue(total, weightingMode) : undefined}
        />
      </div>
    </div>
  );
}

function NumericRangeRoleCard({
  question,
  role,
  weightingMode,
  result,
  isGame,
}: {
  question: SurveyQuestion;
  role: ResponderRole;
  weightingMode: SurveyWeightingMode | null;
  result: ProposalSurveyMethodResult | null;
  isGame: boolean;
}) {
  const numericResult = parseNumericMethodResult(result);
  const constraints = question.numericConstraints;
  const hasResponses = (numericResult?.count ?? 0) > 0 && constraints;
  const numericMean = numericResult?.mean ?? null;
  const rangeSpan =
    constraints && constraints.maxValue > constraints.minValue
      ? constraints.maxValue - constraints.minValue
      : 0;
  const meanPosition =
    hasResponses && numericMean !== null && rangeSpan > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((numericMean - constraints.minValue) / rangeSpan) * 100
          )
        )
      : 0;

  return (
    <SummaryCard
      role={role}
      weightingMode={weightingMode}
      isGame={isGame}
      rows={
        hasResponses
          ? [
              {
                label: "Count",
                value: integerFormatter.format(numericResult?.count ?? 0),
              },
              {
                label: "Min",
                value: formatNumericValue(numericResult?.min ?? null),
              },
              {
                label: "Max",
                value: formatNumericValue(numericResult?.max ?? null),
              },
              {
                label: "Mean",
                value: formatNumericValue(numericResult?.mean ?? null),
              },
            ]
          : []
      }
      emptyMessage={
        constraints
          ? "No valid numeric responses have been tallied for this role yet."
          : "This numeric question is missing its configured range."
      }
    >
      {hasResponses && constraints ? (
        <div className="mt-4 space-y-3">
          <div className="relative px-1">
            <div
              className={cn(
                "h-2 rounded-full",
                isGame
                  ? "bg-white/15"
                  : "bg-muted dark:bg-[#0bd1a2]/15"
              )}
            />
            <div
              className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 bg-background shadow-sm"
              style={{
                left: `${meanPosition}%`,
                borderColor: isGame ? "#ffffff" : "#0f172a",
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatNumericValue(constraints.minValue)}</span>
            <span
              className={cn(
                "font-medium",
                isGame ? "text-white" : "text-foreground dark:text-[#0bd1a2]"
              )}
            >
              Mean {formatNumericValue(numericResult?.mean ?? null)}
            </span>
            <span>{formatNumericValue(constraints.maxValue)}</span>
          </div>
        </div>
      ) : null}
    </SummaryCard>
  );
}

export function LinkedSurveyPanel({
  survey,
  tally,
  isSurveyLoading = false,
  isTallyLoading = false,
  surveyError,
  tallyError,
  isGame = false,
}: LinkedSurveyPanelProps) {
  const cardClass = cn(
    "overflow-hidden p-6",
    isGame
      ? "game-detail-card"
      : "rounded-2xl border border-border/40 bg-card shadow-elevation-2 dark:border-[#0bd1a2] dark:bg-transparent dark:shadow-none"
  );

  const applicableRoles = getApplicableRoles(survey, tally);
  const questions = survey?.surveyDetails?.questions ?? [];
  const defaultQuestionTab = questions[0]?.questionId;

  return (
    <Card className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={cn("text-lg font-semibold", isGame && "text-white")}>
            Linked Survey
          </h3>
          {survey?.linked && tally ? (
            <div className="mt-2">
              <Badge
                variant={getTallyPhaseTone(tally.phase)}
                className="rounded-none"
              >
                {getTallyPhaseLabel(tally.phase, tally.finalizationEpoch)}
              </Badge>
            </div>
          ) : null}
          {survey?.surveyDetails?.title ? (
            <div className="mt-1">
              <div className="text-sm font-medium">
                {survey.surveyDetails.title}
              </div>
              {survey.surveyDetails.description ? (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {survey.surveyDetails.description}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        {survey?.surveyTxId ? (
          <Badge variant="outline" className="rounded-none font-mono text-2xs">
            {survey.surveyTxId.slice(0, 10)}...
          </Badge>
        ) : null}
      </div>

      {isSurveyLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading linked survey…</p>
      ) : surveyError ? (
        <p className="mt-4 text-sm text-destructive">{surveyError}</p>
      ) : !survey?.linked ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No linked survey is attached to this governance action.
        </p>
      ) : !survey.surveyDetails || questions.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Linked survey details are not available for display yet.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {!survey.linkValidation.valid && survey.linkValidation.errors.length > 0 ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {survey.linkValidation.errors.join(" ")}
            </div>
          ) : null}

          {!survey.surveyDetailsValidation.valid &&
          survey.surveyDetailsValidation.errors.length > 0 ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {survey.surveyDetailsValidation.errors.join(" ")}
            </div>
          ) : null}

          {tallyError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {tallyError}
            </div>
          ) : null}

          {tally?.errors?.length ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {tally.errors.join(" ")}
            </div>
          ) : null}

          {tally?.warnings?.length ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              {tally.warnings.join(" ")}
            </div>
          ) : null}

          <Tabs defaultValue={defaultQuestionTab} className="w-full">
            <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
              {questions.map((question, index) => (
                <TabsTrigger
                  key={question.questionId}
                  value={question.questionId}
                  className={cn(
                    isGame
                      ? "game-tab-btn data-[state=active]:game-tab-btn-active text-2xs sm:text-xs"
                      : "rounded-md border border-border/40 bg-white px-2 py-1 text-2xs font-semibold uppercase tracking-wide text-black shadow-elevation-2 transition-transform transition-shadow duration-normal ease-in-out hover:scale-101 hover:shadow-elevation-3 data-[state=active]:bg-black data-[state=active]:text-white sm:px-3 sm:py-1.5 sm:text-xs dark:rounded-none dark:border-[#0bd1a2] dark:bg-transparent dark:text-[#0bd1a2] dark:shadow-none dark:data-[state=active]:bg-[#0bd1a2] dark:data-[state=active]:text-black dark:hover:bg-[#0bd1a2] dark:hover:text-black whitespace-nowrap btn-neon"
                  )}
                >
                  Question {index + 1}
                </TabsTrigger>
              ))}
            </TabsList>

            {questions.map((question) => (
              <TabsContent
                key={question.questionId}
                value={question.questionId}
                className="mt-4 space-y-4"
              >
                <div className="text-base font-semibold">{question.question}</div>

                {question.methodType === BUILTIN_SURVEY_METHODS.singleChoice ||
                question.methodType === BUILTIN_SURVEY_METHODS.multiSelect ? (
                  <div
                    className={cn(
                      "flex flex-wrap items-start gap-6",
                      isGame ? "md:gap-4" : "md:gap-6"
                    )}
                  >
                    {applicableRoles.map((role) => (
                      <ChoiceRoleBlock
                        key={`${question.questionId}-${role}`}
                        question={question}
                        role={role}
                        weightingMode={getRoleWeightingMode(role, survey, tally)}
                        result={getMethodResult(role, question.questionId, tally)}
                      />
                    ))}
                  </div>
                ) : question.methodType === BUILTIN_SURVEY_METHODS.numericRange ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {applicableRoles.map((role) => (
                      <NumericRangeRoleCard
                        key={`${question.questionId}-${role}`}
                        question={question}
                        role={role}
                        weightingMode={getRoleWeightingMode(role, survey, tally)}
                        result={getMethodResult(role, question.questionId, tally)}
                        isGame={isGame}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {applicableRoles.map((role) => {
                      const customResult = parseCustomMethodResult(
                        getMethodResult(role, question.questionId, tally)
                      );

                      const rows = Object.entries(
                        customResult?.customValueTotals ?? {}
                      ).map(([value, total]) => ({
                        label: formatCustomValue(value),
                        value: formatWeightedValue(
                          total,
                          getRoleWeightingMode(role, survey, tally)
                        ),
                      }));

                      return (
                        <SummaryCard
                          key={`${question.questionId}-${role}`}
                          role={role}
                          weightingMode={getRoleWeightingMode(role, survey, tally)}
                          rows={rows}
                          emptyMessage="No valid responses have been tallied for this role yet."
                          isGame={isGame}
                        />
                      );
                    })}
                  </div>
                )}

                {isTallyLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading survey tally…
                  </p>
                ) : null}

                {!isTallyLoading && applicableRoles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No survey results are available yet.
                  </p>
                ) : null}

                {isCustomSurveyMethod(question.methodType) ? (
                  <p className="text-xs text-muted-foreground">
                    This question uses a custom method, so `cgov` displays the tallied values as summary cards instead of donuts.
                  </p>
                ) : null}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}
    </Card>
  );
}
