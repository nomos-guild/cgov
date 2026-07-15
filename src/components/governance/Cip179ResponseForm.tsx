import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { AnswerItem, Question, SurveyDefinition } from "cip-179";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchAnchorJson, schemaAcceptsText } from "@/lib/cip179Content";
import { cn } from "@/lib/utils";

type Draft =
  | { type: "singleChoice"; optionIndex: number }
  | { type: "multiSelect"; optionIndices: number[] }
  | { type: "ranking"; ranking: number[] }
  | { type: "numeric"; value: string }
  | { type: "pointsAllocation"; points: string[] }
  | { type: "rating"; ratings: Array<string | null> }
  | { type: "custom"; value: string };

interface Props {
  definition: SurveyDefinition;
  disabled?: boolean;
  onAnswersChange: (answers: AnswerItem[] | null) => void;
}

function optionLabels(question: Question): string[] {
  if (!("options" in question)) return [];
  return question.options.type === "options"
    ? [...question.options.labels]
    : Array.from({ length: question.options.count }, (_, index) => `Option ${index + 1}`);
}

function ratingValues(question: Extract<Question, { type: "rating" }>): Array<{ value: bigint; label: string }> {
  if (question.scale.type === "labels") {
    return question.scale.labels.map((label, index) => ({ value: BigInt(index), label }));
  }
  if (question.scale.type === "count") {
    return Array.from({ length: question.scale.count }, (_, index) => ({ value: BigInt(index), label: String(index + 1) }));
  }
  return [];
}

export function answerFor(question: Question, index: number, draft: Draft | undefined): AnswerItem | null | false {
  if (!draft) return question.required ? false : null;
  switch (question.type) {
    case "singleChoice":
      return draft.type === "singleChoice"
        ? { type: "singleChoice", questionIndex: index, optionIndex: draft.optionIndex }
        : false;
    case "multiSelect":
      return draft.type === "multiSelect" && draft.optionIndices.length >= question.minSelections && draft.optionIndices.length <= question.maxSelections
        ? { type: "multiSelect", questionIndex: index, optionIndices: draft.optionIndices }
        : false;
    case "ranking":
      return draft.type === "ranking" && draft.ranking.length >= question.minRanked && draft.ranking.length <= question.maxRanked
        ? { type: "ranking", questionIndex: index, ranking: draft.ranking }
        : false;
    case "numericRange": {
      if (draft.type !== "numeric" || !/^-?\d+$/.test(draft.value)) return false;
      const value = BigInt(draft.value);
      const step = question.constraints.step;
      return value >= question.constraints.min && value <= question.constraints.max && (!step || (value - question.constraints.min) % step === BigInt(0))
        ? { type: "numeric", questionIndex: index, value }
        : false;
    }
    case "pointsAllocation": {
      if (draft.type !== "pointsAllocation" || draft.points.some((points) => !/^\d+$/.test(points))) return false;
      const exactPoints = draft.points.map(BigInt);
      if (exactPoints.some((value) => value > BigInt(question.budget))) return false;
      const points = exactPoints.map(Number);
      return exactPoints.reduce((sum, value) => sum + value, BigInt(0)) === BigInt(question.budget)
        ? {
            type: "pointsAllocation",
            questionIndex: index,
            allocations: points.flatMap((value, optionIndex) => value > 0 ? [{ optionIndex, points: value }] : []),
          }
        : false;
    }
    case "rating": {
      if (draft.type !== "rating") return false;
      if (draft.ratings.some((value) => value !== null && !/^-?\d+$/.test(value))) return false;
      const ratings = draft.ratings.flatMap((value, optionIndex) =>
        value === null ? [] : [{ optionIndex, rating: BigInt(value) }]
      );
      const validRating = ({ rating }: { rating: bigint }) => {
        if (question.scale.type === "labels") return rating >= BigInt(0) && rating < BigInt(question.scale.labels.length);
        if (question.scale.type === "count") return rating >= BigInt(0) && rating < BigInt(question.scale.count);
        const { min, max, step } = question.scale.constraints;
        return rating >= min && rating <= max && (!step || (rating - min) % step === BigInt(0));
      };
      return ratings.length > 0 && (!question.requireAll || ratings.length === draft.ratings.length)
        && ratings.every(validRating)
        ? { type: "rating", questionIndex: index, ratings }
        : false;
    }
    case "custom":
      return draft.type === "custom" && draft.value.trim() && new TextEncoder().encode(draft.value.trim()).length <= 64
        ? { type: "custom", questionIndex: index, value: draft.value.trim() }
        : false;
  }
}

