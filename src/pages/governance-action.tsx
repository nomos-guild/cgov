import { useState } from "react";
import Head from "next/head";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useWallet } from "@meshsdk/react";
import { Cardano } from "@meshsdk/core-cst";
import {
  generateJsonld,
  generateMetadataBody,
  GOVERNANCE_ACTION_CONTEXT,
  GovernanceActionMetadataBody,
} from "@/utils/govJson";
import { blake2bHex } from "blakejs";
import { canonize } from "jsonld";
import * as cbor from "cbor-js";
import { GovernanceAction, MeshTxBuilder } from "@meshsdk/core";

export default function GovernanceActionPage() {
  const { connected, wallet } = useWallet();
  const [activeTab, setActiveTab] = useState("create");
  const [actionType, setActionType] = useState("info-action");
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [motivation, setMotivation] = useState("");
  const [rationale, setRationale] = useState("");
  const [treasuryWithdrawals, setTreasuryWithdrawals] = useState<
    Array<{ stakeAddress: string; amount: string }>
  >([]);
  const [authorName, setAuthorName] = useState("");
  const [references, setReferences] = useState<
    Array<{ label: string; uri: string }>
  >([]);
  const [anchorJson, setAnchorJson] = useState("");
  const [authorWitness, setAuthorWitness] = useState<{
    name: string;
    witness: {
      witnessAlgorithm: string;
      publicKey: string;
      signature: string;
    };
  }>({
    name: "",
    witness: {
      witnessAlgorithm: "",
      publicKey: "",
      signature: "",
    },
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [anchorJsonHash, setAnchorJsonHash] = useState("");
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const isLight = activeTheme.id === "light";
  const isNerd = activeTheme.id === "dark";
  const isDark = !isGame && !isLight;

  const cardClass = isGame
    ? "rounded-[2px] border-none bg-[rgba(12,12,12,0.5)] p-4 sm:p-6 shadow-[0_18px_36px_rgba(0,0,0,0.55),0_6px_18px_rgba(0,0,0,0.4)]"
    : isLight
      ? "rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-elevation-2"
      : "rounded-none border border-[#0bd1a2] bg-transparent p-4 sm:p-6 shadow-none";

  const selectItemClass = isGame
    ? "dropdown-item rounded-xl data-[highlighted]:bg-white/6 data-[highlighted]:text-white data-[state=checked]:bg-white/6 data-[state=checked]:text-white"
    : "rounded-none data-[highlighted]:bg-black/10 data-[highlighted]:text-foreground data-[state=checked]:bg-black data-[state=checked]:text-white dark:data-[highlighted]:bg-[#0bd1a2]/15 dark:data-[highlighted]:text-[#0bd1a2] dark:data-[state=checked]:bg-[#0bd1a2] dark:data-[state=checked]:text-black";

  const triggerClass = cn(
    "w-full ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 [&>span]:truncate",
    isGame
      ? "game-nav-btn h-10 justify-between px-4 text-left text-sm"
      : isLight
        ? "border-border bg-background text-foreground focus:border-black data-[state=open]:border-black"
        : "rounded-none border-[#0bd1a2] bg-black text-[#0bd1a2] focus:border-[#0bd1a2] data-[state=open]:border-[#0bd1a2]",
  );

  const contentClass = cn(
    isGame
      ? "game-select-content rounded-xl border border-white/15 bg-[linear-gradient(to_bottom,#0a0a0a_0%,#121212_100%)] text-white shadow-[0_30px_80px_rgba(0,0,0,0.75),0_12px_30px_rgba(0,0,0,0.45)]"
      : isLight
        ? "border-border bg-popover text-popover-foreground"
        : "rounded-none border border-[#0bd1a2] bg-black text-[#0bd1a2]",
  );

  const labelClass = cn(
    "text-sm font-medium",
    isGame ? "text-white/80" : isLight ? "text-foreground" : "text-[#0bd1a2]",
  );

  const helperTextClass = cn(
    "text-sm sm:text-base",
    isGame
      ? "text-white/70"
      : isLight
        ? "text-muted-foreground"
        : "text-[#0bd1a2]/70",
  );

  const submitButtonClass = cn(
    "min-w-[180px]",
    isGame
      ? "game-nav-btn"
      : isDark
        ? "rounded-none bg-[#0bd1a2] text-black hover:bg-[#0bd1a2]/90"
        : "bg-black text-white hover:bg-black/90",
  );

  const addReferenceButtonClass = cn(
    "w-full h-12 text-base font-semibold",
    isGame
      ? "game-nav-btn"
      : isLight
        ? "rounded-xl border border-border bg-background text-foreground hover:bg-accent"
        : "rounded-none border border-[#0bd1a2] bg-transparent text-[#0bd1a2] hover:bg-[#0bd1a2]/10",
  );

  const textareaClass = cn(
    "min-h-[120px] resize-y",
    isGame
      ? "rounded-xl border border-white/20 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-white/20 focus-visible:ring-offset-0"
      : isLight
        ? "rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-black/20"
        : isNerd
          ? "rounded-none border border-[#0bd1a2]/50 bg-black/30 text-[#0bd1a2] placeholder:text-[#0bd1a2]/40 focus-visible:ring-[#0bd1a2]/25 focus-visible:ring-offset-0"
          : "rounded-md border border-[#0bd1a2]/50 bg-black/30 text-[#0bd1a2] placeholder:text-[#0bd1a2]/40 focus-visible:ring-[#0bd1a2]/25 focus-visible:ring-offset-0",
  );

  const inputClass = cn(
    "h-10",
    isGame
      ? "filter-input game-nav-input text-sm"
      : isLight
        ? "rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-black/20"
        : "filter-input rounded-md bg-black/30 border border-[#0bd1a2]/50 text-[#0bd1a2] placeholder:text-[#0bd1a2]/40 focus-visible:ring-[#0bd1a2]/25 focus-visible:ring-offset-0",
  );

  const handleCreateAnchorJson = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const metadata: GovernanceActionMetadataBody = {
      title,
      abstract,
      motivation,
      rationale,
      references,
    };
    if (!wallet || !connected) {
      throw new Error(
        "Please connect your wallet to submit a governance action.",
      );
    }
    const rewardAddresses = await wallet.getRewardAddresses();
    const validTreasuryWithdrawals = treasuryWithdrawals
      .filter(
        (withdrawal) =>
          withdrawal.stakeAddress.trim() &&
          withdrawal.amount.trim() &&
          Number.isFinite(Number(withdrawal.amount)) &&
          Number(withdrawal.amount) > 0,
      )
      .map((withdrawal) => ({
        withdrawalAddress: withdrawal.stakeAddress.trim(),
        withdrawalAmount: Number(withdrawal.amount),
      }));

    if (
      actionType === "treasury-withdrawal" &&
      validTreasuryWithdrawals.length === 0
    ) {
      throw new Error(
        "Please add at least one valid treasury withdrawal with stake address and amount.",
      );
    }

    const metadataBody = await generateMetadataBody(metadata, {
      ...(actionType === "treasury-withdrawal"
        ? {
            governanceActionType: "treasuryWithdrawals" as const,
            depositReturnAddress: rewardAddresses[0],
            withdrawals: validTreasuryWithdrawals,
          }
        : {
            governanceActionType: "info" as const,
            depositReturnAddress: rewardAddresses[0],
          }),
    });
    console.log("Governance action metadata:", metadataBody);
    const jsonld = await generateJsonld(
      metadataBody,
      GOVERNANCE_ACTION_CONTEXT,
    );
    setAnchorJson(JSON.stringify(jsonld, null, 2));
    const hash = blake2bHex(
      JSON.stringify(await canonize(jsonld), null, 2),
      undefined,
      32,
    );
    setAnchorJsonHash(hash);
    setAuthorWitness({
      name: "",
      witness: {
        witnessAlgorithm: "",
        publicKey: "",
        signature: "",
      },
    });
    setActiveTab("sign");
    setIsSubmitted(true);
  };

  const handleSignAnchorJson = async () => {
    if (!wallet || !connected) {
      throw new Error("Please connect your wallet to sign the anchor JSON.");
    }

    if (!anchorJson.trim()) {
      throw new Error("Please create Anchor JSON before signing.");
    }

    const parsedAnchorJson = JSON.parse(anchorJson);
    const jsonDoc = {
      "@context": parsedAnchorJson["@context"],
      body: parsedAnchorJson["body"],
    };
    const hash = blake2bHex(
      JSON.stringify(await canonize(jsonDoc), null, 2),
      undefined,
      32,
    );
    const signature = await wallet.signData(hash);
    const signatureBytes = Buffer.from(signature.signature, "hex");
    const decodedSignature = cbor.decode(signatureBytes.buffer);
    const addressMap = cbor.decode(Buffer.from(decodedSignature[0]).buffer);
    const address = Cardano.Address.fromBytes(addressMap["address"]);
    const addressProps = address.getProps();
    const publicKey = addressProps.delegationPart?.hash.toString();
    if (!publicKey) {
      throw new Error("Failed to extract public key from the signature.");
    }
    const authorWitness = {
      name: authorName,
      witness: {
        witnessAlgorithm: "ed25519",
        publicKey: publicKey,
        signature: Buffer.from(decodedSignature[3]).toString("hex"),
      },
    };
    parsedAnchorJson["authors"].push(authorWitness);
    setAnchorJson(JSON.stringify(parsedAnchorJson, null, 2));
    setAuthorWitness(authorWitness);
    setActiveTab("submit");
  };

  const handleSubmitGovernanceAction = async () => {
    if (!wallet || !connected) {
      throw new Error(
        "Please connect your wallet to submit the governance action.",
      );
    }

    if (!authorWitness.witness.signature) {
      throw new Error("Please sign the anchor JSON before submitting.");
    }

    if (!wallet || !connected) {
      throw new Error("Please connect your wallet to sign the anchor JSON.");
    }

    if (!anchorJson.trim()) {
      throw new Error("Please create Anchor JSON before signing.");
    }

    const utxos = await wallet.getUtxos();
    const rewardAddresses = await wallet.getRewardAddresses();
    const changeAddress = await wallet.getChangeAddress();

    const proposal: GovernanceAction =
      actionType === "treasury-withdrawal"
        ? {
            kind: "TreasuryWithdrawalsAction",
            action: {
              withdrawals: Object.fromEntries(
                treasuryWithdrawals
                  .filter(
                    (withdrawal) =>
                      withdrawal.stakeAddress.trim() &&
                      withdrawal.amount.trim(),
                  )
                  .map((withdrawal) => [
                    withdrawal.stakeAddress.trim(),
                    withdrawal.amount.trim(),
                  ]),
              ),
            },
          }
        : {
            kind: "InfoAction",
            action: {},
          };

    const txBuilder = new MeshTxBuilder({});
    const txHex = await txBuilder
      .selectUtxosFrom(utxos)
      .proposal(
        proposal,
        {
          anchorUrl: "",
          anchorDataHash: anchorJsonHash,
        },
        rewardAddresses[0],
        String(100_000_000_000),
      )
      .changeAddress(changeAddress)
      .complete();
    const signedTx = await wallet.signTx(txHex);
    console.log("Signed transaction:", signedTx);

    setIsSubmitted(true);
  };

  const handleReferenceChange = (
    index: number,
    field: "label" | "uri",
    value: string,
  ) => {
    setReferences((prev) =>
      prev.map((reference, i) =>
        i === index ? { ...reference, [field]: value } : reference,
      ),
    );
    setIsSubmitted(false);
  };

  const handleAddReference = () => {
    setReferences((prev) => [...prev, { label: "", uri: "" }]);
    setIsSubmitted(false);
  };

  const handleTreasuryWithdrawalChange = (
    index: number,
    field: "stakeAddress" | "amount",
    value: string,
  ) => {
    setTreasuryWithdrawals((prev) =>
      prev.map((withdrawal, i) =>
        i === index ? { ...withdrawal, [field]: value } : withdrawal,
      ),
    );
    setIsSubmitted(false);
  };

  const handleAddTreasuryWithdrawal = () => {
    setTreasuryWithdrawals((prev) => [
      ...prev,
      { stakeAddress: "", amount: "" },
    ]);
    setIsSubmitted(false);
  };

  const handleRemoveTreasuryWithdrawal = (index: number) => {
    setTreasuryWithdrawals((prev) => prev.filter((_, i) => i !== index));
    setIsSubmitted(false);
  };

  const handleRemoveReference = (index: number) => {
    setReferences((prev) => prev.filter((_, i) => i !== index));
    setIsSubmitted(false);
  };

  return (
    <>
      <Head>
        <title>Governance Action</title>
        <meta name="description" content="Governance action page" />
      </Head>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-3 pt-8 pb-4 sm:px-4 sm:pt-10 sm:pb-6 md:px-6 md:pt-12 md:pb-8">
          <FadeIn delay={0} duration={400} distance={12}>
            <div className="mb-6 sm:mb-8 md:mb-10 text-left">
              <h1 className="landing-title text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-black dark:text-foreground">
                Governance Action
              </h1>
            </div>
          </FadeIn>

          <FadeIn delay={100} duration={400} distance={16}>
            <section className={cardClass}>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-5 grid w-full grid-cols-3">
                  <TabsTrigger value="create">
                    1. Create Anchor JSON
                  </TabsTrigger>
                  <TabsTrigger value="sign">2. Sign Anchor JSON</TabsTrigger>
                  <TabsTrigger value="submit">
                    3. Submit Governance Action
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="create" className="mt-0">
                  <form className="space-y-5" onSubmit={handleCreateAnchorJson}>
                    <div className="space-y-2">
                      <label
                        className={labelClass}
                        htmlFor="governance-action-type"
                      >
                        Governance action type
                      </label>
                      <Select
                        value={actionType}
                        onValueChange={(value) => {
                          setActionType(value);
                          if (
                            value === "treasury-withdrawal" &&
                            treasuryWithdrawals.length === 0
                          ) {
                            setTreasuryWithdrawals([
                              { stakeAddress: "", amount: "" },
                            ]);
                          }
                          setIsSubmitted(false);
                        }}
                      >
                        <SelectTrigger
                          aria-label="Governance action type"
                          className={triggerClass}
                          id="governance-action-type"
                        >
                          <SelectValue placeholder="Select action type" />
                        </SelectTrigger>
                        <SelectContent className={contentClass}>
                          <SelectItem
                            className={selectItemClass}
                            value="info-action"
                          >
                            Info action
                          </SelectItem>
                          <SelectItem
                            className={selectItemClass}
                            value="treasury-withdrawal"
                          >
                            Treasury withdrawal
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {actionType === "treasury-withdrawal" && (
                      <div className="space-y-4">
                        <label className={labelClass}>
                          Treasury withdrawals
                        </label>

                        {treasuryWithdrawals.map((withdrawal, index) => (
                          <div
                            key={`treasury-withdrawal-${index}`}
                            className="flex items-center gap-3"
                          >
                            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                              <Input
                                id={`treasury-withdrawal-stake-address-${index}`}
                                className={inputClass}
                                placeholder="Stake address"
                                type="text"
                                value={withdrawal.stakeAddress}
                                onChange={(event) =>
                                  handleTreasuryWithdrawalChange(
                                    index,
                                    "stakeAddress",
                                    event.target.value,
                                  )
                                }
                              />
                              <Input
                                id={`treasury-withdrawal-amount-${index}`}
                                className={inputClass}
                                placeholder="Amount"
                                type="number"
                                min="0"
                                step="any"
                                value={withdrawal.amount}
                                onChange={(event) =>
                                  handleTreasuryWithdrawalChange(
                                    index,
                                    "amount",
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                            <Button
                              aria-label={`Remove treasury withdrawal ${index + 1}`}
                              className={cn(
                                "h-10 w-10 shrink-0 p-0",
                                isGame
                                  ? "game-nav-btn"
                                  : isLight
                                    ? "rounded-xl border border-border bg-background text-foreground hover:bg-destructive/10 hover:text-destructive"
                                    : "rounded-none border border-[#0bd1a2]/50 bg-transparent text-[#0bd1a2] hover:bg-red-500/10 hover:text-red-400",
                              )}
                              onClick={() =>
                                handleRemoveTreasuryWithdrawal(index)
                              }
                              type="button"
                            >
                              ×
                            </Button>
                          </div>
                        ))}

                        <Button
                          className={addReferenceButtonClass}
                          onClick={handleAddTreasuryWithdrawal}
                          type="button"
                        >
                          Add treasury withdrawal
                        </Button>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label
                        className={labelClass}
                        htmlFor="governance-action-title"
                      >
                        Title
                      </label>
                      <Input
                        id="governance-action-title"
                        className={inputClass}
                        placeholder="Enter a title"
                        type="text"
                        value={title}
                        onChange={(event) => {
                          setTitle(event.target.value);
                          setIsSubmitted(false);
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        className={labelClass}
                        htmlFor="governance-action-abstract"
                      >
                        Abstract
                      </label>
                      <Textarea
                        id="governance-action-abstract"
                        className={textareaClass}
                        placeholder="Enter an abstract"
                        value={abstract}
                        onChange={(event) => {
                          setAbstract(event.target.value);
                          setIsSubmitted(false);
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        className={labelClass}
                        htmlFor="governance-action-motivation"
                      >
                        Motivation
                      </label>
                      <Textarea
                        id="governance-action-motivation"
                        className={textareaClass}
                        placeholder="Enter the motivation"
                        value={motivation}
                        onChange={(event) => {
                          setMotivation(event.target.value);
                          setIsSubmitted(false);
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        className={labelClass}
                        htmlFor="governance-action-rationale"
                      >
                        Rationale
                      </label>
                      <Textarea
                        id="governance-action-rationale"
                        className={textareaClass}
                        placeholder="Enter the rationale"
                        value={rationale}
                        onChange={(event) => {
                          setRationale(event.target.value);
                          setIsSubmitted(false);
                        }}
                      />
                    </div>

                    <div className="space-y-4">
                      <label className={labelClass}>References</label>

                      {references.map((reference, index) => (
                        <div
                          key={`reference-${index}`}
                          className="flex items-center gap-3"
                        >
                          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                            <Input
                              id={`governance-action-reference-label-${index}`}
                              className={inputClass}
                              placeholder="Label"
                              type="text"
                              value={reference.label}
                              onChange={(event) =>
                                handleReferenceChange(
                                  index,
                                  "label",
                                  event.target.value,
                                )
                              }
                            />
                            <Input
                              id={`governance-action-reference-url-${index}`}
                              className={inputClass}
                              placeholder="URL"
                              type="url"
                              value={reference.uri}
                              onChange={(event) =>
                                handleReferenceChange(
                                  index,
                                  "uri",
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                          <Button
                            aria-label={`Remove reference ${index + 1}`}
                            className={cn(
                              "h-10 w-10 shrink-0 p-0",
                              isGame
                                ? "game-nav-btn"
                                : isLight
                                  ? "rounded-xl border border-border bg-background text-foreground hover:bg-destructive/10 hover:text-destructive"
                                  : "rounded-none border border-[#0bd1a2]/50 bg-transparent text-[#0bd1a2] hover:bg-red-500/10 hover:text-red-400",
                            )}
                            onClick={() => handleRemoveReference(index)}
                            type="button"
                          >
                            ×
                          </Button>
                        </div>
                      ))}

                      <Button
                        className={addReferenceButtonClass}
                        onClick={handleAddReference}
                        type="button"
                      >
                        Add reference
                      </Button>
                    </div>

                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                      <Button className={submitButtonClass} type="submit">
                        Create Anchor JSON
                      </Button>
                      {isSubmitted && (
                        <p className={helperTextClass}>
                          Anchor JSON created successfully.
                        </p>
                      )}
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="sign" className="mt-0 space-y-4">
                  <div className="space-y-2">
                    <label className={labelClass} htmlFor="anchor-author-name">
                      Author name
                    </label>
                    <Input
                      id="anchor-author-name"
                      className={inputClass}
                      placeholder="Enter author name"
                      type="text"
                      value={authorName}
                      onChange={(event) => {
                        setAuthorName(event.target.value);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      className={labelClass}
                      htmlFor="generated-anchor-json"
                    >
                      Generated Anchor JSON
                    </label>
                    <Textarea
                      id="generated-anchor-json"
                      className={cn(
                        textareaClass,
                        "min-h-[260px] font-mono text-xs",
                      )}
                      value={anchorJson}
                      placeholder="Create Anchor JSON in step 1, then you can edit it here before signing."
                      onChange={(event) => {
                        setAnchorJson(event.target.value);
                        setAuthorWitness({
                          name: "",
                          witness: {
                            witnessAlgorithm: "",
                            publicKey: "",
                            signature: "",
                          },
                        });
                      }}
                    />
                  </div>

                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                    <Button
                      className={submitButtonClass}
                      onClick={handleSignAnchorJson}
                      type="button"
                      disabled={!anchorJson.trim()}
                    >
                      Sign Anchor JSON
                    </Button>
                    {!anchorJson.trim() && (
                      <p className={helperTextClass}>
                        Generate Anchor JSON in step 1 before signing.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass} htmlFor="anchor-signature">
                      Signature (hex)
                    </label>
                    <Textarea
                      id="anchor-signature"
                      className={cn(
                        textareaClass,
                        "min-h-[120px] font-mono text-xs",
                      )}
                      value={authorWitness.witness.signature}
                      readOnly
                    />
                  </div>
                </TabsContent>

                <TabsContent value="submit" className="mt-0 space-y-4">
                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                    <Button
                      className={submitButtonClass}
                      onClick={handleSubmitGovernanceAction}
                      type="button"
                      disabled={!authorWitness.witness.signature}
                    >
                      Submit Governance Action
                    </Button>
                    {!authorWitness.witness.signature && (
                      <p className={helperTextClass}>
                        Sign the anchor JSON in step 2 before submitting.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </section>
          </FadeIn>
        </div>
      </div>
    </>
  );
}
