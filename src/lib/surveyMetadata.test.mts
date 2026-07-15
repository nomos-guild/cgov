import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import { Role, decodePayload, type SurveyDefinition } from "cip-179";
import {
  buildDrepResponse,
  encodeResponseMetadata,
  validateDrepResponse,
} from "./surveyMetadata";
import {
  applyPresentation,
  getRenderabilityProblem,
} from "./cip179Content";
import { answerFor } from "../components/governance/Cip179ResponseForm";

const definition: SurveyDefinition = {
  specVersion: 5,
  owner: { type: "key", keyHash: new Uint8Array(28) },
  title: "Public survey",
  description: "CIP-179 v5",
  eligibleRoles: [Role.DRep],
  endEpoch: 600,
  submissionMode: { type: "public" },
  questions: [
    {
      type: "singleChoice",
      prompt: "Choose",
      options: { type: "options", labels: ["A", "B"] },
      required: true,
    },
  ],
};

test("builds metadata that round-trips through the reusable codec", async () => {
  const survey = {
    linked: true,
    surveyRef: { txId: "ab".repeat(32), index: 2 },
    linkValidation: { valid: true, errors: [], linkedActions: [] },
    phase: "open" as const,
    bundle: {
      survey: {
        txHash: "ab".repeat(32),
        slot: 1,
        epochNo: 1,
        ref: { txId: new Uint8Array(32).fill(0xab), index: 2 },
        definition,
      },
      responses: [],
      cancellations: [],
      tip: { epoch: 1, slot: 1, time: 1, epochSlot: 1, govActionLifetime: 6 },
    },
  };
  const response = buildDrepResponse({
    survey,
    credential: { type: "key", keyHash: new Uint8Array(28).fill(1) },
    answers: [{ type: "singleChoice", questionIndex: 0, optionIndex: 1 }],
  });
  assert.deepEqual(validateDrepResponse(definition, response), []);
  assert.deepEqual(decodePayload(encodeResponseMetadata(response)), {
    type: "responses",
    responses: [response],
  });

  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
  const { MeshTxBuilder } = await import("@meshsdk/core");
  const builder = new MeshTxBuilder();
  builder.metadataValue(17, encodeResponseMetadata(response));
  const label17 = builder.meshTxBuilderBody.metadata.get(BigInt(17));
  assert.equal(Array.isArray(label17), true);
  assert.equal(Array.isArray((label17 as unknown[])[1]), true);
  const responseMap = ((label17 as unknown[])[1] as unknown[])[0];
  assert.equal(responseMap instanceof Map, true);
  assert.deepEqual(
    [...(responseMap as Map<unknown, unknown>).keys()],
    [BigInt(0), BigInt(1), BigInt(2), BigInt(3), BigInt(4)]
  );
});

test("applies only matching external presentation fields", () => {
  const external: SurveyDefinition = {
    ...definition,
    title: "",
    questions: [{
      type: "singleChoice",
      prompt: "",
      options: { type: "count", count: 2 },
    }],
  };
  const enriched = applyPresentation(external, {
    specVersion: 5,
    kind: "cardano-survey-presentation",
    title: "External title",
    description: "External description",
    questions: [{ prompt: "External prompt", options: ["One", "Two"] }],
  });
  assert.equal(enriched.title, "External title");
  assert.equal(enriched.questions[0].prompt, "External prompt");
  assert.deepEqual(
    enriched.questions[0].type === "singleChoice" ? enriched.questions[0].options : null,
    { type: "options", labels: ["One", "Two"] }
  );
});

test("rejects definitions that would create unbounded response controls", () => {
  assert.match(
    getRenderabilityProblem({
      ...definition,
      questions: [{
        type: "singleChoice",
        prompt: "Choose",
        options: { type: "count", count: 101 },
      }],
      contentAnchor: {
        uri: "https://example.com/presentation.json",
        hash: new Uint8Array(32),
      },
    }) ?? "",
    /more than 100 options/
  );
});

test("validates rating grids and points allocations without lossy parsing", () => {
  const rating = {
    type: "rating" as const,
    prompt: "Rate",
    options: { type: "options" as const, labels: ["A"] },
    scale: { type: "numeric" as const, constraints: { min: 100n, max: 1000n, step: 100n } },
    requireAll: false,
  };
  assert.deepEqual(answerFor(rating, 0, { type: "rating", ratings: ["1000"] }), {
    type: "rating",
    questionIndex: 0,
    ratings: [{ optionIndex: 0, rating: 1000n }],
  });
  assert.equal(answerFor(rating, 0, { type: "rating", ratings: ["150"] }), false);

  const points = {
    type: "pointsAllocation" as const,
    prompt: "Allocate",
    options: { type: "options" as const, labels: ["A", "B"] },
    budget: 10,
  };
  assert.equal(answerFor(points, 0, { type: "pointsAllocation", points: ["1.5", "8.5"] }), false);
  assert.deepEqual(answerFor(points, 0, { type: "pointsAllocation", points: ["3", "7"] }), {
    type: "pointsAllocation",
    questionIndex: 0,
    allocations: [{ optionIndex: 0, points: 3 }, { optionIndex: 1, points: 7 }],
  });
});
