# Design Direction

Status date: 2026-08-23 (Asia/Taipei)

## Direction

Qookey AI Resource Hub should use a clean resource-marketplace information architecture inspired by modern Agent / Skill marketplaces such as Capafy, while keeping Qookey's own branding, copy, visual system, data model, and implementation.

This is a structural reference, not a pixel clone.

## Current V0.3 layout

1. Sticky top navigation.
2. Centered hero statement.
3. Large task/resource search box.
4. Trending category chips directly below search.
5. Resource statistics.
6. Marketplace content area with filters and sorting.
7. Responsive resource-card grid.
8. Supporting product/value section below the catalog.
9. Mobile-first responsive fallback.

## Preserve

- `data/resources.json` remains the catalog authority.
- Existing search and filters remain functional.
- Multi-category resources remain supported.
- Public catalog must not expose private dashboard URLs, organization IDs, auth-flow URLs, credentials, tokens, or secrets.

## Future refinement areas

These details can change without redesigning the information architecture:

- brand color and accent palette
- typography
- card density and height
- icons and thumbnails
- category chip ordering
- hero copy
- navigation items
- spacing and border radius
- dark/light theme support
- favorites and collections
- per-resource detail pages
- AI recommendation entry point

## Non-goal

Do not copy Capafy assets, trademarks, proprietary code, exact page content, or exact visual styling. Reuse only general marketplace UX patterns and information architecture.
