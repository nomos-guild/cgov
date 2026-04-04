import { useWallet } from "@meshsdk/react";
import { BrowserWallet, type Wallet } from "@meshsdk/core";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState } from "react";
import {
  Wallet as WalletIcon,
  LogOut,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectWalletModal({
  isOpen,
  onClose,
}: ConnectWalletModalProps) {
  const { connect, disconnect, connected, name, wallet } = useWallet();
  const t = useTranslations("wallet");
  const [availableWallets, setAvailableWallets] = useState<Wallet[]>([]);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect all available CIP-30 wallets using Mesh SDK
  useEffect(() => {
    const loadWallets = async () => {
      const wallets = await BrowserWallet.getAvailableWallets();
      // Sort alphabetically by name
      setAvailableWallets(wallets.sort((a, b) => a.name.localeCompare(b.name)));
    };
    loadWallets();
  }, [isOpen]);

  // Get wallet address when connected
  useEffect(() => {
    async function getAddress() {
      if (connected && wallet) {
        try {
          const addresses = await wallet.getRewardAddresses();
          if (addresses.length > 0) {
            setWalletAddress(addresses[0]);
          }
        } catch (err) {
          console.error("Failed to get wallet address:", err);
        }
      } else {
        setWalletAddress("");
      }
    }
    getAddress();
  }, [connected, wallet]);

  const handleConnect = useCallback(
    async (walletName: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await connect(walletName);
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("failedToConnect")
        );
      } finally {
        setIsLoading(false);
      }
    },
    [connect, onClose]
  );

  const handleDisconnect = useCallback(async () => {
    disconnect();
    setWalletAddress("");
    onClose();
  }, [disconnect, onClose]);

  const formatAddress = (addr: string) => {
    if (addr.length <= 20) return addr;
    return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WalletIcon className="h-5 w-5" />
            {connected ? t("walletConnected") : t("connectWallet")}
          </DialogTitle>
          <DialogDescription>
            {connected
              ? t("walletConnectedDesc")
              : t("connectWalletDesc")}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        {connected ? (
          <div className="space-y-4">
            <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t("connectedWallet")}
                </span>
                <span className="text-sm font-medium capitalize">{name}</span>
              </div>
              {walletAddress && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("stakeAddress")}
                  </span>
                  <code className="text-xs bg-background px-2 py-1 rounded">
                    {formatAddress(walletAddress)}
                  </code>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full bg-white border-transparent shadow-elevation-1 hover:shadow-elevation-2 hover:bg-gray-50 text-black hover:text-black"
              onClick={handleDisconnect}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t("disconnectWallet")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {availableWallets.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-muted-foreground">
                  {t("noWalletsDetected")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("installWalletExtension")}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <a
                    href="https://eternl.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm flex items-center gap-1 hover:underline"
                  >
                    Eternl <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="https://namiwallet.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm flex items-center gap-1 hover:underline"
                  >
                    Nami <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href="https://www.lace.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm flex items-center gap-1 hover:underline"
                  >
                    Lace <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {availableWallets.map((detectedWallet) => (
                  <button
                    key={detectedWallet.id}
                    className="wallet-item w-full flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors disabled:opacity-50"
                    onClick={() => handleConnect(detectedWallet.id)}
                    disabled={isLoading}
                  >
                    {detectedWallet.icon ? (
                      detectedWallet.icon.startsWith("chrome-extension://") ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={detectedWallet.icon}
                            alt={detectedWallet.name}
                            className="w-10 h-10 rounded-lg"
                          />
                        </>
                      ) : (
                        <Image
                          src={detectedWallet.icon}
                          alt={detectedWallet.name}
                          width={40}
                          height={40}
                          className="rounded-lg"
                        />
                      )
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <WalletIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <div className="font-medium">{detectedWallet.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t("connectToStartVoting")}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
