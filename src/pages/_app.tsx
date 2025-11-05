import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Provider } from "react-redux";
import { store } from "@/store";
import Head from "next/head";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Provider store={store}>
      <Head>
        <link rel="icon" href="/favicon.ico?v=2" />
      </Head>
      <Component {...pageProps} />
    </Provider>
  );
}
