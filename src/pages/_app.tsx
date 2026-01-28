import "@/styles/globals.css";
import "@meshsdk/react/styles.css";
import type { AppProps } from "next/app";
import { Provider } from "react-redux";
import { store } from "@/store";
import Head from "next/head";
import { Header } from "@/components/layout";
import { Footer } from "@/components/Footer";
import { ThemeProvider } from "@/lib/theme";
import { MeshProviderWrapper } from "@/components/providers/MeshProviderWrapper";

export default function App({ Component, pageProps }: AppProps) {
  return (
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
  );
}
