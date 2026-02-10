# Proposal Detail Layout Overhaul & Wallet SSR Fix

**Date**: 2026-02-09

## Summary

Major restructuring of the proposal detail page layout, moving from a single-column layout to a side-by-side arrangement. Also fixed a critical SSR crash caused by Mesh SDK's Web Crypto dependency, and moved social links from header to footer for a cleaner nav.

## What Was Done

1. **Wallet modal light-theme styling**: Added `wallet-item` class to wallet list buttons with white card-shadow styling in light theme CSS. Changed disconnect button from red `variant="destructive"` to white card-shadow outline style.

2. **Proposal detail page layout restructure**: Created a new top row with `lg:grid-cols-3` grid placing the proposal detail card (2/3 width) and time until expiry card (1/3 width) side by side horizontally, with the main chart grid below.

3. **Removed expand/collapse from Time Until Expiry card**: Showed all epoch info by default, removed `isTimeExpanded` state.

4. **Merged Vote Summary Card into Time Until Expiry card**: Moved gov action type, status, and constitutionality info into the expiry card as uniform table rows. Removed standalone Vote Summary Card and Badge component usage.

5. **Expanded proposal content preview**: Increased collapsed content height from `max-h-[3rem]` to `max-h-[14rem]`, added fade-to-transparent gradient overlay, moved expand button to card bottom with `mt-auto`.

6. **Swapped voting trend and cast-your-vote card positions**: Voting trend chart now appears above cast-your-vote in the right sidebar.

7. **Moved social links from Header to Footer**: Removed Website/GitHub/X buttons and `XIcon` component from Header, added them to Footer with muted icon styling.

8. **Fixed Mesh SDK SSR crash**: Replaced static imports and `next/dynamic` with runtime conditional imports that check `window.crypto.subtle` before loading. This fixed "Web Crypto API not supported" errors on HTTP connections (mobile) and reduced the shared `_app.js` bundle from 2.72 MB to 84 KB.

9. **Created `game-nav-btn-sm` compact variant**: Added a smaller version of the game-theme pill button (28px height, 0.75rem font) for inline dropdowns like the voting trend role filter. Fixed `w-full` overriding `w-[120px]` in GameDropdown.

## Key Learnings

- **CSS specificity beats Tailwind**: `[data-theme="game"] .game-nav-btn` has higher specificity than Tailwind utility classes like `h-8`, `px-2`, `text-xs`. When a CSS class sets `height: 40px`, Tailwind `h-8` cannot override it. Solution: create a separate CSS class variant (`game-nav-btn-sm`) rather than trying to override with Tailwind.

- **`w-full` vs `w-[120px]` in Tailwind**: When both are applied to the same element, which wins depends on CSS generation order, not class attribute order. Remove `w-full` from the component and let the caller's className control width.

- **`next/dynamic` with `ssr: false` is insufficient for modules that throw during evaluation**: The chunk still loads client-side and `@meshsdk/web3-sdk` throws at module evaluation time (top-level code) if Web Crypto is unavailable. Fix: use runtime conditional `import()` inside `useEffect` with a crypto support check, same pattern as `MeshProviderWrapper`.

- **HTTP vs HTTPS and Web Crypto**: `window.crypto.subtle` only exists in secure contexts (HTTPS or localhost). Mobile devices accessing `http://192.168.1.x:3000` over LAN won't have it.

## Files Changed

| File | Changes |
|------|---------|
| `src/pages/governance/[hash].tsx` | Layout restructure (proposal detail + expiry side-by-side), merged vote summary into expiry card, removed Badges, expanded content preview, swapped voting trend/cast-your-vote order, lazy VoteOnProposal import |
| `src/components/layout/Header.tsx` | Removed social links, removed static wallet import, added `LazyWalletButton` with crypto check |
| `src/components/Footer.tsx` | Added social links (Website, GitHub, X), XIcon component, theme-aware styling |
| `src/components/wallet/ConnectWalletModal.tsx` | Added `wallet-item` class, changed disconnect button styling |
| `src/components/ui/game-dropdown.tsx` | Switched to `game-nav-btn-sm`, removed `w-full` |
| `src/themes/light/tokens.css` | Added wallet modal card-style item CSS |
| `src/themes/dark/tokens.css` | Added vote button styling, vote confirmation dialog CSS |
| `src/themes/game/tokens.css` | Added `game-nav-btn-sm` compact variant, vote button glow styles |
| `src/components/governance/VoteOnProposal.tsx` | Vote button styling classes added (from previous session) |

## Patterns Discovered

### Lazy Component with Crypto Guard
For any component that imports `@meshsdk/*`, use this pattern instead of `next/dynamic`:
```tsx
function LazyWalletButton() {
  const [WalletBtn, setWalletBtn] = useState<ComponentType | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!(window.crypto && window.crypto.subtle)) return;
    import("@/components/wallet/ConnectWalletButton")
      .then((mod) => setWalletBtn(() => mod.ConnectWalletButton))
      .catch(() => {});
  }, []);
  if (!WalletBtn) return null;
  return <WalletBtn />;
}
```

### CSS Variant Pattern for Game Theme
When game-theme CSS classes are too large/prominent for inline contexts, create a `-sm` variant:
```css
[data-theme="game"] .game-nav-btn-sm {
  /* Same visual style, smaller dimensions */
  height: 28px;
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
}
```

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Lazy import with crypto check vs `next/dynamic` | `dynamic()` still evaluates module code client-side; runtime `import()` can be gated |
| `game-nav-btn-sm` as separate class vs size prop | CSS specificity makes Tailwind overrides impossible; separate class is cleaner |
| Social links in footer vs hiding them | Footer is standard placement, keeps header compact |
| `max-h-[14rem]` for collapsed content | Enough to show substantial text without scrolling, matches height of adjacent expiry card |
| Fade gradient on collapsed content | Better UX than hard clip — signals more content below |

## Skills Evolved

| Skill | Changes |
|-------|---------|
| `_patterns.md` | Added Mesh SDK lazy import pattern, CSS specificity vs Tailwind note |
