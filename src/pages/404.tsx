import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <>
      <Head>
        <title>404 - Page Not Found</title>
        <meta name="description" content="The page you're looking for doesn't exist" />
      </Head>
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center min-h-[80vh]">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-4xl text-center">404</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-muted-foreground">
                The governance action or page you&apos;re looking for doesn&apos;t exist.
              </p>
              <Link href="/">
                <Button className="w-full">Return to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
