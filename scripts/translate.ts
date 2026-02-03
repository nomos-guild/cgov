/**
 * DeepL Translation Script for CGOV i18n
 *
 * Usage:
 *   npx tsx scripts/translate.ts
 *
 * Reads DEEPL_API_KEY from .env file
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env file
dotenv.config();

// DeepL Pro API (use api-free.deepl.com for free tier)
const DEEPL_API_URL = "https://api.deepl.com/v2/translate";

// Target languages (DeepL language codes)
const TARGET_LANGUAGES: Record<string, string> = {
  de: "DE",      // German
  fr: "FR",      // French
  es: "ES",      // Spanish
  pt: "PT-PT",   // Portuguese (European)
  ja: "JA",      // Japanese
  zh: "ZH-HANS", // Chinese (Simplified)
};

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
];

interface TranslationResult {
  translations: Array<{
    detected_source_language: string;
    text: string;
  }>;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateText(
  text: string,
  targetLang: string,
  apiKey: string,
  retries = 3
): Promise<string> {
  // Skip empty strings
  if (!text || text.trim() === "") return text;

  // Check if text is just a term that shouldn't be translated
  if (DO_NOT_TRANSLATE.includes(text.trim())) return text;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(DEEPL_API_URL, {
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: [text],
          target_lang: targetLang,
          source_lang: "EN",
          preserve_formatting: true,
        }),
      });

      if (response.status === 429) {
        // Rate limited - wait and retry
        const waitTime = attempt * 5000; // 5s, 10s, 15s
        console.log(`    ⏳ Rate limited, waiting ${waitTime / 1000}s...`);
        await sleep(waitTime);
        continue;
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepL API error: ${response.status} - ${error}`);
      }

      const result: TranslationResult = await response.json();
      let translated = result.translations[0].text;

      // Post-process: restore terms that might have been incorrectly translated
      for (const term of DO_NOT_TRANSLATE) {
        if (text.includes(term)) {
          const regex = new RegExp(term, "gi");
          translated = translated.replace(regex, term);
        }
      }

      return translated;
    } catch (error) {
      if (attempt === retries) throw error;
      await sleep(2000);
    }
  }

  return text; // Fallback to original
}

async function translateObject(
  obj: Record<string, unknown>,
  targetLang: string,
  apiKey: string,
  parentKey = ""
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = parentKey ? `${parentKey}.${key}` : key;

    if (typeof value === "string") {
      try {
        result[key] = await translateText(value, targetLang, apiKey);
        console.log(`  ✓ ${fullKey}`);
      } catch (error) {
        console.error(`  ✗ ${fullKey}: ${error}`);
        result[key] = value; // Keep original on error
      }

      // Delay to avoid rate limiting (500ms between requests)
      await sleep(500);
    } else if (typeof value === "object" && value !== null) {
      result[key] = await translateObject(
        value as Record<string, unknown>,
        targetLang,
        apiKey,
        fullKey
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

async function main() {
  const apiKey = process.env.DEEPL_API_KEY;

  if (!apiKey) {
    console.error("Error: DEEPL_API_KEY not found in .env file");
    console.error("Add this line to your .env file:");
    console.error("  DEEPL_API_KEY=your-api-key-here");
    process.exit(1);
  }

  const messagesDir = path.join(__dirname, "..", "src", "messages");
  const enPath = path.join(messagesDir, "en.json");

  // Read English source
  const enContent = JSON.parse(fs.readFileSync(enPath, "utf-8"));

  console.log("🌐 Starting CGOV translation with DeepL...\n");
  console.log("Protected terms:", DO_NOT_TRANSLATE.join(", "));
  console.log("");

  for (const [locale, deeplLang] of Object.entries(TARGET_LANGUAGES)) {
    const outputPath = path.join(messagesDir, `${locale}.json`);

    console.log(`\n📝 Translating to ${locale} (${deeplLang})...`);

    try {
      const translated = await translateObject(enContent, deeplLang, apiKey);

      fs.writeFileSync(outputPath, JSON.stringify(translated, null, 2), "utf-8");
      console.log(`✅ Saved ${locale}.json`);
    } catch (error) {
      console.error(`❌ Failed to translate ${locale}: ${error}`);
    }
  }

  console.log("\n🎉 Translation complete!");
  console.log("\nCharacter usage estimate: ~30,000 characters");
  console.log("(Check your DeepL dashboard for exact usage)");
}

main().catch(console.error);
