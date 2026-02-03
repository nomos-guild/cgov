# Multi-Language Support Implementation

**Date**: 2026-02-03
**Duration**: Extended session
**Outcome**: Full i18n support with 7 languages and scalable translation architecture

## Summary

Implemented comprehensive multi-language support for CGOV, enabling users to view the entire application in English, German, French, Spanish, Portuguese, Japanese, or Chinese. The implementation uses next-intl for static UI strings (pre-translated at build time) and DeepL API for dynamic content (proposal titles, descriptions, voting rationales). A server-side caching layer ensures scalability for hundreds of concurrent users.

## What Was Done

1. **Configured Next.js i18n routing** - Added locale support in next.config.ts with sub-path routing (/de, /fr, etc.)

2. **Integrated next-intl library** - Set up NextIntlClientProvider in _app.tsx with locale-aware message loading

3. **Created translation infrastructure**
   - src/lib/i18n.ts - Locale configuration and types
   - src/messages/en.json - Complete English UI strings (~120 keys)
   - Translation script (scripts/translate.ts) for batch UI translation

4. **Pre-translated all UI strings** - Generated de.json, fr.json, es.json, pt.json, ja.json, zh.json using DeepL API

5. **Built language selector component** - LanguageSelector.tsx in header with native language names

6. **Implemented dynamic content translation**
   - /api/translate endpoint with DeepL integration
   - useContentTranslation hook for auto-translation
   - TranslatedText component for simple text translation

7. **Added server-side caching** - In-memory cache in translate API to share translations across all users

8. **Fixed translation queue race condition** - Global queue system prevents duplicate API calls and cache overwrites

9. **Upgraded to DeepL Pro** - Changed API endpoint from api-free.deepl.com to api.deepl.com

## Key Learnings

### 1. Avoid Middleware for Next.js i18n
The built-in `i18n` config in next.config.ts handles locale routing without custom middleware. This avoids:
- Redirect loops
- API route conflicts
- Static file serving issues

### 2. Translation Queue Prevents Race Conditions
When many components mount simultaneously (e.g., proposal list), they all try to translate at once. Without queuing:
- Multiple identical API calls fire
- localStorage gets overwritten mid-update
- Some translations get lost

Solution: Global queue with in-flight tracking and failed translation memoization.

### 3. Server-Side Cache is Essential for Scale
Per-user localStorage cache means every user translates the same content. Server-side cache:
- One DeepL call per unique text (regardless of user count)
- In-flight request deduplication (parallel requests share one API call)
- Reduces API costs dramatically

### 4. Pre-translate Static Content
UI strings (buttons, labels, headers) should be pre-translated at build time, not runtime:
- Zero API calls for UI text
- Instant rendering (no loading states)
- ~80% of visible text covered

### 5. Protected Terms Pattern
Cardano-specific terms (DRep, SPO, CC, ADA, etc.) should not be translated. Both the API endpoint and translation script use a DO_NOT_TRANSLATE list with post-processing to restore terms.

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| next.config.ts | Modified | Added i18n locale configuration |
| package.json | Modified | Added next-intl dependency |
| src/lib/i18n.ts | Created | Locale types and configuration |
| src/messages/en.json | Created | Complete English UI translations |
| src/messages/{de,fr,es,pt,ja,zh}.json | Created | Pre-translated UI strings |
| src/pages/_app.tsx | Modified | NextIntlClientProvider + all message imports |
| src/pages/_document.tsx | Modified | Dynamic lang attribute |
| src/pages/index.tsx | Modified | useTranslations hook usage |
| src/pages/dashboard.tsx | Modified | useTranslations hook usage |
| src/pages/governance/[hash].tsx | Modified | Auto-translate title & content |
| src/pages/404.tsx | Modified | Translated error page |
| src/components/layout/Header.tsx | Modified | Added LanguageSelector |
| src/components/LanguageSelector.tsx | Created | Language dropdown component |
| src/components/GovernanceTable.tsx | Modified | TranslatedText for proposal titles |
| src/components/GovernanceStats.tsx | Modified | Translated stat labels |
| src/components/Footer.tsx | Modified | Translated footer text |
| src/components/VotingRationaleModal.tsx | Modified | Auto-translate rationales |
| src/components/TranslatedText.tsx | Created | Simple auto-translating component |
| src/hooks/useContentTranslation.ts | Created | Translation hook with queue & cache |
| src/pages/api/translate.ts | Created | DeepL API proxy with server cache |
| scripts/translate.ts | Created | Batch UI string translation script |

## Patterns Discovered

### Translation Hook with Queue System
```typescript
// Global queue prevents race conditions
const translationQueue: QueueItem[] = [];
const inFlightTranslations = new Set<string>();
const failedTranslations = new Set<string>();

function queueTranslation(cacheKey, text, locale): Promise<string> {
  if (inFlightTranslations.has(cacheKey)) {
    // Wait for existing translation via polling
    return new Promise((resolve) => {
      const checkCache = () => {
        if (cache[cacheKey]) resolve(cache[cacheKey]);
        else setTimeout(checkCache, 200);
      };
      checkCache();
    });
  }
  // Queue new translation...
}
```

### Server-Side Translation Cache
```typescript
const serverCache = new Map<string, string>();
const inFlightRequests = new Map<string, Promise<string>>();

// Check cache first, dedupe in-flight requests
const cached = serverCache.get(cacheKey);
if (cached) return res.json({ translatedText: cached });

const inFlight = inFlightRequests.get(cacheKey);
if (inFlight) {
  const result = await inFlight;
  return res.json({ translatedText: result });
}
```

### Protected Terms Post-Processing
```typescript
const DO_NOT_TRANSLATE = ["DRep", "SPO", "CC", "ADA", ...];

// After translation, restore protected terms
for (const term of DO_NOT_TRANSLATE) {
  if (originalText.includes(term)) {
    const regex = new RegExp(term, "gi");
    translated = translated.replace(regex, term);
  }
}
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| next-intl over react-intl | Lighter weight, better Pages Router support |
| Sub-path routing (/de) over domain | Simpler deployment, shared caching |
| DeepL over Google Translate | Better quality, good free tier, simple API |
| Pre-translate UI strings | Eliminates ~80% of API calls |
| Server-side cache (in-memory) | Simple, effective for moderate scale |
| No persistent cache (Redis) | Can add later if needed, avoid complexity |
| Upgrade to DeepL Pro | Removes character limits, better rate limits |

## Future Improvements

- Add persistent translation cache (Redis/database) for deployment restarts
- Pre-translate active proposals during build/deploy
- Add hreflang meta tags for SEO
- Consider RTL support (Arabic, Hebrew) if needed

## Skills Evolved

Based on learnings from this session, the following skills were updated:

| Skill | Version | Changes |
|-------|---------|---------|
| add-api-route | 1.0.0 → 1.1.0 | Added third-party API integration pattern with server-side caching, in-flight request deduplication, and cache pruning |
