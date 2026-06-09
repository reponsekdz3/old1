---
name: Mobile Tab Layout
description: Expo Router tab configuration for mobile app
---

# Mobile Tab Layout

File: `mobile/app/(tabs)/_layout.js`

**Visible tabs (5):** Chats (index), Updates (status), Trends, Wallet, Calls
**Hidden tab:** Contacts — uses `tabBarButton: () => null` to hide from bar but keep route accessible.

**Tab order matters** — Expo Router renders tabs in JSX order. Trends and Wallet slots are third and fourth.

**Custom components:** TabBarIcon handles badge count overlay. Responsive sizing for small screens (W<360) and short devices (H<700).

**Screens with headerShown: false:** Trends (has its own custom header in the screen component).

**Why:** User wanted Trends + Wallet accessible from mobile tab bar; 5 visible tabs is the practical maximum for mobile UX.
