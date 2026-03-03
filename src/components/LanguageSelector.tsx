import { useRouter } from "next/router";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { locales, localeNames, type Locale } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function LanguageSelector() {
  const router = useRouter();
  const t = useTranslations("language");
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";
  const currentLocale = (router.locale ?? "en") as Locale;

  const handleLocaleChange = (newLocale: string) => {
    // Set NEXT_LOCALE cookie so Next.js handles locale routing server-side on future visits
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
    localStorage.setItem("preferred-locale", newLocale);

    // Navigate to the same page with new locale
    router.push({ pathname: router.pathname, query: router.query }, undefined, {
      locale: newLocale,
    });
  };

  return (
    <Select value={currentLocale} onValueChange={handleLocaleChange}>
      <SelectTrigger
        className={cn(
          "[&>svg]:hidden",
          isGame
            ? "game-nav-btn nav-link styled-button h-10 px-2 sm:px-4 min-w-0"
            : "h-10 w-auto px-3 justify-center rounded-full border-input bg-background/80 text-foreground shadow-soft btn-neon ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus:border-black data-[state=open]:ring-0 data-[state=open]:ring-transparent data-[state=open]:ring-offset-0 data-[state=open]:border-black dark:focus:border-[#0bd1a2] dark:data-[state=open]:border-[#0bd1a2]"
        )}
        aria-label={t("selectLanguage")}
      >
        {currentLocale.toUpperCase()}
      </SelectTrigger>
      <SelectContent
        className={cn(
          isGame
            ? "border-white/20 bg-black/90 text-white"
            : "border-border bg-background dark:border-[#0bd1a2] dark:bg-black dark:text-[#0bd1a2]"
        )}
      >
        {locales.map((locale) => (
          <SelectItem
            key={locale}
            value={locale}
            className={cn(
              isGame
                ? "focus:bg-white/10 focus:text-white"
                : "focus:bg-accent dark:focus:bg-[#0bd1a2]/10 dark:focus:text-[#0bd1a2]"
            )}
          >
            {localeNames[locale]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
