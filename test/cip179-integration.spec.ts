import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, it, expect, vi } from "vitest";
import * as CSL from "@emurgo/cardano-serialization-lib-asmjs";
import { blake2b as nobleBlake2b } from "@noble/hashes/blake2.js";
const blake2b = (bytes: Uint8Array, _key: unknown, length: number) =>
  nobleBlake2b(bytes, { dkLen: length });
import { MeshTxBuilder } from "@meshsdk/core";
import { bech32 } from "bech32";
import { CredentialType, DRepID } from "@meshsdk/core-cst";
import {
  buildDrepResponse,
  encodeResponseMetadata,
  validateDrepResponse,
  SURVEY_METADATA_LABEL,
} from "../src/lib/surveyMetadata";
import {
  applyPresentation,
  schemaAcceptsText,
  fetchAnchorJson,
} from "../src/lib/cip179Content";
import { answerFor } from "../src/components/governance/Cip179ResponseForm";
function metadatum(value: CSL.TransactionMetadatum): any {
  switch (value.kind()) {
    case CSL.TransactionMetadatumKind.Int:
      return BigInt(value.as_int().to_str());
    case CSL.TransactionMetadatumKind.Text:
      return value.as_text();
    case CSL.TransactionMetadatumKind.Bytes:
      return value.as_bytes();
    case CSL.TransactionMetadatumKind.MetadataList: {
      const list = value.as_list();
      return Array.from({ length: list.len() }, (_, i) =>
        metadatum(list.get(i)),
      );
    }
    case CSL.TransactionMetadatumKind.MetadataMap: {
      const map = value.as_map(),
        keys = map.keys();
      return new Map(
        Array.from({ length: keys.len() }, (_, i) => [
          metadatum(keys.get(i)),
          metadatum(map.get(keys.get(i))!),
        ]),
      );
    }
  }
}

import { decodePayload } from "cip-179";

const sourcePath = "src/components/governance/VoteOnProposal.tsx";
const source = ts.createSourceFile(
  sourcePath,
  readFileSync(sourcePath, "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let callback: ts.Node | undefined;
function walk(node: ts.Node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.name.getText(source) === "submitVote"
  )
    callback = (node.initializer as ts.CallExpression).arguments[0];
  ts.forEachChild(node, walk);
}
walk(source);
if (!callback) throw new Error("PR submitVote callback was not found");
const js = ts.transpileModule("const callback = " + callback.getText(source), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.None,
  },
}).outputText;
const key = CSL.PrivateKey.from_normal_bytes(new Uint8Array(32).fill(7));
const keyHash = key.to_public().hash();
const address = CSL.EnterpriseAddress.new(
  0,
  CSL.Credential.from_keyhash(keyHash),
)
  .to_address()
  .to_bech32();
