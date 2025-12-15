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
import { GovernanceApiProvider } from "@/contexts/GovernanceApiContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <MeshProvider>
      <Provider store={store}>
        <GovernanceApiProvider>
          <Head>
            <link rel="icon" href="/favicon.ico?v=2" />
          </Head>
          <Header />    
              <Component {...pageProps} />      
            <Footer />    
        </GovernanceApiProvider>
      </Provider>
      </MeshProvider>
    </ThemeProvider>
  );
}
