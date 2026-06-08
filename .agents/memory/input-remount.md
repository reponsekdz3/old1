---
name: Input remount bug pattern
description: Defining a React component inside another component's render causes remount every render, losing input focus after each keystroke.
---

## Rule
Never define a React component (`function Field() {}` or `const Field = () => {}`) inside another component's render function body.

**Why:** React treats it as a new component type on every render. This causes the old DOM node to unmount and a fresh one to mount, which destroys focus — the user must click the input again after every keystroke.

**How to apply:** Always define helper components at module level (outside the parent component function). Pure rendering helpers that need props from the parent should accept those props explicitly, not close over them.

In VipChat, `SignupPage.js` had `Field` and `inputCls` defined inside `SignupPage`. This was the root cause of the "typing stops after each character" bug. Fixed by moving both to module level.
