import { compact, ContextDefinition } from "jsonld";

export const getImageSha = async (imageUrl: string) => {
  try {
    const response = await fetch(imageUrl, {
      // Required to not being blocked by APIs that require a User-Agent
      headers: {
        "User-Agent": "CGov/image-sha",
      },
    });
    if (!response.ok)
      throw new Error(`Failed to fetch image: ${response.statusText}`);

    const imageBuffer = await response.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", imageBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return hashHex;
  } catch (error) {
    throw new Error(`Failed to process image: ${(error as Error).message}`);
  }
};

export const URL_REGEX =
  /^(?:(?:https?:\/\/)?(?:\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})(?:\/[^\s]*)?)|(?:ipfs:\/\/(?:[a-zA-Z0-9]+(?:\/[a-zA-Z0-9._-]+)*))$|^$/;

type Reference = {
  "@type": "Identity" | "Links";
  label: string;
  uri: string;
};

type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [property: string]: JSONValue }
  | JSONValue[];

export const GOVERNANCE_ACTION_CONTEXT = {
  "@context": {
    "@language": "en",
    CIP100:
      "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0100/README.md#",
    CIP108:
      "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0108/README.md#",
    intersectSpec:
      "https://github.com/IntersectMBO/governance-actions/blob/main/schemas/specification.md#",
    hashAlgorithm: "CIP100:hashAlgorithm",
    body: {
      "@id": "CIP108:body",
      "@context": {
        references: {
          "@id": "CIP108:references",
          "@container": "@set",
          "@context": {
            GovernanceMetadata: "CIP100:GovernanceMetadataReference",
            Other: "CIP100:OtherReference",
            label: "CIP100:reference-label",
            uri: "CIP100:reference-uri",
            referenceHash: {
              "@id": "CIP108:referenceHash",
              "@context": {
                hashDigest: "CIP108:hashDigest",
                hashAlgorithm: "CIP100:hashAlgorithm",
              },
            },
          },
        },
        title: "CIP108:title",
        abstract: "CIP108:abstract",
        motivation: "CIP108:motivation",
        rationale: "CIP108:rationale",
        onChain: {
          "@id": "intersectSpec:onChain",
          "@context": {
            governanceActionType: "intersectSpec:governanceActionType",
            depositReturnAddress: "intersectSpec:depositReturnAddress",
            withdrawals: {
              "@id": "intersectSpec:withdrawals",
              "@container": "@set",
              "@context": {
                withdrawalAddress: "intersectSpec:withdrawalAddress",
                withdrawalAmount: "intersectSpec:withdrawalAmount",
              },
            },
          },
        },
      },
    },
    authors: {
      "@id": "CIP100:authors",
      "@container": "@set",
      "@context": {
        name: "http://xmlns.com/foaf/0.1/name",
        witness: {
          "@id": "CIP100:witness",
          "@context": {
            witnessAlgorithm: "CIP100:witnessAlgorithm",
            publicKey: "CIP100:publicKey",
            signature: "CIP100:signature",
          },
        },
      },
    },
  },
};

export interface GovernanceActionMetadataBody {
  title: string;
  abstract: string;
  motivation: string;
  rationale: string;
  references: { label: string; uri: string }[];
  image?: string;
}

export type GovernanceActionOnchainInfo =
  | {
      governanceActionType: "info";
      depositReturnAddress: string;
    }
  | {
      governanceActionType: "treasuryWithdrawals";
      depositReturnAddress: string;
      withdrawals: {
        withdrawalAddress: string;
        withdrawalAmount: number;
      }[];
    };

export const generateMetadataBody = async (
  data: GovernanceActionMetadataBody,
  onChainInfo: GovernanceActionOnchainInfo,
  acceptedKeys: string[] = ["title", "abstract", "motivation", "rationale"],
) => {
  try {
    const filteredData = Object.entries(data)
      .filter(([key, value]) => value && acceptedKeys.includes(key))
      .map(([key, value]) => [key, value]);

    const references = data?.references
      ? (data.references as Array<Partial<Reference>>)
          .filter((link) => link.uri)
          .map((link) => ({
            "@type": link["@type"] ?? "Other",
            label: link.label ?? "Label",
            uri: link.uri,
          }))
      : undefined;

    const isUrl = (url?: unknown) => URL_REGEX.test(url as string);
    let image;

    if (isUrl(data?.image)) {
      image = {
        "@type": "ImageObject",
        contentUrl: data.image,
        sha256: await getImageSha(data.image as string),
      };
    } else {
      image = data?.image
        ? {
            "@type": "ImageObject",
            contentUrl: data.image,
          }
        : undefined;
    }

    const body = Object.fromEntries(filteredData);
    if (references?.length) {
      body.references = references;
    }

    if (image) {
      body.image = image;
    }

    body.onChain = onChainInfo;

    return body;
  } catch (error) {
    console.error({ error });
  }
};

export const generateJsonld = async <
  T extends Record<string, JSONValue>,
  C extends ContextDefinition,
>(
  body: T,
  context: C,
) => {
  const doc = {
    "@context": context,
    hashAlgorithm: "blake2b-256",
    authors: [],
    body,
  };

  const json = await compact(doc, context);

  return json;
};
