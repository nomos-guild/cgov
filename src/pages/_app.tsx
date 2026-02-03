import "@/styles/globals.css";
import "@meshsdk/react/styles.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { Provider } from "react-redux";
import { NextIntlClientProvider } from "next-intl";
import { store } from "@/store";
import Head from "next/head";
import { Header } from "@/components/layout";
import { Footer } from "@/components/Footer";
import { ThemeProvider } from "@/lib/theme";
import { MeshProviderWrapper } from "@/components/providers/MeshProviderWrapper";

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

  // Load pre-translated messages for the current locale
  const messages = allMessages[locale] || enMessages;

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="UTC"
    >
      <MeshProviderWrapper>
        <ThemeProvider>
          <Provider store={store}>
            <Head>
              <link rel="icon" href="/favicon.ico?v=2" />
            </Head>
            <div id="app-brightness-wrapper" className="min-h-screen flex flex-col">
              <Header />
              <main className="main-content">
                <Component {...pageProps} />
              </main>
              <Footer />
            </div>
          </Provider>
        </ThemeProvider>
      </MeshProviderWrapper>
    </NextIntlClientProvider>
  );
}
