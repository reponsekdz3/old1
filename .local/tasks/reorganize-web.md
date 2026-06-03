# Move Frontend to Web Folder

## What & Why
Rename the existing `frontend/` directory to `web/` so the project clearly separates web and mobile codebases. Update all workflow commands and configuration references accordingly.

## Done looks like
- All existing web app files live under `web/` (was `frontend/`)
- The "Start application" workflow runs `cd web && npm start` on port 5000 and still works identically
- The `.replit` config is updated to reference `web/`
- Backend, node_modules, package.json etc all exist under `web/`

## Out of scope
- Any changes to the web app source code
- The mobile app (separate task)

## Steps
1. **Rename directory** — Rename `frontend/` to `web/` using bash `mv` command
2. **Update `.replit` workflow** — Change the Start application workflow command from `cd frontend` to `cd web`
3. **Verify** — Restart the Start application workflow and confirm the web app still loads on port 5000

## Relevant files
- `.replit`
- `frontend/package.json`
- `start.sh`