const definition: any = {
  specVersion: 5,
  owner: { type: "key", keyHash: keyHash.to_bytes() },
  title: "Audit",
  description: "Public",
  eligibleRoles: [0],
  endEpoch: 500,
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
const survey: any = {
  linked: true,
  surveyRef: { txId: "11".repeat(32), index: 0 },
  linkValidation: { valid: true, errors: [], linkedActions: [] },
  phase: "open",
  bundle: {
    survey: {
      ref: { txId: new Uint8Array(32).fill(0x11), index: 0 },
      definition,
    },
  },
};

async function runVote(
  answers: any,
  options: {
    survey?: any;
    definition?: any;
    decline?: boolean;
    voteOnly?: boolean;
  } = {},
) {
  let unsigned: CSL.Transaction | undefined,
    signed: CSL.Transaction | undefined;
  const states: any[] = [];
  const wallet = {
    getUtxos: vi.fn(async () => [
      {
        input: { txHash: "33".repeat(32), outputIndex: 0 },
        output: {
          address,
          amount: [{ unit: "lovelace", quantity: "100000000" }],
        },
      },
    ]),
    getChangeAddress: vi.fn(async () => address),
    getDRep: vi.fn(async () => ({
      dRepIDCip105: bech32.encode("drep", bech32.toWords(keyHash.to_bytes())),
    })),
    signTx: vi.fn(async (hex: string) => {
      if (options.decline) throw new Error("user declined");
      unsigned = CSL.Transaction.from_hex(hex);
      const witnesses = CSL.TransactionWitnessSet.new();
      const keys = CSL.Vkeywitnesses.new();
      keys.add(
        CSL.make_vkey_witness(
          CSL.TransactionHash.from_bytes(
            blake2b(unsigned.body().to_bytes(), undefined, 32),
          ),
          key,
        ),
      );
      witnesses.set_vkeys(keys);
      return CSL.Transaction.new(
        unsigned.body(),
        witnesses,
        unsigned.auxiliary_data(),
      ).to_hex();
    }),
    submitTx: vi.fn(async (hex: string) => {
      signed = CSL.Transaction.from_hex(hex);
      return "55".repeat(32);
    }),
  };
  const env = {
    wallet,
    selectedVote: "Yes",
    setVoteState: (state: any) => states.push(state),
    MeshTxBuilder,
    verifyDRepRole: async () => ({ exists: true, isRegistered: true }),
    toCip129DRepId: (id: string) => id,
    linkedSurvey: options.survey === undefined ? survey : options.survey,
    surveyDefinition: options.definition ?? definition,
    voteOnly: options.voteOnly ?? false,
    drepCanRespond: true,
    surveyAnswers: answers,
    DRepID,
    CredentialType,
    credentialHashBytes: (hash: string) =>
      Uint8Array.from(Buffer.from(hash, "hex")),
    buildDrepResponse,
    validateDrepResponse,
    encodeResponseMetadata,
    SURVEY_METADATA_LABEL,
    rationaleMode: "write",
    rationaleComment: "",
    rationaleJsonText: "",
    anchorUrl: "",
    txHash: "44".repeat(32),
    certIndex: 0,
    proposalId: "gov_action_fixture",
    API_ENDPOINTS: { voteFrontload: "https://fixture.invalid" },
    fetch: async () => ({ ok: true }),
    setTimeout: (fn: () => void) => {
      fn();
      return 0;
    },
    onVoteSubmitted: vi.fn(),
    closeModal: vi.fn(),
    console: { error: vi.fn(), log: vi.fn() },
    t: (s: string) => s,
  };
  const run = new Function(...Object.keys(env), js + ";return callback;")(
    ...Object.values(env),
  );
  await run();
  return { wallet, unsigned, signed, states };
}

describe("CGov actual vote callback, real Mesh coin selection and CBOR", () => {
  it("preserves native label-17 metadata, matching DRep vote, body hash and test signature", async () => {
    const r = await runVote([
      { type: "singleChoice", questionIndex: 0, optionIndex: 1 },
    ]);
    expect(r.states.at(-1).error).toBeNull();
    expect(r.wallet.submitTx).toHaveBeenCalledOnce();
    const tx = r.signed!;
    const aux = tx.auxiliary_data()!;
    expect(CSL.hash_auxiliary_data(aux).to_hex()).toBe(
      tx.body().auxiliary_data_hash()!.to_hex(),
    );
    expect(tx.body().to_hex()).toBe(r.unsigned!.body().to_hex());
    const meta = aux.metadata()!.get(CSL.BigNum.from_str("17"))!;
    const payload = decodePayload(metadatum(meta));
    expect(payload.type).toBe("responses");
    const action = CSL.GovernanceActionId.new(
      CSL.TransactionHash.from_hex("44".repeat(32)),
      0,
    );
    const voter = CSL.Voter.new_drep_credential(
      CSL.Credential.from_keyhash(keyHash),
    );
    expect(tx.body().voting_procedures()!.get(voter, action)!.vote_kind()).toBe(
      1,
    );
    const witness = tx.witness_set().vkeys()!.get(0);
    expect(
      witness
        .vkey()
        .public_key()
        .verify(
          blake2b(tx.body().to_bytes(), undefined, 32),
          witness.signature(),
        ),
    ).toBe(true);
    mkdirSync(".test-artifacts", { recursive: true });
    writeFileSync(
      ".test-artifacts/cgov-synthetic-signed.cbor.hex",
      tx.to_hex() + "\n",
    );
  });
  it("preserves ordinary governance votes without a linked survey", async () => {
    const r = await runVote([], { survey: null });
    expect(r.states.at(-1).error).toBeNull();
    expect(r.wallet.submitTx).toHaveBeenCalledOnce();
    expect(r.signed!.auxiliary_data()?.metadata()?.len() ?? 0).toBe(0);
  });
  it("never submits after signing rejection", async () => {
    const r = await runVote([], { survey: null, decline: true });
    expect(r.wallet.signTx).toHaveBeenCalledOnce();
    expect(r.wallet.submitTx).not.toHaveBeenCalled();
  });
  it("allows an explicit governance-only choice for an incomplete draft", async () => {
    const r = await runVote(null, { voteOnly: true });
    expect(r.wallet.submitTx).toHaveBeenCalledOnce();
    expect(r.signed!.auxiliary_data()?.metadata()?.len() ?? 0).toBe(0);
  });
  it("F01: invalid/incomplete survey drafts must not silently submit only the governance vote", async () => {
    // Form returns null when one required answer is missing or an entered value is invalid.
    const r = await runVote(null);
    expect(r.wallet.signTx).not.toHaveBeenCalled();
  });
});

describe("CGov custom-method boundary", () => {
  it("F02: a string-shaped schema does not authorize values outside its enum", () => {
    const schema = { type: "string", enum: ["approved"] };
    const question: any = {
      type: "custom",
      prompt: "Exact value",
      required: true,
      methodSchema: {
        uri: "https://fixture.invalid/schema",
        hash: new Uint8Array(32),
      },
    };
    expect(schemaAcceptsText(schema)).toBe(false);
    const answer = answerFor(question, 0, {
      type: "custom",
      value: "not-approved",
    });
    const def = { ...definition, questions: [question] };
    expect(answer).toBe(false);
    const res = buildDrepResponse({
      survey,
      credential: definition.owner,
      answers: [{ type: "custom", questionIndex: 0, value: "not-approved" }],
    });
    expect(validateDrepResponse(def, res)).not.toEqual([]);
  });
  it("presentation does not override on-chain constraints or inject object children", () => {
    const enriched = applyPresentation(definition, {
      specVersion: 5,
      kind: "cardano-survey-presentation",
      title: { bad: "object" },
      questions: [
        { prompt: { bad: "object" }, options: [{}, {}], required: false },
      ],
    });
    expect(enriched).toEqual(definition);
  });
  it("rejects a presentation with the wrong raw-byte hash", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response("{}")) as any;
    try {
      await expect(
        fetchAnchorJson({
          uri: "https://fixture.invalid",
          hash: new Uint8Array(32),
        }),
      ).rejects.toThrow("hash");
    } finally {
      globalThis.fetch = original;
    }
  });
});

