# wrap-up Changelog

All notable changes to this skill will be documented in this file.

## [1.1.0] - 2026-02-03

### Added
- **Step 1: Gather All File Changes** - New critical first step that runs `git status`, `git diff HEAD`, and `git ls-files --others` to capture ALL changes before creating the journey
- Explicit instruction to NOT proceed until git output is reviewed

### Changed
- Renumbered all steps (Step 1 → Step 2, etc.)
- Updated example output to show git gathering step
- Updated workflow list in description to include file gathering

### Why This Change
In long coding sessions, relying on conversation context alone misses changes. By making git review the mandatory first step, we ensure the journey captures everything that was actually changed, not just what's fresh in memory.

---

## [1.0.0] - 2026-02-02

### Initial Release
- End-of-session automation workflow
- Journey creation from session review
- Skill analysis for evolution opportunities
- Automated skill evolution with version management
- Journey update with evolution summary

### Why This Skill Exists
Created to automate the repetitive end-of-session workflow:
1. Create journey documenting learnings
2. Identify skills that need updates
3. Evolve skills based on learnings
4. Update journey with evolutions

Previously this was done manually over multiple steps.
