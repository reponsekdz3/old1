# TODO - Powerfull functional + advanced Kubernetes build

## Step 1: Repo inspection (K8s + backend)
- [x] Read `kubernetes-production.yaml`
- [x] Read backend startup/bootstrap files (`backend/app/__init__.py`, `backend/wsgi.py`, `backend/run.py`, `backend/config.py`)

## Step 2: Fix Kubernetes production manifest for real functionality
- [x] Correct DB secret wiring / missing env vars (see manifest edits)
- [ ] Add Redis env/credentials support (if required by backend security init).
- [ ] Add Ingress rules for WebSocket + API paths (multi-host routing) if missing.
- [x] Add resource tuning and production-safe readiness/liveness.


## Step 3: Migrations reliability on Kubernetes
- [ ] Add a K8s `Job` or `initContainer` that runs migration/schema init deterministically before app pods.
- [ ] Ensure app startup no longer performs heavy schema-altering operations on every replica (if feasible).

## Step 4: Observability for powerfull operations
- [ ] Expose/attach metrics endpoint (Prometheus) or at least improve health response content.

## Step 5: Validate
- [ ] Smoke test endpoints: `/api/health`, one auth endpoint, websocket connect path.
- [ ] Run backend tests (`pytest`) if changes require it.

