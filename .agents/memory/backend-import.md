---
name: Backend app import pattern
description: How to correctly import and use the Flask app in scripts/migrations
---

## Pattern

```python
from app import create_app
from app.models.models import db

app, socketio = create_app()  # returns tuple, NOT just the app
with app.app_context():
    # do db work here
    pass
```

**Why:** `create_app()` returns `(app, socketio)` as a tuple. Doing `app = create_app()` and then `app.app_context()` will fail with `AttributeError: 'tuple' object has no attribute 'app_context'`.
