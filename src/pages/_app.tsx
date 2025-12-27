import "@/styles/globals.css";
import "@meshsdk/react/styles.css";
import type { AppProps } from "next/app";
import { Provider } from "react-redux";
import { store } from "@/store";
import Head from "next/head";
import { MeshProvider } from "@meshsdk/react";
import { Header } from "@/components/layout";
import { Footer } from "@/components/Footer";
import { ThemeProvider } from "@/lib/theme";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <MeshProvider>
        <Provider store={store}>
          <Head>
            <link rel="icon" href="/favicon.ico?v=2" />
          </Head>
          <Header />
          <main className="main-content">
            <Component {...pageProps} />
          </main>
          <Footer />
        </Provider>
      </MeshProvider>
    </ThemeProvider>
  );
}
