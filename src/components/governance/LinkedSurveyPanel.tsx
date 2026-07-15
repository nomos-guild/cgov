import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Question, SurveyDefinition } from "cip-179";
import type { ArtifactQuestion, ArtifactRoleTally } from "cip-179/tally";
import type {
  ProposalSurveyResponse,
  ProposalSurveyTallyResponse,
} from "@/types/governance";
import { cn } from "@/lib/utils";
import { useCip179Presentation } from "@/hooks/useCip179Presentation";

interface LinkedSurveyPanelProps {
  survey: ProposalSurveyResponse | null;
  tally: ProposalSurveyTallyResponse | null;
  isSurveyLoading?: boolean;
  isTallyLoading?: boolean;
  surveyError?: string | null;
  tallyError?: string | null;
  isGame?: boolean;
}

const ROLE_NAMES: Record<number, string> = {
  0: "DReps",
  1: "SPOs",
  2: "Constitutional Committee",
  3: "Stakeholders",
  4: "Keyholders",
};

function labels(question: Question): string[] {
  if ("options" in question && question.options.type === "options") {
    return [...question.options.labels];
  }
  if (question.type === "rating" && question.scale.type === "labels") {
    return [...question.scale.labels];
  }
  const count = "options" in question && question.options.type === "count"
    ? question.options.count
    : 0;
  return Array.from({ length: count }, (_, index) => `Option ${index + 1}`);
}

function ResultRows({ result, question }: { result: ArtifactQuestion; question: Question }) {
  if (result.kind === "custom") {
    return <p className="text-sm text-muted-foreground">{result.answeredCount} responses</p>;
  }
  if (result.kind === "numeric") {
    return (
      <div className="space-y-1 text-sm">
        <p>{result.answeredCount} responses</p>
        {result.values.map((value) => (
          <div key={value.value} className="flex justify-between gap-4">
            <span>{value.value}</span><span>{value.count}</span>
          </div>
        ))}
      </div>
    );
  }
  if (result.kind === "options") {
    const names = labels(question);
    return (
      <div className="space-y-1 text-sm">
        {result.optionCounts.map((count, index) => (
          <div key={index} className="flex justify-between gap-4">
            <span>{names[index] ?? `Option ${index + 1}`}</span><span>{count}</span>
          </div>
        ))}
      </div>
    );
  }
  const names = labels(question);
  return (
    <div className="space-y-1 text-sm">
      {result.perOption.map((value, index) => (
        <div key={index} className="flex justify-between gap-4">
          <span>{names[index] ?? `Option ${index + 1}`}</span>
          <span>{value.count} responses</span>
        </div>
      ))}
    </div>
  );
}

function RoleResult({ role, question, questionIndex }: {
  role: ArtifactRoleTally;
  question: Question;
  questionIndex: number;
}) {
  const result = role.questions[questionIndex];
  if (!result) return null;
  return (
    <div className="border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{ROLE_NAMES[role.role] ?? `Role ${role.role}`}</span>
        <span className="text-xs text-muted-foreground">{role.responders.length} responders</span>
      </div>
      <ResultRows result={result} question={question} />
    </div>
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
  const source: SurveyDefinition | null = survey?.bundle?.survey.definition ?? null;
  const { definition, error: presentationError } = useCip179Presentation(source);
  const artifact = tally?.artifact ?? null;
  const cancellation = artifact?.tally.cancelled;
  const questions = definition?.questions ?? [];

  return (
    <Card className={cn("overflow-hidden p-6", isGame ? "game-detail-card" : "border border-border bg-card")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Linked Survey</h3>
          {definition ? <p className="mt-1 text-sm font-medium">{definition.title}</p> : null}
          {definition?.description ? <p className="mt-1 text-sm text-muted-foreground">{definition.description}</p> : null}
        </div>
        {survey?.surveyRef ? (
          <Badge variant="outline" className="font-mono text-2xs">
            {survey.surveyRef.txId.slice(0, 10)}:{survey.surveyRef.index}
          </Badge>
        ) : null}
      </div>

      {isSurveyLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading linked survey...</p>
      : surveyError ? <p className="mt-4 text-sm text-destructive">{surveyError}</p>
      : !survey?.linked ? <p className="mt-4 text-sm text-muted-foreground">No linked survey is attached.</p>
      : !survey.linkValidation.valid ? <p className="mt-4 text-sm text-destructive">{survey.linkValidation.errors.join(" ")}</p>
      : presentationError && !definition ? <p className="mt-4 text-sm text-destructive">The linked survey cannot be rendered: {presentationError}</p>
      : !definition ? <p className="mt-4 text-sm text-muted-foreground">The linked survey is still being indexed.</p>
      : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Ends epoch {definition.endEpoch}</Badge>
            <Badge variant="outline">{definition.submissionMode.type === "sealed" ? "Sealed" : "Public"}</Badge>
            <Badge variant={artifact ? "secondary" : "outline"}>
              {artifact ? "Finalized" : tally?.phase === "unsupported" ? "Results unsupported" : "Results pending"}
            </Badge>
          </div>
          {tallyError || tally?.errors.length ? (
            <p className="text-sm text-destructive">{tallyError ?? tally?.errors.join(" ")}</p>
          ) : null}
          {presentationError ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              External survey labels could not be verified: {presentationError}
            </p>
          ) : null}
          {isTallyLoading ? <p className="text-sm text-muted-foreground">Loading results...</p> : null}
          {cancellation ? (
            <p className="text-sm text-muted-foreground">
              This survey was cancelled in transaction {cancellation.txHash.slice(0, 12)}.
            </p>
          ) : artifact ? (
            <Tabs defaultValue="0">
              <TabsList className="h-auto flex-wrap justify-start">
                {questions.map((_, index) => <TabsTrigger key={index} value={String(index)}>Question {index + 1}</TabsTrigger>)}
              </TabsList>
              {questions.map((question, index) => (
                <TabsContent key={index} value={String(index)} className="space-y-3">
                  <h4 className="font-semibold">{question.prompt}</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    {artifact.tally.perRole.map((role) => (
                      <RoleResult key={role.role} role={role} question={question} questionIndex={index} />
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          ) : <p className="text-sm text-muted-foreground">Verified results will appear after the survey closes and finalization completes.</p>}
        </div>
      )}
    </Card>
  );
}
