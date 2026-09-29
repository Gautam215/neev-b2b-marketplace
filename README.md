# Neev

Neev is a production-shaped B2B marketplace for sourcing red bricks from local kilns in the NCR East launch area. It turns a fragmented material purchase into one visible path: search, quote, payment, dispatch, delivery proof, and reconciliation.

The repository contains a no-build browser demo, a Next.js workspace, and an Express API. Demo records are fictional. The demo does not take real payments, reserve real stock, or send a real truck.

**Live demo:** [neev-web.onrender.com](https://neev-web.onrender.com)
**API readiness:** [neev-api-adnc.onrender.com/api/v1/health/ready](https://neev-api-adnc.onrender.com/api/v1/health/ready)
**API documentation:** `/api/v1/docs` on a running API

## Product Loop

```mermaid
flowchart LR
  Need[Buyer need] --> Search[Search inventory]
  Search --> Request[Request a quote]
  Request --> Compare[Compare delivered cost]
  Compare --> Accept[Accept a quote]
  Accept --> Pay[Verify payment]
  Pay --> Dispatch[Schedule dispatch]
  Dispatch --> Proof[Receive delivery proof]
  Proof --> Reconcile[Reconcile quantity]
```

The browser demo makes this loop easy to explore. The API repeats every important authorization, validation, state, and idempotency check on the server.

## Screenshots

<p align="center">
  <img src="docs/screenshots/neev-homepage.jpg" alt="Neev public homepage" width="49%" />
  <img src="docs/screenshots/neev-workspace.jpg" alt="Neev buyer workspace" width="49%" />
</p>

## System Shape

```mermaid
flowchart TB
  Browser[Static demo or Next.js workspace]
  API[Express API]
  Auth[JWT verification and RBAC]
  PG[(PostgreSQL and Prisma)]
  Redis[(Redis)]
  Workers[BullMQ workers]
  Mongo[(Optional encrypted MongoDB)]
  Browser --> API
  API --> Auth
  Auth --> PG
  API --> PG
  API --> Redis
  Redis --> Workers
  Workers --> PG
  API -. encrypted documents only .-> Mongo
```

![Detailed Neev architecture](docs/diagrams/neev-architecture.svg)

### Request Boundary

```mermaid
flowchart LR
  Client[Browser or provider]
  Edge[Express middleware]
  Route[Validated route]
  Domain[State and permission rules]
  Store[(PostgreSQL)]
  Queue[(Redis queues)]
  Client --> Edge
  Edge -->|health and docs| Route
  Edge -->|Bearer token| Auth[Authenticate]
  Auth -->|permission| Route
  Route --> Domain
  Domain --> Store
  Route --> Queue
```

### Trust Boundary

```mermaid
flowchart TB
  Untrusted[Untrusted request]
  Limits[Request size limits]
  Signature[Webhook HMAC check]
  Token[JWT check]
  Schema[Zod schema check]
  Permission[Organization and role permission]
  Transaction[Prisma transaction]
  Untrusted --> Limits
  Limits --> Signature
  Limits --> Token
  Signature --> Schema
  Token --> Schema
  Schema --> Permission
  Permission --> Transaction
```

## Authentication

Neev accepts short-lived access JWTs issued by the identity boundary. It does not accept arbitrary signed payloads just because the signature is valid.

```mermaid
sequenceDiagram
  participant C as Client
  participant A as API
  participant D as PostgreSQL
  C->>A: Authorization Bearer access token
  A->>A: Allow only HS256
  A->>A: Check issuer audience exp and tokenType
  A->>A: Validate sub organizationId and unique roles
  A->>D: Load active user by sub
  D-->>A: Current organization and roles
  A->>A: Compare token claims with database
  A-->>C: Continue or return 401
```

Required access-token claims are:

```text
sub             user id
organizationId  current organization id
roles           one or more unique roles
tokenType       access
iat             issued-at timestamp
exp             expiry timestamp
```

`AUTH_REQUIRE_USER_LOOKUP=true` is the production default. Deactivating a user or changing its organization or roles invalidates previously issued tokens on the next request.

### Roles And Permissions

```mermaid
flowchart TB
  Buyer[buyer] --> BuyerActions[quote request, buyer quote acceptance, pricing, read timeline]
  Finance[buyer_finance] --> FinanceActions[buyer actions plus payment intent creation]
  Supplier[supplier] --> SupplierActions[supplier quote response, inventory, pricing]
  SupplierOps[supplier_ops] --> OpsActions[inventory, dispatch, proof, sustainability write]
  Admin[ops_admin] --> All[all API permissions]
```

Permission checks are explicit and organization-scoped. A valid token with the wrong role returns `403`; a missing or invalid token returns `401`.

## Marketplace State

```mermaid
flowchart LR
  R[REQUESTED] --> Q[QUOTED]
  Q --> A[ACCEPTED]
  R --> X[EXPIRED]
  Q --> X
  R --> C[CANCELLED]
  Q --> C
```

```mermaid
flowchart LR
  Pending[PAYMENT_PENDING] --> Verified[PAYMENT_VERIFIED]
  Verified --> Scheduled[DISPATCH_SCHEDULED]
  Scheduled --> Transit[IN_TRANSIT]
  Scheduled --> Proof[PROOF_RECEIVED]
  Transit --> Proof
  Proof --> Reconciled[RECONCILED]
  Proof --> Disputed[DISPUTED]
  Pending --> Disputed
  Verified --> Disputed
  Scheduled --> Disputed
  Transit --> Disputed
  Disputed --> Reconciled
```

Routes and workers call the same transition rules. A state cannot be changed by directly writing a plausible-looking status.

![Detailed Neev order flow](docs/diagrams/neev-order-flow.svg)

## Payments And Background Jobs

Provider webhooks are acknowledged quickly, then processed by a worker. The raw body is checked before JSON parsing, and the `(gateway, eventId)` pair is unique in both the database ledger and the queue job identity.

```mermaid
sequenceDiagram
  participant G as Payment gateway
  participant A as API
  participant R as Redis
  participant W as Worker
  participant P as PostgreSQL
  G->>A: Signed raw webhook body
  A->>A: Verify HMAC and timestamp
  A->>R: Enqueue deterministic event job
  A-->>G: 202 accepted
  W->>R: Claim job
  W->>P: Write webhook ledger
  W->>P: Verify amount currency and order
  W->>P: Update payment and order in transaction
  W->>P: Write audit event
```

```mermaid
flowchart LR
  Webhook[Payment webhook] --> PaymentQueue[neev.payment-webhooks]
  Proof[Delivery proof] --> ReconcileQueue[neev.reconciliation]
  PaymentQueue --> PaymentWorker[Payment worker]
  ReconcileQueue --> ReconcileWorker[Reconciliation worker]
  PaymentWorker --> Ledger[(Webhook ledger)]
  PaymentWorker --> Order[(Order state)]
  ReconcileWorker --> Order
```

Both queues use five attempts with exponential backoff. Completed and failed jobs are retained for bounded operational inspection. Repeated webhook or reconciliation requests resolve to the same job identity.

## Data Ownership

```mermaid
flowchart TB
  Data{What kind of data is it?}
  Data -->|transactional marketplace record| PG[(PostgreSQL)]
  Data -->|queue, lock, or cache state| Redis[(Redis)]
  Data -->|encrypted document or archive| Mongo[(Optional MongoDB)]
  PG --> Orders[users, organizations, quotes, orders, payments, audit]
  Redis --> Jobs[webhooks and reconciliation jobs]
  Mongo --> Documents[encrypted payloads with version and timestamps]
```

### MongoDB Decision

```mermaid
flowchart TD
  Input[New data requirement] --> Transaction{Must be atomic with order state?}
  Transaction -->|yes| Postgres[Use PostgreSQL]
  Transaction -->|no| Sensitive{Is it a large document or archive?}
  Sensitive -->|no| Postgres
  Sensitive -->|yes| Encrypted{Can it be encrypted before storage?}
  Encrypted -->|no| Review[Security review before storage]
  Encrypted -->|yes| Mongo[Optional encrypted MongoDB]
```

MongoDB is not a second source of truth for orders, payments, inventory, or permissions. It is opt-in, requires a 32-byte encryption key, and is disabled when `MONGODB_URL` is absent. See [`docs/database-decision.md`](docs/database-decision.md).

## API Map

```mermaid
flowchart TB
  API[/api/v1]
  API --> Health[/health]
  API --> Docs[/docs]
  API --> Auth[/auth]
  API --> Search[/search]
  API --> Quotes[/quote-requests and /quotes]
  API --> Payment[/payment-intents and /payments]
  API --> Pricing[/pricing]
  API --> Supply[/inventory and /sustainability]
  API --> Delivery[/dispatches and /orders]
```

| Area | Main behavior |
| --- | --- |
| `/health` | Liveness and dependency readiness |
| `/auth` | Password login, rotating refresh cookie, logout, and current-user lookup |
| `/search` | Authenticated catalog search with safe filters |
| `/quote-requests` | Organization-scoped quote creation and idempotency |
| `/quotes` | Supplier responses and buyer acceptance |
| `/payment-intents` | Payment intent creation for authorized finance users |
| `/payments/:gateway/webhook` | HMAC-verified webhook queueing |
| `/pricing` | Delivered price calculation |
| `/sustainability` | Read and write sustainability metrics |
| `/inventory` | Supplier inventory updates |
| `/dispatches` | Dispatch scheduling and delivery proof |
| `/orders/:id/timeline` | Organization-scoped order timeline |

OpenAPI JSON is available at `/api/v1/docs/openapi.json`. Swagger UI is available at `/api/v1/docs`.

## Repository Map

```mermaid
flowchart LR
  Root[Repository root]
  Root --> Demo[index.html and workspace.html]
  Root --> Web[apps/web]
  Root --> Api[apps/api]
  Root --> Docs[docs]
  Root --> CI[.github/workflows/ci.yml]
  Api --> Routes[src/routes]
  Api --> Rules[src/lib and src/middleware]
  Api --> Prisma[prisma schema and migrations]
  Api --> Tests[test]
  Docs --> Diagrams[diagrams]
  Docs --> Shots[screenshots]
```

| Path | Purpose |
| --- | --- |
| `index.html` | Public no-build demo |
| `workspace.html` | Buyer, supplier, and operations demo |
| `apps/web/` | Next.js workspace and shared components |
| `apps/api/src/routes/` | Express route adapters |
| `apps/api/src/lib/` | Auth, RBAC, state, queues, audit, data access, and realtime |
| `apps/api/prisma/` | PostgreSQL schema and committed migrations |
| `apps/api/test/` | API, authorization, state, queue, and encryption tests |
| `docs/diagrams/` | Detailed SVG architecture and workflow diagrams |
| `docs/screenshots/` | README screenshots |
| `.github/workflows/ci.yml` | Quality gates and static demo deployment |

## Local Setup

```mermaid
flowchart TD
  Clone[Clone repository] --> Node[Use Node 20 or newer]
  Node --> Services[Start PostgreSQL and Redis]
  Services --> Env[Copy apps/api/.env.example to apps/api/.env]
  Env --> Client[Generate Prisma client]
  Client --> Migration[Apply local migration]
  Migration --> API[Start API]
  Node --> Demo[Open index.html or workspace.html]
  Node --> Web[Start optional Next.js workspace]
```

### Browser Demo

The no-build demo needs no install:

```bash
open index.html
open workspace.html
```

On Windows, open the files from Explorer instead of using `open`.

### Next.js Workspace

```bash
cd apps/web
npm ci
cp .env.example .env.local
npm run dev
```

### API

```bash
cd apps/api
npm ci
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run dev
```

The API requires PostgreSQL and Redis. MongoDB is optional and should only be enabled when its encrypted-document use case is understood:

```bash
cd apps/api
npm run seed:mongoose
```

Run background workers separately when `RUN_WORKERS=false`:

```bash
npm run dev:worker
```

Never commit `.env`, provider secrets, passwords, payment credentials, private keys, or real customer data.

## Configuration

```mermaid
flowchart LR
  Env[Environment] --> Core[DATABASE_URL and REDIS_URL]
  Env --> Auth[JWT_SECRET issuer audience and auth lookup]
  Env --> Payment[Webhook secret and timestamp tolerance]
  Env --> Limits[Request and startup limits]
  Env --> Optional[MONGODB_URL and 32-byte encryption key]
```

| Variable group | Required behavior |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by Prisma |
| `REDIS_URL` | Redis connection used by BullMQ and readiness |
| `JWT_SECRET` | At least 32 characters; use a random secret |
| `JWT_ISSUER`, `JWT_AUDIENCE` | Must match the identity issuer and client |
| `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_SECONDS` | Short-lived access token and rotating refresh-session lifetimes |
| `AUTH_REQUIRE_USER_LOOKUP` | Keep `true` outside isolated tests; production rejects `false` |
| `AUTH_COOKIE_SECURE` | Must be `true` in production; refresh tokens are HttpOnly cookies |
| `RATE_LIMIT_STORE` | Use `redis` in production for shared limits |
| `RUN_WORKERS`, `RECONCILIATION_SWEEP_INTERVAL_SECONDS` | Choose embedded or separate workers and sweep interval |
| `IDEMPOTENCY_TTL_SECONDS` | Retention for durable request fingerprints and response replay |
| `PAYMENT_WEBHOOK_SECRET` | Provider HMAC secret |
| `MONGODB_URL` and `MONGODB_ENCRYPTION_KEY` | Both required to enable optional MongoDB |
| `DATABASE_SSL_MODE` | `require` is enforced in production |

## CI And Release

```mermaid
flowchart LR
  Change[Pull request or push] --> Secrets[Scan demo files]
  Secrets --> Verify[Verify demo and accessibility markers]
  Verify --> WebChecks[Install, type-check, build web]
  WebChecks --> ApiChecks[Install, generate Prisma, type-check, test, build API]
  ApiChecks --> Artifact[Build verified static artifact]
  Artifact --> Deploy[Deploy demo to GitHub Pages on main]
```

```mermaid
flowchart TD
  Release[API release] --> Validate[Load and validate environment]
  Validate --> Migrate[Apply Prisma migrations]
  Migrate --> Seed{SEED_ON_START?}
  Seed -->|yes| MongoSeed[Run safe Mongo seed]
  Seed -->|no| Start[Start compiled API]
  MongoSeed --> Start
  Start --> Ready[Poll readiness endpoint]
  Ready --> Serve[Serve traffic]
```

The API release command is `npm run release` from `apps/api`. It stops on failed configuration, migration, seed, startup, or readiness checks.

## Tests And Checks

```mermaid
flowchart LR
  Code[Change] --> DemoCheck[node scripts/verify-demo.mjs]
  Code --> Types[npm run typecheck]
  Code --> Tests[npm test -- --run]
  Code --> Build[npm run build]
  Types --> Review[Review result]
  Tests --> Review
  Build --> Review
  DemoCheck --> Review
```

API checks:

```bash
cd apps/api
npm run typecheck
npm test -- --run
npm run build
npx prisma validate
npx prisma generate
npm run audit:prod
```

Repository and web checks:

```bash
node scripts/verify-demo.mjs
cd apps/web
npm run typecheck
npm run build
```

The API test suite covers 96 passing cases, including JWT claims, database-backed identity matching, RBAC permissions, state transitions, queue identity, webhook contracts, route behavior, and encrypted MongoDB documents.

## Contributing

```mermaid
flowchart LR
  Problem[Describe user problem] --> Branch[Create focused branch]
  Branch --> Change[Make small change]
  Change --> Tests[Run applicable checks]
  Tests --> Docs[Update docs or diagrams]
  Docs --> PR[Open pull request with results]
  PR --> Review[Respond to review]
```

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) for the complete working agreement.

## Troubleshooting

```mermaid
flowchart TD
  Failure[Something fails] --> Install{Dependency install?}
  Install -->|yes| Node[Check Node 20 and run npm ci in the app directory]
  Install -->|no| Ready{API readiness is 503?}
  Ready -->|yes| Dependencies[Check PostgreSQL, Redis, then optional MongoDB]
  Ready -->|no| Prisma{Prisma error?}
  Prisma -->|yes| Database[Check DATABASE_URL and run prisma generate]
  Prisma -->|no| Demo{Demo action missing in API?}
  Demo -->|yes| Local[Expected: demo actions use local browser state]
  Demo -->|no| Logs[Read request id and API logs]
```

## Current Boundaries

```mermaid
flowchart TB
  Ready[Ready now] --> Demo[Explorable fictional demo]
  Ready --> API[Validated API contracts]
  Ready --> Auth[JWT and RBAC enforcement]
  Ready --> Jobs[Webhook and reconciliation workers]
  Next[Next integration] --> Providers[Real payment, carrier, notification adapters]
  Next --> Login[Real login and invitation UI]
  Next --> Observability[Production metrics and alerting]
```

The demo and Next.js workspace do not yet share one live data client. Payment, carrier, notification, and storage providers remain contracts or adapters rather than live production integrations.

## License

Neev is released under the [MIT License](LICENSE). Copyright 2026 Abhishek Kumar Gautam.
