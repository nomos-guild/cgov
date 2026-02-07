import type { GetStaticProps } from "next";
import Head from "next/head";
import { AnalyticsTestPanel } from "@/components/analytics";

type IntlMessages = typeof import("@/messages/en.json");

interface AnalyticsTestPageProps {
  messages: IntlMessages;
}

export default function AnalyticsTestPage() {
  return (
    <>
      <Head>
        <title>Analytics API Test - CGOV</title>
        <meta
          name="description"
          content="Test panel for analytics API endpoints"
        />
      </Head>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Analytics API Test</h1>
            <p className="text-muted-foreground">
              Use this panel to test the new analytics endpoints. Select an
              endpoint from the dropdown and click &quot;Fetch Data&quot; to see
              the response.
            </p>
          </div>
          <AnalyticsTestPanel />
        </div>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps<AnalyticsTestPageProps> = async ({
  locale,
}) => {
  if (process.env.NODE_ENV !== "development") {
    return {
      notFound: true,
    };
  }

  const messages = (await import(`@/messages/${locale ?? "en"}.json`)).default;

  return {
    props: {
      messages,
    },
  };
};
