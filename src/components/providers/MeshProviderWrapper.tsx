"use client";

import { useEffect, useState, ReactNode } from "react";

interface MeshProviderWrapperProps {
  children: ReactNode;
}

export function MeshProviderWrapper({ children }: MeshProviderWrapperProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [MeshProviderComponent, setMeshProviderComponent] = useState<any>(null);

  useEffect(() => {
    const loadMeshProvider = async () => {
      try {
        const { MeshProvider } = await import("@meshsdk/react");
        setMeshProviderComponent(() => MeshProvider);
      } catch (error) {
        console.error("Error importing MeshProvider:", error);
      }
    };
    loadMeshProvider();
  }, []);

  if (MeshProviderComponent === null) {
    // Return children without MeshProvider while loading
    // This prevents a blank screen during hydration
    return <>{children}</>;
  }

  return <MeshProviderComponent>{children}</MeshProviderComponent>;
}
