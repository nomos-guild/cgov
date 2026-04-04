"use client";

import { useState, useEffect } from "react";
import { ResponsiveContainer } from "recharts";
import type { ComponentProps } from "react";

/**
 * SSR-safe wrapper around Recharts ResponsiveContainer.
 * During SSG/SSR there is no DOM so Recharts computes width/height as -1
 * and logs warnings. This component defers rendering until client-side mount.
 */
export function SafeResponsiveContainer(props: ComponentProps<typeof ResponsiveContainer>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return <ResponsiveContainer {...props} />;
}
