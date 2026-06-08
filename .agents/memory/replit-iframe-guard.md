---
name: Replit preview iframe guard
description: webSecurity.js clickjacking check breaks the Replit preview pane if it tries to navigate window.top.location.
---

## Rule
In `preventClickjacking()`, always bail out early when running inside a Replit dev domain iframe.

## Why
Replit embeds the app in a sandboxed cross-origin iframe. When window.self !== window.top,
a SecurityError is thrown trying to read window.top.location.hostname.
The fallback then tries window.top.location = window.self.location, which also throws
SecurityError and crashes the app before it can render.

## How to apply
Check window.location.hostname first (always readable). If it ends with `.replit.dev`,
`.repl.co`, or `.janeway.replit.dev`, return immediately without any frame-busting.
