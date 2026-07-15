import {
  Role,
  encodePayload,
  validateDefinition,
  validateResponse,
  type AnswerItem,
  type Credential,
  type Metadatum,
  type SurveyDefinition,
  type SurveyResponse,
} from "cip-179";
import { fromJsonSafe } from "cip-179/tally";
import type {
  ProposalSurveyResponse,
} from "@/types/governance";

export const SURVEY_METADATA_LABEL = 17;

export function normalizeProposalSurveyResponse(
  value: ProposalSurveyResponse | null | undefined
): ProposalSurveyResponse | null {
  if (!value) return null;
  return {
    ...value,
    bundle: value.bundle ? (fromJsonSafe(value.bundle) as ProposalSurveyResponse["bundle"]) : null,
  };
}

export function buildDrepResponse(params: {
  survey: ProposalSurveyResponse;
  credential: Credential;
  answers: AnswerItem[];
}): SurveyResponse {
  if (!params.survey.surveyRef) throw new Error("Linked survey reference is unavailable.");
  return {
    specVersion: 5,
    surveyRef: {
      txId: params.survey.bundle!.survey.ref.txId,
      index: params.survey.surveyRef.index,
    },
    role: Role.DRep,
    credential: params.credential,
    answers: { type: "public", answers: params.answers },
  };
}

export function validateDrepResponse(
  definition: SurveyDefinition,
  response: SurveyResponse
): string[] {
  return [...validateDefinition(definition), ...validateResponse(definition, response)];
}

export function encodeResponseMetadata(response: SurveyResponse): Metadatum {
  return encodePayload({ type: "responses", responses: [response] });
}
