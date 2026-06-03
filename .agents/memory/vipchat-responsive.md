---
name: VipChat responsive pattern
description: How responsive scaling is implemented across all mobile screens in VipChat
---

# Responsive Scaling Pattern

All mobile screens use a `rf()` (responsive font/size) function that scales values proportionally to the device width, using 390pt (iPhone 14) as the baseline.

## Module-level pattern (for StyleSheet.create files)
```js
const { width: SW } = Dimensions.get('window');
const rf = (n) => n * (SW / 390);
```
Place these constants AFTER all import statements. JavaScript ES modules do not allow statements between import declarations — this was a repeated bug during implementation.

## Component-level pattern (for components that need to re-render on rotation)
```js
const { width: W, height: H } = useWindowDimensions();
const fs = (base) => base * (W / 390);
```
Use inside the component function body.

## Files updated (all use module-level rf())
- `mobile/app/login.js` — fully rewritten, uses useWindowDimensions
- `mobile/app/signup.js` — fully rewritten, uses useWindowDimensions
- `mobile/app/(tabs)/_layout.js` — fully rewritten, uses useWindowDimensions
- `mobile/app/(tabs)/index.js` — styles updated with rf()
- `mobile/app/(tabs)/contacts.js` — styles updated with rf()
- `mobile/app/(tabs)/calls.js` — styles updated with rf()
- `mobile/app/(tabs)/status.js` — styles updated with rf()
- `mobile/app/profile.js` — styles updated with rf()
- `mobile/app/settings.js` — styles updated with rf()
- `mobile/app/chat/[id].js` — styles updated with _rf() (uses underscore prefix to avoid naming clash)
- `mobile/components/ChatListItem.js` — styles updated with rf()

**Why:** Fixed all fixed pixel values that looked correct on iPhone 14 but broke on smaller/larger screens, tablets, and foldables.
