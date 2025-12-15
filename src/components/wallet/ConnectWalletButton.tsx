import { useWallet } from "@meshsdk/react";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { useState, useEffect } from "react";
import { ConnectWalletModal } from "./ConnectWalletModal";
import Image from "next/image";

export function ConnectWalletButton() {
  const { connected, connecting, name, wallet } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [address, setAddress] = useState<string>("");
  const [walletIcon, setWalletIcon] = useState<string>("");

  // Get wallet address and icon when connected
  useEffect(() => {
    async function getWalletInfo() {
      if (connected && wallet) {
        try {
          // Get the first used address (payment address)
          const addresses = await wallet.getUsedAddresses();
          if (addresses.length > 0) {
            setAddress(addresses[0]);
          } else {
            // Fallback to change address if no used addresses
            const changeAddr = await wallet.getChangeAddress();
            setAddress(changeAddr);
          }

          // Get wallet icon from window.cardano
          if (typeof window !== "undefined" && name) {
            const cardano = (
              window as unknown as {
                cardano?: Record<string, { icon?: string }>;
              }
            ).cardano;
            if (cardano && cardano[name]?.icon) {
              setWalletIcon(cardano[name].icon);
            }
          }
        } catch (err) {
          console.error("Failed to get wallet info:", err);
        }
      } else {
        setAddress("");
        setWalletIcon("");
      }
    }
    getWalletInfo();
  }, [connected, wallet, name]);

  // Format address to show first 6 and last 5 characters
  const formatAddress = (addr: string) => {
    if (addr.length <= 15) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-5)}`;
  };

  return (
    <>
      <Button
        variant={connected ? "outline" : "default"}
        onClick={() => setIsModalOpen(true)}
        disabled={connecting}
        className="flex items-center gap-2"
      >
        {connecting ? (
          <>
            <Wallet className="h-4 w-4" />
            Connecting...
          </>
        ) : connected ? (
          <>
            {walletIcon ? (
              walletIcon.startsWith("chrome-extension://") ? (
                <img
                  src={walletIcon}
                  alt={name || "wallet"}
                  className="h-5 w-5 rounded"
                />
              ) : (
                <Image
                  src={walletIcon}
                  alt={name || "wallet"}
                  width={20}
                  height={20}
                  className="rounded"
                />
              )
            ) : (
              <Wallet className="h-4 w-4" />
            )}
            <span>{address ? formatAddress(address) : name}</span>
          </>
        ) : (
          <>
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </>
        )}
      </Button>

      <ConnectWalletModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
