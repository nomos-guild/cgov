import { useContentTranslation } from "@/hooks/useContentTranslation";

interface TranslatedTextProps {
  text: string;
  className?: string;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div";
}

/**
 * Component that auto-translates text when locale is not English.
 * Shows faded text while translating.
 */
export function TranslatedText({
  text,
  className,
  as: Component = "span",
}: TranslatedTextProps) {
  const { displayText, isTranslating } = useContentTranslation({
    originalText: text,
  });

  return (
    <Component className={className} style={isTranslating ? { opacity: 0.5 } : undefined}>
      {isTranslating ? text : displayText}
    </Component>
  );
}
