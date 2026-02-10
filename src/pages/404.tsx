import type { GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type IntlMessages = typeof import("@/messages/en.json");

interface NotFoundProps {
  messages: IntlMessages;
}

export default function NotFound() {
  const t = useTranslations();

  return (
    <>
      <Head>
        <title>{t("meta.notFoundTitle")}</title>
        <meta name="description" content={t("meta.notFoundDescription")} />
      </Head>
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center min-h-[80vh]">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-4xl text-center">{t("notFound.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-muted-foreground">
                {t("notFound.description")}
              </p>
              <Link href="/">
                <Button className="w-full">{t("notFound.returnHome")}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps<NotFoundProps> = async ({ locale }) => {
  const messages = (await import(`@/messages/${locale ?? "en"}.json`)).default;

  return {
    props: {
      messages,
    },
  };
};