it("F03: changing points totals must change the displayed survey results", () => {
  const file = "src/components/governance/LinkedSurveyPanel.tsx";
  const ast = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const rows = ast.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) && node.name?.text === "ResultRows",
  )!;
  const compiled = ts.transpileModule(rows.getText(ast), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const renderRows = new Function(
    "require",
    "labels",
    "exports",
    compiled + "; return ResultRows;",
  )(createRequire(resolve(file)), () => ["A", "B"], {});
  const result = (sums: string[]) => ({
    kind: "perOption",
    unit: "points",
    answeredCount: 1,
    answeredWeight: "10",
    perOption: sums.map((weightedSum) => ({
      weightedSum,
      answeredWeight: "10",
      count: 1,
    })),
  });
  const first = renderToStaticMarkup(
    createElement(renderRows, {
      result: result(["10", "90"]),
      question: { type: "pointsAllocation" },
    }),
  );
  const reversed = renderToStaticMarkup(
    createElement(renderRows, {
      result: result(["90", "10"]),
      question: { type: "pointsAllocation" },
    }),
  );
  expect(first).not.toBe(reversed);
});

it("caps downloaded anchors before parsing and hashing", async () => {
  const fetch = globalThis.fetch;
  globalThis.fetch = vi.fn(
    async () => new Response("x".repeat(1048577)),
  ) as any;
  try {
    await expect(
      fetchAnchorJson({
        uri: "https://fixture.invalid",
        hash: new Uint8Array(32),
      }),
    ).rejects.toThrow("exceeds");
  } finally {
    globalThis.fetch = fetch;
  }
});
