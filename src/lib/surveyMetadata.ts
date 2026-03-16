import type {
  ProposalSurveyResponse,
  ResponderRole,
  SurveyDetails,
  SurveyQuestion,
  SurveyResponseAnswer,
  SurveyResponsePayload,
} from "@/types/governance";

export const SURVEY_SPEC_VERSION = "1.0.0";
export const SURVEY_METADATA_LABEL = 17;
export const SURVEY_LINK_KIND = "cardano-governance-survey-link";
export const BUILTIN_SURVEY_METHODS = {
  singleChoice: "urn:cardano:poll-method:single-choice:v1",
  multiSelect: "urn:cardano:poll-method:multi-select:v1",
  numericRange: "urn:cardano:poll-method:numeric-range:v1",
} as const;

export const SUPPORTED_SURVEY_METHODS = new Set<string>(
  Object.values(BUILTIN_SURVEY_METHODS)
);
export const SUPPORTED_SURVEY_RESPONSE_ROLE: ResponderRole = "DRep";

type SurveyEnvelope = {
  [SURVEY_METADATA_LABEL]?: {
    msg?: unknown;
    surveyDetails?: unknown;
    surveyResponse?: unknown;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRole(value: unknown): value is ResponderRole {
  return value === "DRep" || value === "SPO" || value === "CC" || value === "Stakeholder";
}

export function isBuiltInSurveyMethod(methodType: string): boolean {
  return SUPPORTED_SURVEY_METHODS.has(methodType);
}

export function isCustomSurveyMethod(methodType: string): boolean {
  return !isBuiltInSurveyMethod(methodType);
}

export function parseSurveyLinkAnchor(
  anchor: unknown
): { kind?: string; specVersion?: string; surveyTxId?: string } | null {
  if (!isRecord(anchor)) return null;
  return {
    kind: typeof anchor.kind === "string" ? anchor.kind : undefined,
    specVersion:
      typeof anchor.specVersion === "string" ? anchor.specVersion : undefined,
    surveyTxId: typeof anchor.surveyTxId === "string" ? anchor.surveyTxId : undefined,
  };
}

function normalizeMetadataText(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.join("");
  }

  return null;
}

function normalizeSurveyQuestion(question: unknown): SurveyQuestion | null {
  if (!isRecord(question)) return null;

  const questionId = normalizeMetadataText(question.questionId);
  const prompt = normalizeMetadataText(question.question);
  const methodType = normalizeMetadataText(question.methodType);
  if (!questionId || !prompt || !methodType) {
    return null;
  }

  let options: string[] | undefined;
  if (question.options !== undefined) {
    if (!Array.isArray(question.options)) return null;
    options = [];
    for (const option of question.options) {
      const normalizedOption = normalizeMetadataText(option);
      if (normalizedOption === null) return null;
      options.push(normalizedOption);
    }
  }

  let numericConstraints: SurveyQuestion["numericConstraints"] | undefined;
  if (question.numericConstraints !== undefined) {
    if (!isRecord(question.numericConstraints)) return null;
    const minValue = question.numericConstraints.minValue;
    const maxValue = question.numericConstraints.maxValue;
    const step = question.numericConstraints.step;
    if (
      typeof minValue !== "number" ||
      typeof maxValue !== "number" ||
      !Number.isInteger(minValue) ||
      !Number.isInteger(maxValue) ||
      (step !== undefined &&
        (typeof step !== "number" || !Number.isInteger(step)))
    ) {
      return null;
    }

    numericConstraints = {
      minValue: minValue as number,
      maxValue: maxValue as number,
      ...(step !== undefined ? { step: step as number } : {}),
    };
  }

  const methodSchemaUri = normalizeMetadataText(question.methodSchemaUri);
  const methodSchemaHash = normalizeMetadataText(question.methodSchemaHash);

  return {
    questionId,
    question: prompt,
    methodType,
    ...(options !== undefined ? { options } : {}),
    ...(Number.isInteger(question.maxSelections)
      ? { maxSelections: question.maxSelections as number }
      : {}),
    ...(numericConstraints ? { numericConstraints } : {}),
    ...(methodSchemaUri ? { methodSchemaUri } : {}),
    ...(methodSchemaHash ? { methodSchemaHash } : {}),
  };
}

export function normalizeSurveyDetails(
  value: unknown
): SurveyDetails | null {
  if (!isRecord(value)) return null;

  const specVersion = normalizeMetadataText(value.specVersion);
  const title = normalizeMetadataText(value.title);
  const description = normalizeMetadataText(value.description);
  if (!specVersion || !title || !description) {
    return null;
  }

  if (!Array.isArray(value.questions)) return null;
  const questions: SurveyQuestion[] = [];
  for (const question of value.questions) {
    const normalizedQuestion = normalizeSurveyQuestion(question);
    if (!normalizedQuestion) return null;
    questions.push(normalizedQuestion);
  }

  if (!isRecord(value.roleWeighting)) return null;
  const roleWeighting: SurveyDetails["roleWeighting"] = {};
  for (const [role, weightingMode] of Object.entries(value.roleWeighting)) {
    const normalizedWeightingMode = normalizeMetadataText(weightingMode);
    if (
      isRole(role) &&
      (normalizedWeightingMode === "CredentialBased" ||
        normalizedWeightingMode === "StakeBased" ||
        normalizedWeightingMode === "PledgeBased")
    ) {
      roleWeighting[role] = normalizedWeightingMode;
    } else {
      return null;
    }
  }

  const endEpoch = value.endEpoch;
  if (
    typeof endEpoch !== "number" ||
    !Number.isInteger(endEpoch) ||
    endEpoch < 0
  ) {
    return null;
  }

  return {
    specVersion,
    title,
    description,
    questions,
    roleWeighting,
    endEpoch: endEpoch as number,
  };
}

export function normalizeProposalSurveyResponse(
  survey: ProposalSurveyResponse | null | undefined
): ProposalSurveyResponse | null {
  if (!survey) return null;
  return {
    ...survey,
    surveyDetails: normalizeSurveyDetails(survey.surveyDetails),
  };
}

export function extractSurveyDetailsEnvelope(metadata: unknown): SurveyDetails | null {
  if (!isRecord(metadata)) return null;
  const envelope = metadata as SurveyEnvelope;
  const details = envelope[SURVEY_METADATA_LABEL]?.surveyDetails;
  return normalizeSurveyDetails(details);
}

export function extractSurveyResponseEnvelope(
  metadata: unknown
): SurveyResponsePayload | null {
  if (!isRecord(metadata)) return null;
  const envelope = metadata as SurveyEnvelope;
  const response = envelope[SURVEY_METADATA_LABEL]?.surveyResponse;
  return isSurveyResponsePayload(response) ? response : null;
}

function isSurveyResponseAnswer(value: unknown): value is SurveyResponseAnswer {
  if (!isRecord(value) || typeof value.questionId !== "string") return false;
  const keys = ["selection", "numericValue", "customValue"].filter(
    (key) => value[key] !== undefined
  );
  if (keys.length !== 1) return false;

  if (value.selection !== undefined) {
    return (
      Array.isArray(value.selection) &&
      value.selection.every(
        (item) => Number.isInteger(item) && (item as number) >= 0
      )
    );
  }

  if (value.numericValue !== undefined) {
    return Number.isInteger(value.numericValue);
  }

  return true;
}

function isSurveyResponsePayload(value: unknown): value is SurveyResponsePayload {
  if (!isRecord(value)) return false;
  return (
    value.specVersion === SURVEY_SPEC_VERSION &&
    typeof value.surveyTxId === "string" &&
    isRole(value.responderRole) &&
    Array.isArray(value.answers) &&
    value.answers.every(isSurveyResponseAnswer)
  );
}

function validateSingleChoiceAnswer(
  question: SurveyQuestion,
  answer: SurveyResponseAnswer
): string | null {
  if (!Array.isArray(answer.selection)) {
    return `Question "${question.question}" requires a single option selection.`;
  }
  if (answer.selection.length !== 1) {
    return `Question "${question.question}" requires exactly one selected option.`;
  }
  const optionCount = question.options?.length ?? 0;
  const index = answer.selection[0];
  if (index < 0 || index >= optionCount) {
    return `Question "${question.question}" has an out-of-range answer index.`;
  }
  return null;
}

function validateMultiSelectAnswer(
  question: SurveyQuestion,
  answer: SurveyResponseAnswer
): string | null {
  if (!Array.isArray(answer.selection)) {
    return `Question "${question.question}" requires an option selection array.`;
  }
  const optionCount = question.options?.length ?? 0;
  if (answer.selection.some((index) => index < 0 || index >= optionCount)) {
    return `Question "${question.question}" has an out-of-range answer index.`;
  }
  const limit = question.maxSelections ?? question.options?.length ?? 0;
  if (answer.selection.length > limit) {
    return `Question "${question.question}" exceeds the maximum number of selections.`;
  }
  return null;
}

function validateNumericRangeAnswer(
  question: SurveyQuestion,
  answer: SurveyResponseAnswer
): string | null {
  const numericValue = answer.numericValue;
  if (typeof numericValue !== "number" || !Number.isInteger(numericValue)) {
    return `Question "${question.question}" requires an integer response.`;
  }
  const constraints = question.numericConstraints;
  if (!constraints) {
    return `Question "${question.question}" is missing numeric constraints.`;
  }
  if (
    numericValue < constraints.minValue ||
    numericValue > constraints.maxValue
  ) {
    return `Question "${question.question}" is outside the permitted numeric range.`;
  }
  if (
    constraints.step &&
    ((numericValue - constraints.minValue) % constraints.step !== 0)
  ) {
    return `Question "${question.question}" does not match the required numeric step.`;
  }
  return null;
}

export function validateSurveyDetails(details: SurveyDetails | null | undefined): string[] {
  const normalizedDetails = normalizeSurveyDetails(details);
  if (!normalizedDetails) {
    return ["Survey details payload does not match the pinned CIP-0179 shape."];
  }

  const errors: string[] = [];
  const questionIds = new Set<string>();
  for (const question of normalizedDetails.questions) {
    if (questionIds.has(question.questionId)) {
      errors.push(`Question id "${question.questionId}" is duplicated.`);
    }
    questionIds.add(question.questionId);

    if (question.methodType === BUILTIN_SURVEY_METHODS.singleChoice) {
      if (!Array.isArray(question.options) || question.options.length < 2) {
        errors.push(`Question "${question.question}" must provide at least two options.`);
      }
      if (question.maxSelections !== undefined && question.maxSelections !== 1) {
        errors.push(
          `Question "${question.question}" must not set maxSelections above 1.`
        );
      }
    } else if (question.methodType === BUILTIN_SURVEY_METHODS.multiSelect) {
      if (!Array.isArray(question.options) || question.options.length < 2) {
        errors.push(`Question "${question.question}" must provide at least two options.`);
      }
      if (
        !Number.isInteger(question.maxSelections) ||
        (question.maxSelections ?? 0) <= 0 ||
        (question.options && (question.maxSelections ?? 0) > question.options.length)
      ) {
        errors.push(
          `Question "${question.question}" requires maxSelections between 1 and the number of options.`
        );
      }
    } else if (question.methodType === BUILTIN_SURVEY_METHODS.numericRange) {
      if (!question.numericConstraints) {
        errors.push(`Question "${question.question}" requires numeric constraints.`);
      } else if (
        question.numericConstraints.step !== undefined &&
        question.numericConstraints.step <= 0
      ) {
        errors.push(`Question "${question.question}" requires a positive numeric step.`);
      }
    } else if (!question.methodSchemaUri || !question.methodSchemaHash) {
      errors.push(
        `Custom question "${question.question}" must define methodSchemaUri and methodSchemaHash.`
      );
    }
  }

  return errors;
}

export function validateSurveyResponse(
  survey: ProposalSurveyResponse | null | undefined,
  response: SurveyResponsePayload
): string[] {
  const errors: string[] = [];

  if (!isSurveyResponsePayload(response)) {
    return ["Survey response payload does not match the pinned CIP-0179 shape."];
  }

  const surveyDetails = normalizeSurveyDetails(survey?.surveyDetails);
  if (!surveyDetails) {
    errors.push("Linked survey details are unavailable.");
    return errors;
  }

  const surveyErrors = validateSurveyDetails(surveyDetails);
  if (surveyErrors.length) {
    return surveyErrors;
  }

  if (response.specVersion !== SURVEY_SPEC_VERSION) {
    errors.push("Survey response uses an unsupported spec version.");
  }

  if (survey?.surveyTxId && response.surveyTxId !== survey.surveyTxId) {
    errors.push("Survey response does not target the linked survey transaction.");
  }

  if (
    survey?.linkValidation.linkedRoleWeighting &&
    !survey.linkValidation.linkedRoleWeighting[response.responderRole]
  ) {
    errors.push(
      `The linked survey does not accept responses from the ${response.responderRole} role.`
    );
  } else if (!surveyDetails.roleWeighting[response.responderRole]) {
    errors.push(
      `The linked survey does not define weighting for the ${response.responderRole} role.`
    );
  }

  const seenQuestionIds = new Set<string>();
  const questionMap = new Map<string, SurveyQuestion>(
    surveyDetails.questions.map((question) => [question.questionId, question])
  );

  for (const answer of response.answers) {
    if (seenQuestionIds.has(answer.questionId)) {
      errors.push(`Question "${answer.questionId}" appears more than once in the response.`);
      continue;
    }
    seenQuestionIds.add(answer.questionId);

    const question = questionMap.get(answer.questionId);
    if (!question) {
      errors.push(`Question "${answer.questionId}" does not exist in the linked survey.`);
      continue;
    }

    const answerRecord = answer as unknown as Record<string, unknown>;
    const answerKeys = ["selection", "numericValue", "customValue"].filter(
      (key) => answerRecord[key] !== undefined
    );
    if (answerKeys.length !== 1) {
      errors.push(`Question "${question.question}" must use exactly one answer value.`);
      continue;
    }

    if (question.methodType === BUILTIN_SURVEY_METHODS.singleChoice) {
      const error = validateSingleChoiceAnswer(question, answer);
      if (error) errors.push(error);
      continue;
    }

    if (question.methodType === BUILTIN_SURVEY_METHODS.multiSelect) {
      const error = validateMultiSelectAnswer(question, answer);
      if (error) errors.push(error);
      continue;
    }

    if (question.methodType === BUILTIN_SURVEY_METHODS.numericRange) {
      const error = validateNumericRangeAnswer(question, answer);
      if (error) errors.push(error);
      continue;
    }

    if (answer.customValue === undefined) {
      errors.push(
        `Custom question "${question.question}" requires a customValue response.`
      );
    }
  }

  return errors;
}

export function buildSurveyResponseMetadata(
  response: SurveyResponsePayload
): Record<number, { surveyResponse: SurveyResponsePayload }> {
  return {
    [SURVEY_METADATA_LABEL]: {
      surveyResponse: response,
    },
  };
}