export function Cip179ResponseForm({ definition, disabled = false, onAnswersChange }: Props) {
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [customText, setCustomText] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setDrafts({});
    setCustomText({});
    definition.questions.forEach((question, index) => {
      if (question.type !== "custom") return;
      void fetchAnchorJson(question.methodSchema)
        .then((schema) => setCustomText((current) => ({ ...current, [index]: schemaAcceptsText(schema) })))
        .catch(() => setCustomText((current) => ({ ...current, [index]: false })));
    });
  }, [definition]);

  const answers = useMemo(() => {
    const result: AnswerItem[] = [];
    for (let index = 0; index < definition.questions.length; index += 1) {
      const answer = answerFor(definition.questions[index], index, drafts[index]);
      if (answer === false) return null;
      if (answer) result.push(answer);
    }
    return result;
  }, [definition, drafts]);

  useEffect(() => onAnswersChange(answers), [answers, onAnswersChange]);

  const update = (index: number, draft: Draft | undefined) => {
    setDrafts((current) => {
      const next = { ...current };
      if (draft) next[index] = draft;
      else delete next[index];
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {definition.questions.map((question, index) => {
        const labels = optionLabels(question);
        const draft = drafts[index];
        return (
          <div key={index} className="border border-border p-3">
            <div className="flex justify-between gap-3">
              <p className="text-sm font-medium">{index + 1}. {question.prompt}</p>
              {question.required ? <span className="text-xs text-destructive">Required</span> : null}
            </div>

            {question.type === "singleChoice" ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {labels.map((label, optionIndex) => (
                  <Button key={optionIndex} type="button" size="sm" variant={draft?.type === "singleChoice" && draft.optionIndex === optionIndex ? "secondary" : "outline"} disabled={disabled}
                    onClick={() => update(index, { type: "singleChoice", optionIndex })}>{label}</Button>
                ))}
              </div>
            ) : question.type === "multiSelect" ? (
              <div className="mt-2 space-y-1">
                {labels.map((label, optionIndex) => {
                  const selected = draft?.type === "multiSelect" ? draft.optionIndices : [];
                  return <label key={optionIndex} className="flex gap-2 text-sm"><input type="checkbox" checked={selected.includes(optionIndex)} disabled={disabled || (!selected.includes(optionIndex) && selected.length >= question.maxSelections)} onChange={(event) => update(index, { type: "multiSelect", optionIndices: event.target.checked ? [...selected, optionIndex].sort((left, right) => left - right) : selected.filter((value) => value !== optionIndex) })} />{label}</label>;
                })}
                <p className="text-xs text-muted-foreground">Choose {question.minSelections} to {question.maxSelections}.</p>
              </div>
            ) : question.type === "ranking" ? (
              <div className="mt-2 space-y-2">
                {labels.map((label, optionIndex) => {
                  const ranking = draft?.type === "ranking" ? draft.ranking : [];
                  const position = ranking.indexOf(optionIndex);
                  return <div key={optionIndex} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={position >= 0} disabled={disabled || (position < 0 && ranking.length >= question.maxRanked)} onChange={(event) => update(index, { type: "ranking", ranking: event.target.checked ? [...ranking, optionIndex] : ranking.filter((value) => value !== optionIndex) })} /><span className="flex-1">{position >= 0 ? `${position + 1}. ` : ""}{label}</span>{position >= 0 ? <><Button type="button" size="icon" variant="ghost" disabled={disabled || position === 0} onClick={() => { const next = [...ranking]; [next[position - 1], next[position]] = [next[position], next[position - 1]]; update(index, { type: "ranking", ranking: next }); }}><ChevronUp className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" disabled={disabled || position === ranking.length - 1} onClick={() => { const next = [...ranking]; [next[position + 1], next[position]] = [next[position], next[position + 1]]; update(index, { type: "ranking", ranking: next }); }}><ChevronDown className="h-4 w-4" /></Button></> : null}</div>;
                })}
              </div>
            ) : question.type === "numericRange" ? (
              <input className="mt-2 h-9 w-full border border-input bg-background px-3 text-sm" type="number" min={String(question.constraints.min)} max={String(question.constraints.max)} step={String(question.constraints.step ?? BigInt(1))} disabled={disabled} value={draft?.type === "numeric" ? draft.value : ""} onChange={(event) => update(index, { type: "numeric", value: event.target.value })} />
            ) : question.type === "pointsAllocation" ? (
              <div className="mt-2 space-y-2">{labels.map((label, optionIndex) => { const points = draft?.type === "pointsAllocation" ? draft.points : labels.map(() => "0"); return <label key={optionIndex} className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><input className="h-8 w-24 border border-input bg-background px-2" type="number" min={0} max={question.budget} step={1} disabled={disabled} value={points[optionIndex]} onChange={(event) => { const next = [...points]; next[optionIndex] = event.target.value; update(index, { type: "pointsAllocation", points: next }); }} /></label>; })}<p className={cn("text-xs", draft?.type === "pointsAllocation" && answerFor(question, index, draft) !== false ? "text-muted-foreground" : "text-amber-700")}>Allocate exactly {question.budget} points.</p></div>
            ) : question.type === "rating" ? (
              <div className="mt-2 space-y-2">{labels.map((label, optionIndex) => { const ratings = draft?.type === "rating" ? draft.ratings : labels.map(() => null); return <label key={optionIndex} className="flex items-center justify-between gap-3 text-sm"><span>{label}</span>{question.scale.type === "numeric" ? <input className="h-8 w-24 border border-input bg-background px-2" type="number" min={String(question.scale.constraints.min)} max={String(question.scale.constraints.max)} step={String(question.scale.constraints.step ?? BigInt(1))} disabled={disabled} value={ratings[optionIndex] ?? ""} onChange={(event) => { const next = [...ratings]; next[optionIndex] = event.target.value || null; update(index, { type: "rating", ratings: next }); }} /> : <select className="h-8 border border-input bg-background px-2" disabled={disabled} value={ratings[optionIndex] ?? ""} onChange={(event) => { const next = [...ratings]; next[optionIndex] = event.target.value || null; update(index, { type: "rating", ratings: next }); }}><option value="">Not rated</option>{ratingValues(question).map((value) => <option key={String(value.value)} value={String(value.value)}>{value.label}</option>)}</select>}</label>; })}</div>
            ) : customText[index] ? (
              <div className="mt-2 space-y-1">
                <Textarea disabled={disabled} value={draft?.type === "custom" ? draft.value : ""} onChange={(event) => update(index, { type: "custom", value: event.target.value })} />
                <p className="text-xs text-muted-foreground">Maximum 64 UTF-8 bytes.</p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">CGov can display this custom question, but its verified schema is not a text response schema.</p>
            )}

            {draft && !question.required ? <Button type="button" variant="ghost" size="sm" className="mt-2" disabled={disabled} onClick={() => update(index, undefined)}>Skip question</Button> : null}
          </div>
        );
      })}
      {answers === null ? <p className="text-xs text-amber-700">Complete all required questions and correct invalid values to attach this survey response.</p> : null}
    </div>
  );
}
