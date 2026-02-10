import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/router";

// Simple cache: key -> translated text (no expiration)
interface TranslationCache {
  [key: string]: string;
}

const CACHE_KEY = "cgov-translations";

// Global translation queue to prevent race conditions
type QueueItem = {
  cacheKey: string;
  text: string;
  locale: string;
  resolve: (translated: string) => void;
  reject: (error: Error) => void;
};

const translationQueue: QueueItem[] = [];
let isProcessingQueue = false;

// Track in-flight translations to prevent duplicate requests
const inFlightTranslations = new Set<string>();

// Track failed translations to prevent infinite retries (reset on page refresh)
const failedTranslations = new Set<string>();

async function processQueue() {
  if (isProcessingQueue || translationQueue.length === 0) return;
  isProcessingQueue = true;

  while (translationQueue.length > 0) {
    const item = translationQueue.shift()!;

    // Check cache again (might have been translated while in queue)
    const cache = getCache();
    if (cache[item.cacheKey]) {
      inFlightTranslations.delete(item.cacheKey);
      item.resolve(cache[item.cacheKey]);
      continue;
    }

    // Skip if already marked as failed
    if (failedTranslations.has(item.cacheKey)) {
      inFlightTranslations.delete(item.cacheKey);
      item.reject(new Error("Translation previously failed"));
      continue;
    }

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: item.text,
          targetLang: item.locale,
        }),
      });

      if (!response.ok) {
        throw new Error("Translation failed");
      }

      const data = await response.json();
      const translated = data.translatedText;

      // Cache the translation
      const currentCache = getCache();
      currentCache[item.cacheKey] = translated;
      setCache(currentCache);

      inFlightTranslations.delete(item.cacheKey);
      item.resolve(translated);
    } catch (err) {
      // Mark as failed to prevent retries
      failedTranslations.add(item.cacheKey);
      inFlightTranslations.delete(item.cacheKey);
      item.reject(err instanceof Error ? err : new Error("Translation failed"));
    }

    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  isProcessingQueue = false;
}

function queueTranslation(cacheKey: string, text: string, locale: string): Promise<string> {
  // Check if already in flight - return existing promise behavior
  if (inFlightTranslations.has(cacheKey)) {
    // Already being translated, wait for it via cache check
    return new Promise((resolve) => {
      const checkCache = () => {
        const cache = getCache();
        if (cache[cacheKey]) {
          resolve(cache[cacheKey]);
        } else if (failedTranslations.has(cacheKey)) {
          resolve(text); // Return original on failure
        } else {
          setTimeout(checkCache, 200);
        }
      };
      setTimeout(checkCache, 200);
    });
  }

  // Check if previously failed - return original text
  if (failedTranslations.has(cacheKey)) {
    return Promise.resolve(text);
  }

  inFlightTranslations.add(cacheKey);

  return new Promise((resolve, reject) => {
    translationQueue.push({ cacheKey, text, locale, resolve, reject });
    processQueue();
  });
}

function getCacheKey(text: string, locale: string): string {
  // Create a hash from the first 100 chars + length to keep keys manageable
  const shortText = text.slice(0, 100);
  return `${locale}:${shortText.length}:${text.length}:${hashCode(text)}`;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

function getCache(): TranslationCache {
  if (typeof window === "undefined") return {};
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return {};
    const parsed = JSON.parse(cached);

    // Migrate old format {text, timestamp} to new format (just string)
    const migrated: TranslationCache = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        migrated[key] = value;
      } else if (value && typeof value === "object" && "text" in value) {
        // Old format: {text: string, timestamp: number}
        migrated[key] = (value as { text: string }).text;
      }
    }
    return migrated;
  } catch {
    return {};
  }
}

function setCache(cache: TranslationCache): void {
  if (typeof window === "undefined") return;
  try {
    // Limit cache size to prevent localStorage bloat (keep max 500 entries)
    const entries = Object.entries(cache);
    if (entries.length > 500) {
      // Keep the first 400 entries (oldest get removed as new ones are added)
      cache = Object.fromEntries(entries.slice(-400));
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage might be full or disabled
  }
}

interface UseContentTranslationOptions {
  /** Original text to potentially translate */
  originalText: string;
}

interface UseContentTranslationResult {
  /** The text to display (translated or original) */
  displayText: string;
  /** Whether translation is in progress */
  isTranslating: boolean;
  /** Whether we're showing translated content */
  isTranslated: boolean;
  /** Error message if translation failed */
  error: string | null;
  /** Translate the content */
  translate: () => Promise<void>;
  /** Show original content */
  showOriginal: () => void;
  /** Whether translation is available (non-English locale) */
  canTranslate: boolean;
}

export function useContentTranslation({
  originalText,
}: UseContentTranslationOptions): UseContentTranslationResult {
  const router = useRouter();
  const locale = router.locale ?? "en";

  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if component is mounted to avoid state updates after unmount
  const isMountedRef = useRef(true);

  // Track which cacheKey we've already attempted to prevent re-running effect
  const attemptedRef = useRef<string | null>(null);

  const canTranslate = locale !== "en" && Boolean(originalText);
  const cacheKey = getCacheKey(originalText, locale);

  // Reset state when switching back to English
  useEffect(() => {
    if (locale === "en") {
      setTranslatedText(null);
      setIsTranslated(false);
      setIsTranslating(false);
      setError(null);
      attemptedRef.current = null;
    }
  }, [locale]);

  // Auto-translate on mount when locale is not English
  useEffect(() => {
    isMountedRef.current = true;

    if (!canTranslate || !originalText) return;

    // Don't re-attempt if we already tried this cacheKey
    if (attemptedRef.current === cacheKey) return;

    // Check cache first
    const cache = getCache();
    const cached = cache[cacheKey];
    if (cached) {
      setTranslatedText(cached);
      setIsTranslated(true);
      attemptedRef.current = cacheKey;
      return;
    }

    // Check if previously failed - don't retry
    if (failedTranslations.has(cacheKey)) {
      setError("Translation previously failed");
      attemptedRef.current = cacheKey;
      return;
    }

    // Mark as attempted before queueing
    attemptedRef.current = cacheKey;

    // Queue translation
    setIsTranslating(true);
    setError(null);

    queueTranslation(cacheKey, originalText, locale)
      .then((translated) => {
        if (isMountedRef.current) {
          setTranslatedText(translated);
          setIsTranslated(true);
          setIsTranslating(false);
        }
      })
      .catch((err) => {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : "Translation failed");
          setIsTranslated(false);
          setIsTranslating(false);
        }
      });

    return () => {
      isMountedRef.current = false;
    };
  }, [canTranslate, originalText, cacheKey, locale]);

  const translate = useCallback(async () => {
    if (!canTranslate || !originalText) return;
    if (translatedText) {
      // Already have translation, just show it
      setIsTranslated(true);
      return;
    }

    setIsTranslating(true);
    setError(null);

    try {
      const translated = await queueTranslation(cacheKey, originalText, locale);
      setTranslatedText(translated);
      setIsTranslated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setIsTranslating(false);
    }
  }, [canTranslate, originalText, translatedText, locale, cacheKey]);

  const showOriginal = useCallback(() => {
    setIsTranslated(false);
  }, []);

  return {
    displayText: isTranslated && translatedText ? translatedText : originalText,
    isTranslating,
    isTranslated,
    error,
    translate,
    showOriginal,
    canTranslate,
  };
}
