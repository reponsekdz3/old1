---
name: pywebpush install
description: How to install pywebpush and py-vapid in this Replit environment without permission errors.
---

## Rule
Install pywebpush and py-vapid using uv pip with an explicit --target pointing to .pythonlibs:

```
uv pip install pywebpush py-vapid --target /home/runner/workspace/.pythonlibs/lib/python3.12/site-packages
```

## Why
The Replit `installLanguagePackages` callback and standard pip try to write to the Nix store
(`/nix/store/...`) which is read-only, causing "Permission denied" errors.
Using `uv pip install --target` bypasses this by installing directly to the workspace's `.pythonlibs` folder,
which is on the writable filesystem and is already on the Python path.

## How to apply
Use this pattern any time a pip package install fails with "Permission denied" or "failed to create directory /nix/store/...".
After install, also add the package to backend/requirements.txt.
