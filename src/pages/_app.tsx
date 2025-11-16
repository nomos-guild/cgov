import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Provider } from "react-redux";
import { store } from "@/store";
import Head from "next/head";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ThemeProvider } from "@/lib/theme";
import { GovernanceApiProvider } from "@/contexts/GovernanceApiContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <Provider store={store}>
        <GovernanceApiProvider>
          <Head>
            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
            <link rel="icon" href="/favicon.ico?v=2" />
          </Head>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1">
              <Component {...pageProps} />
            </main>
            <Footer />
          </div>
        </GovernanceApiProvider>
      </Provider>
    </ThemeProvider>
  );
}
