"use client";

import { Fragment, type ReactNode, type ComponentType, useEffect, useState } from "react";

interface MeshProviderWrapperProps {
  children: ReactNode;
}

export function MeshProviderWrapper({ children }: MeshProviderWrapperProps) {
  const [ProviderComponent, setProviderComponent] = useState<
    ComponentType<{ children: ReactNode }> | null
  >(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    import("@meshsdk/react")
      .then((mod) => setProviderComponent(() => mod.MeshProvider))
      .catch((error) => {
        console.warn("Mesh provider failed to initialize:", error);
      });
  }, []);

  const Wrapper = ProviderComponent ?? Fragment;
  return <Wrapper>{children}</Wrapper>;
}
