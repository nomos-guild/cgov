"use client";

import { useEffect, useState, ReactNode } from "react";

interface MeshProviderWrapperProps {
  children: ReactNode;
}

function isWebCryptoSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.crypto && window.crypto.subtle);
}

export function MeshProviderWrapper({ children }: MeshProviderWrapperProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [MeshProviderComponent, setMeshProviderComponent] = useState<any>(null);
  const [isUnsupported, setIsUnsupported] = useState(false);

  useEffect(() => {
    // Check for Web Crypto API support before attempting to load Mesh SDK
    if (!isWebCryptoSupported()) {
      console.warn("Web Crypto API not supported - wallet features disabled");
      setIsUnsupported(true);
      return;
    }

    const loadMeshProvider = async () => {
      try {
        const { MeshProvider } = await import("@meshsdk/react");
        setMeshProviderComponent(() => MeshProvider);
      } catch (error) {
        console.error("Error importing MeshProvider:", error);
        setIsUnsupported(true);
      }
    };
    loadMeshProvider();
  }, []);

  // On unsupported environments or while loading, render children without MeshProvider
  if (isUnsupported || MeshProviderComponent === null) {
    return <>{children}</>;
  }

  return <MeshProviderComponent>{children}</MeshProviderComponent>;
}
