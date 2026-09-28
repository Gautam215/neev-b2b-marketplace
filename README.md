# Neev

Neev is a hyper-local B2B red-brick marketplace prototype for the NCR East launch zone.

The standalone `index.html` implements the PRD's non-HR clickable proof:

- Buyer need creation, landed-cost supplier comparison, freight confidence, quotes, reservations, and order timelines
- Vendor inventory updates, buyer requests, offers, dispatch handoff, and verified business profile
- Operations verification, inventory health, disputes, audit log, and release pipeline
- Deterministic fake records labelled `DEMO DATA`; no payment, SMS, dispatch, or vendor-document integrations

## Run locally

Open `index.html` in a browser. All demo state is stored locally in the browser and can be reset from the sidebar.

## CI/CD

`.github/workflows/ci.yml` runs the static quality gates on pull requests and deploys the verified `index.html` artifact to GitHub Pages after a successful push to `main`.
