import type { GetStaticProps } from "next";
import { useTranslations } from "next-intl";
import { SeoHead } from "@/components/SeoHead";
import { AboutCGOVAI } from "@/components/ai/AboutCGOVAI";

// Slot that StickyAIChat portals into when the user is on /ai. Keeping a
// single AIChatPanel instance (mounted in _app.tsx) avoids the duplicate
// state + cross-instance event sync loop that caused the flicker, and
// preserves any in-flight request when the user navigates here from
// elsewhere on the site.
const CHAT_SLOT_ID = "cgov-ai-chat-slot";

type IntlMessages = typeof import("@/messages/en.json");

interface AIPageProps {
  messages: IntlMessages;
}

export default function AIPage() {
  const t = useTranslations("aiChat");

  return (
    <>
      <SeoHead
        title="AI Assistant - CGOV"
        description="Chat with the CGOV AI assistant about Cardano governance, DReps, SPOs, treasury, and the constitutional committee."
      />
      <div className="container mx-auto px-4 py-6 sm:py-10">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl font-bold sm:text-3xl">{t("titleGlobal")}</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {t("subtitleGlobal")}
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <AboutCGOVAI />
          {/* Slot only renders on lg+. On mobile, the chat falls back to
              its normal popover/FAB behaviour so the page isn't dominated
              by a tall blank area when the panel hasn't been opened. */}
          <div className="hidden lg:sticky lg:top-20 lg:block">
            <div id={CHAT_SLOT_ID} className="h-[75vh] min-h-[560px]" />
          </div>
        </div>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps<AIPageProps> = async ({ locale }) => {
  const messages = (await import(`@/messages/${locale ?? "en"}.json`)).default;
  return {
    props: { messages },
  };
};
