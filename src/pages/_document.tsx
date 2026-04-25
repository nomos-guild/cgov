import { Html, Head, Main, NextScript, type DocumentProps } from "next/document";

export default function Document({ __NEXT_DATA__ }: DocumentProps) {
  const locale = __NEXT_DATA__.locale ?? "en";

  return (
    <Html lang={locale}>
      <Head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
        <link rel="icon" type="image/svg+xml" href="/nomos.svg" />
        <link rel="apple-touch-icon" href="/nomos.png" />
        <meta name="theme-color" content="#0bd1a2" />
      </Head>
      <body>
        {/* Blocking script: apply saved theme before first paint to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');if(t&&['light','dark','game','neural'].indexOf(t)!==-1){document.documentElement.setAttribute('data-theme',t);var d=t==='dark'||t==='game';if(d)document.documentElement.classList.add('dark');document.documentElement.style.colorScheme=d?'dark':'light'}}catch(e){}})()` }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
