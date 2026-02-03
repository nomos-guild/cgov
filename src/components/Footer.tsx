import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-border glass mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">CGOV</h3>
            <p className="text-sm text-muted-foreground">
              {t("builtBy")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

