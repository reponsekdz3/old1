---
name: Trends Page Rebuild
description: Schema migration and architecture decisions from the full TrendsPage rebuild
---

## What was built

Full TikTok/YouTube-Shorts-style Trends page with:
- `TrendSave`, `TrendFollow`, `CommentLike` models added inline to `trends.py`
- New API endpoints: `/me/saved`, `/me/creator-stats`, `/creators/<id>`, `/creators/<id>/follow`, `/video/<id>/save`, `/video/<id>/comment/<id>/like`
- Frontend: left sidebar (feed tabs, category grid, trending hashtags from API, top creators with follow buttons, platform stats), creator profile drawer, bookmark/save system, comment likes, ad overlay, double-tap like, speed controls, scroll snap feed, grid browse mode.

## Critical: PostgreSQL schema migration

**Why:** Database is PostgreSQL, not SQLite. `db.create_all()` only creates new tables — it does NOT add new columns to existing tables.

**How to apply:** Any time new columns are added to an existing model (`TrendVideo` etc.), they must be applied via:
```python
db.session.execute(db.text('ALTER TABLE trend_videos ADD COLUMN <col> <type>'))
```
Run this as a one-time migration script using the correct app context pattern.

## New columns added to trend_videos
- `video_url_sd` (TEXT)
- `video_url_hd` (TEXT)  
- `trending_score` (FLOAT DEFAULT 0.0)
- `saves` (INTEGER DEFAULT 0)

## New tables created
- `trend_saves` — video bookmarks per user
- `trend_follows` — creator follow relationships
- `trend_comment_likes` — comment likes per user
