# i18n Changelog

All notable changes to this skill will be documented in this file.

## [1.0.0] - 2026-02-04

### Initial Release
- Complete i18n workflow: identify strings, choose namespace, add keys, wire in components
- All 7 locale files documented (en, de, fr, es, pt, ja, zh)
- 23 existing namespaces catalogued with purpose and example keys
- Pattern A: Direct `useTranslations()` hook usage
- Pattern B: Mapping API values to translations (translateVote pattern)
- Pattern C: Typed labels interface for pure utility functions (ExportLabels pattern)
- Pattern D: Locale-aware date/number formatting
- UTF-8 BOM guidance for CSV exports
- Batch translation of dynamic content via DeepL API
- JSON export key preservation rules
- Project conventions: what stays English vs what gets translated
- Verification checklist and common mistakes table

### Journey-driven
Based on the localized-export-files and landing-page-i18n sessions. Key learnings:
- Landing page filter dropdowns and action type/status on cards stay English
- Pure utility functions need typed labels pattern since they can't use React hooks
- Badge styling must use original English values, not translated display text
- UTF-8 BOM is essential for Excel to handle non-ASCII CSV content
