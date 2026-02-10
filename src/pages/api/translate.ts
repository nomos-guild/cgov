import type { NextApiRequest, NextApiResponse } from "next";

// DeepL Pro API (use api-free.deepl.com for free tier)
const DEEPL_API_URL = "https://api.deepl.com/v2/translate";

// Terms that should NOT be translated (Cardano-specific)
const DO_NOT_TRANSLATE = [
  "CGOV",
  "DRep",
  "DReps",
  "SPO",
  "SPOs",
  "CC",
  "NCL",
  "ADA",
  "Cardano",
  "Nomos",
  "Mesh",
  "SIDAN",
  "CIP-1694",
  "Conway",
];

// Map our locale codes to DeepL language codes
const LOCALE_TO_DEEPL: Record<string, string> = {
  de: "DE",
  fr: "FR",
  es: "ES",
  pt: "PT-PT",
  ja: "JA",
  zh: "ZH-HANS",
};

interface TranslateRequest {
  text: string;
  targetLang: string;
}

interface DeepLResponse {
  translations: Array<{
    detected_source_language: string;
    text: string;
  }>;
}

// Server-side translation cache (shared across all users on same instance)
// Key: hash of text + targetLang, Value: translated text
const serverCache = new Map<string, string>();

// Track in-flight requests to prevent duplicate API calls
const inFlightRequests = new Map<string, Promise<string>>();

// Simple hash function for cache keys
function hashKey(text: string, lang: string): string {
  let hash = 0;
  const str = `${lang}:${text}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${lang}:${Math.abs(hash)}:${text.length}`;
}

// Limit cache size to prevent memory issues (keep most recent 1000 entries)
function pruneCache() {
  if (serverCache.size > 1000) {
    const keysToDelete = Array.from(serverCache.keys()).slice(0, 200);
    keysToDelete.forEach(key => serverCache.delete(key));
  }
}

async function translateWithDeepL(
  text: string,
  deeplLang: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(DEEPL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: [text],
      target_lang: deeplLang,
      source_lang: "EN",
      preserve_formatting: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("DeepL API error:", response.status, error);
    throw new Error(`DeepL API error: ${response.status}`);
  }

  const result: DeepLResponse = await response.json();
  let translatedText = result.translations[0].text;

  // Post-process: restore terms that might have been incorrectly translated
  for (const term of DO_NOT_TRANSLATE) {
    if (text.includes(term)) {
      const regex = new RegExp(term, "gi");
      translatedText = translatedText.replace(regex, term);
    }
  }

  return translatedText;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Translation service not configured" });
  }

  const { text, targetLang } = req.body as TranslateRequest;

  if (!text || !targetLang) {
    return res.status(400).json({ error: "Missing text or targetLang" });
  }

  // Don't translate to English (source language)
  if (targetLang === "en") {
    return res.status(200).json({ translatedText: text });
  }

  const deeplLang = LOCALE_TO_DEEPL[targetLang];
  if (!deeplLang) {
    return res.status(400).json({ error: `Unsupported language: ${targetLang}` });
  }

  // Skip translation if text is just a protected term
  if (DO_NOT_TRANSLATE.includes(text.trim())) {
    return res.status(200).json({ translatedText: text });
  }

  const cacheKey = hashKey(text, targetLang);

  // Check server cache first
  const cached = serverCache.get(cacheKey);
  if (cached) {
    return res.status(200).json({ translatedText: cached, cached: true });
  }

  // Check if there's already an in-flight request for this text
  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    try {
      const translatedText = await inFlight;
      return res.status(200).json({ translatedText, cached: true });
    } catch {
      return res.status(500).json({ error: "Translation failed" });
    }
  }

  // Create translation promise and track it
  const translationPromise = translateWithDeepL(text, deeplLang, apiKey);
  inFlightRequests.set(cacheKey, translationPromise);

  try {
    const translatedText = await translationPromise;

    // Cache the result
    serverCache.set(cacheKey, translatedText);
    pruneCache();

    // Clean up in-flight tracker
    inFlightRequests.delete(cacheKey);

    return res.status(200).json({ translatedText });
  } catch (error) {
    // Clean up in-flight tracker
    inFlightRequests.delete(cacheKey);

    console.error("Translation error:", error);
    return res.status(500).json({ error: "Translation service error" });
  }
}
