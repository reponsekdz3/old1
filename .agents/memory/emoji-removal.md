---
name: Emoji Removal Convention
description: All UI emoji replaced with react-icons; demo message text kept as-is.
---

# Emoji Removal Convention

**Rule:** All UI chrome elements (buttons, labels, category pills, payment method icons, feature lists, banners, tabs) must use react-icons (react-icons/fi, react-icons/si) instead of Unicode emoji.

**Exception:** Demo/marketing message preview text in LoginPage CONTACTS and BUBBLES arrays simulates real user-typed messages — emoji there is intentional.

**Packages used:**
- `react-icons/fi` — Feather Icons (most UI elements)
- `react-icons/si` — Simple Icons (brand icons: SiBitcoin, SiEthereum)
- `react-icons/md` — Material Design (MdOutlineSubscriptions in TrendsPage)

**Pattern for payment method icons:** Use inline SVG paths or a colored rounded div with an icon component instead of emoji characters.

**Why:** User requirement — consistent vector icon language throughout; emoji render inconsistently across platforms.
