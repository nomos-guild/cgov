import { useWallet } from "@meshsdk/react";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { useState, useEffect } from "react";
import { ConnectWalletModal } from "./ConnectWalletModal";
import Image from "next/image";
import { useTheme } from "@/lib/theme";

export function ConnectWalletButton() {
  const { connected, connecting, name, wallet } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [address, setAddress] = useState<string>("");
  const [walletIcon, setWalletIcon] = useState<string>("");
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";

  // Get wallet address and icon when connected
  useEffect(() => {
    async function getWalletInfo() {
      if (connected && wallet) {
        try {
          // Try multiple methods to get an address
          let addr = "";

          // Method 1: Get change address (most reliable for display)
          try {
            const changeAddr = await wallet.getChangeAddress();
            if (changeAddr) {
              addr = changeAddr;
            }
          } catch (e) {
            console.warn("[Wallet] getChangeAddress failed:", e);
          }

          // Method 2: Get used addresses
          if (!addr) {
            try {
              const usedAddresses = await wallet.getUsedAddresses();
              if (usedAddresses && usedAddresses.length > 0) {
                addr = usedAddresses[0];
              }
            } catch (e) {
              console.warn("[Wallet] getUsedAddresses failed:", e);
            }
          }

          // Method 3: Get unused addresses
          if (!addr) {
            try {
              const unusedAddresses = await wallet.getUnusedAddresses();
              if (unusedAddresses && unusedAddresses.length > 0) {
                addr = unusedAddresses[0];
              }
            } catch (e) {
              console.warn("[Wallet] getUnusedAddresses failed:", e);
            }
          }

          // Method 4: Try reward addresses as fallback
          if (!addr) {
            try {
              const rewardAddresses = await wallet.getRewardAddresses();
              if (rewardAddresses && rewardAddresses.length > 0) {
                addr = rewardAddresses[0];
              }
            } catch (e) {
              console.warn("[Wallet] getRewardAddresses failed:", e);
            }
          }

          if (addr) {
            setAddress(addr);
          } else {
            console.warn("[Wallet] No address found from any method");
          }

          // Get wallet icon from window.cardano
          if (typeof window !== "undefined" && name) {
            const cardano = (
              window as unknown as {
                cardano?: Record<string, { icon?: string }>;
              }
            ).cardano;
            if (cardano && cardano[name]?.icon) {
              setWalletIcon(cardano[name]?.icon || "");
            }
          }
        } catch (err) {
          console.error("[Wallet] Failed to get wallet info:", err);
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
        className={
          isGame
            ? "game-nav-btn"
            : `flex items-center gap-2 transition-colors btn-neon ${
                connected
                  ? "hover:bg-black hover:text-white"
                  : "bg-white text-black hover:bg-black hover:text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)]"
              }`
        }
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
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={walletIcon}
                    alt={name || "wallet"}
                    className="h-5 w-5 rounded"
                  />
                </>
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
