import { blake2b } from "@noble/hashes/blake2.js";
import type {
  ContentAnchor,
  OptionsOrCount,
  Question,
  RatingScale,
  SurveyDefinition,
} from "cip-179";

const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];

export const MAX_RENDERED_SURVEY_ITEMS = 100;

export function getRenderabilityProblem(
  definition: SurveyDefinition
): string | null {
  if (definition.questions.length > MAX_RENDERED_SURVEY_ITEMS) {
    return `Survey has more than ${MAX_RENDERED_SURVEY_ITEMS} questions.`;
  }
  const optionsIndex = definition.questions.findIndex(
    (question) =>
      "options" in question &&
      (question.options.type === "options"
        ? question.options.labels.length
        : question.options.count) > MAX_RENDERED_SURVEY_ITEMS
  );
  if (optionsIndex >= 0) {
    return `Question ${optionsIndex + 1} has more than ${MAX_RENDERED_SURVEY_ITEMS} options.`;
  }
  const ratingIndex = definition.questions.findIndex(
    (question) =>
      question.type === "rating" &&
      question.scale.type !== "numeric" &&
      (question.scale.type === "labels"
        ? question.scale.labels.length
        : question.scale.count) > MAX_RENDERED_SURVEY_ITEMS
  );
  return ratingIndex >= 0
    ? `Question ${ratingIndex + 1} has more than ${MAX_RENDERED_SURVEY_ITEMS} rating levels.`
    : null;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function verifiedBytes(url: string, expected: Uint8Array): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!equalBytes(blake2b(bytes, { dkLen: 32 }), expected)) {
    throw new Error("Content hash does not match the on-chain anchor.");
  }
  return bytes;
}

export async function fetchAnchorJson(anchor: ContentAnchor): Promise<unknown> {
  let bytes: Uint8Array | null = null;
  if (anchor.uri.startsWith("https://")) {
    bytes = await verifiedBytes(anchor.uri, anchor.hash);
  } else if (anchor.uri.startsWith("ipfs://")) {
    for (const gateway of IPFS_GATEWAYS) {
      try {
        bytes = await verifiedBytes(gateway + anchor.uri.slice(7), anchor.hash);
        break;
      } catch {
        // Try the next public gateway.
      }
    }
  } else {
    throw new Error("Only HTTPS and IPFS content anchors are supported.");
  }
  if (!bytes) throw new Error("No IPFS gateway returned verified content.");
  return JSON.parse(new TextDecoder().decode(bytes));
}

function strings(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

function fillOptions(options: OptionsOrCount, labels: string[] | undefined): OptionsOrCount {
  return options.type === "count" && labels?.length === options.count
    ? { type: "options", labels }
    : options;
}

function fillScale(scale: RatingScale, labels: string[] | undefined): RatingScale {
  return scale.type === "count" && labels?.length === scale.count
    ? { type: "labels", labels }
    : scale;
}

export function applyPresentation(definition: SurveyDefinition, value: unknown): SurveyDefinition {
  if (!value || typeof value !== "object") throw new Error("Presentation is not an object.");
  const document = value as Record<string, unknown>;
  if (document.kind !== "cardano-survey-presentation" || document.specVersion !== 5) {
    throw new Error("Presentation is not a CIP-179 v5 presentation document.");
  }
  const presentations = Array.isArray(document.questions) ? document.questions : [];
  const questions = definition.questions.map((question, index): Question => {
    const raw = presentations[index];
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const prompt = question.prompt.trim() === "" && typeof item.prompt === "string"
      ? item.prompt
      : question.prompt;
    if (question.type === "custom" || question.type === "numericRange") return { ...question, prompt };
    if (question.type === "rating") {
      return {
        ...question,
        prompt,
        options: fillOptions(question.options, strings(item.options)),
        scale: fillScale(question.scale, strings(item.ratingLabels)),
      };
    }
    return { ...question, prompt, options: fillOptions(question.options, strings(item.options)) };
  });
  return {
    ...definition,
    title: definition.title.trim() === "" && typeof document.title === "string" ? document.title : definition.title,
    description: definition.description.trim() === "" && typeof document.description === "string" ? document.description : definition.description,
    questions,
  };
}

export function schemaAcceptsText(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const schema = value as Record<string, unknown>;
  return schema.type === "string" ||
    (Array.isArray(schema.type) && schema.type.includes("string"));
}
