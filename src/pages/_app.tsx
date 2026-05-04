import "@/styles/globals.css";
import "@meshsdk/react/styles.css";
import { useEffect } from "react";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { Provider } from "react-redux";
import { NextIntlClientProvider } from "next-intl";
import { store } from "@/store";
import { Header } from "@/components/layout";
import { Footer } from "@/components/Footer";
import { StickyAIChat } from "@/components/ai/StickyAIChat";
import { ThemeProvider } from "@/lib/theme";
import { MeshProviderWrapper } from "@/components/providers/MeshProviderWrapper";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageLoadingBar } from "@/components/PageLoadingBar";
import { PageTransition } from "@/components/PageTransition";
import { isValidLocale } from "@/lib/i18n";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";

// Import all language files (pre-translated, no API calls needed)
import enMessages from "@/messages/en.json";
import deMessages from "@/messages/de.json";
import frMessages from "@/messages/fr.json";
import esMessages from "@/messages/es.json";
import ptMessages from "@/messages/pt.json";
import jaMessages from "@/messages/ja.json";
import zhMessages from "@/messages/zh.json";

const allMessages: Record<string, typeof enMessages> = {
  en: enMessages,
  de: deMessages,
  fr: frMessages,
  es: esMessages,
  pt: ptMessages,
  ja: jaMessages,
  zh: zhMessages,
};

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const locale = router.locale ?? "en";

  useSmoothScroll();

  // Migrate saved locale preference to NEXT_LOCALE cookie.
  // Next.js reads this cookie server-side to route to the correct locale,
  // avoiding a client-side router.replace() that caused a visible double render.
  useEffect(() => {
    const savedLocale = localStorage.getItem("preferred-locale");
    if (savedLocale && isValidLocale(savedLocale)) {
      document.cookie = `NEXT_LOCALE=${savedLocale};path=/;max-age=31536000;SameSite=Lax`;
    }
  }, []);

  // Load pre-translated messages for the current locale
  const messages = allMessages[locale] || enMessages;

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="UTC"
    >
      <ThemeProvider>
        <Provider store={store}>
          <TooltipProvider delayDuration={300}>
            <PageLoadingBar />
            <div id="app-brightness-wrapper" className="min-h-screen flex flex-col">
              <MeshProviderWrapper>
                <Header />
                <main className="main-content">
                  <PageTransition>
                    <Component {...pageProps} />
                  </PageTransition>
                </main>
                <Footer />
                <StickyAIChat />
              </MeshProviderWrapper>
            </div>
          </TooltipProvider>
        </Provider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
