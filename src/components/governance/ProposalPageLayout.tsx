import type { ReactNode } from "react";
import { FadeIn } from "@/components/ui/fade-in";

interface ProposalPageLayoutProps {
  children: ReactNode;
}

export default function ProposalPageLayout({ children }: ProposalPageLayoutProps) {
  return (
    <FadeIn delay={260} duration={500} distance={24}>
      {children}
    </FadeIn>
  );
}
