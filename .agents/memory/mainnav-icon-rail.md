---
name: MainNavigation Icon Rail
description: Discord-style sidebar pattern for web/src/components/MainNavigation.js
---

# MainNavigation Icon Rail

Layout: `flex h-full` → [icon rail 60px | content panel flex-1]

**Icon rail**: `hidden sm:flex w-[60px] bg-[#111b21]` — only shows on sm+ (≥640px). Contains NavBtn + Tooltip + Divider components. NavBtn has active indicator (green left bar), badge support, pulse dot. Tooltip appears on hover from left side.

**Content panel**: `flex-1 flex flex-col bg-[#f0f2f5]`. Header shows current tab name + new chat button. Mobile gets tab bar row (sm:hidden). Desktop gets tab bar in content panel. Mobile quick-access discover row (sm:hidden).

**NavBtn pattern**: `group` wrapper → tooltip uses `opacity-0 group-hover:opacity-100`.

**Why:** Discord-style keeps all navigation in a narrow rail instead of top tabs, freeing vertical space for chat content.

**How to apply:** Any new top-level destination goes into `discoverItems` array with path and accent color. New messaging tabs go into `messagingTabs` array with a corresponding tab content block.
