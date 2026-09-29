# Database Decision

## Decision

PostgreSQL is Neev's source of truth for marketplace transactions. Redis is the operational store for queues and short-lived coordination. MongoDB is optional and limited to encrypted document or archive use cases.

```mermaid
flowchart TD
  Requirement[New data requirement] --> Atomic{Must change with an order transaction?}
  Atomic -->|yes| Postgres[PostgreSQL]
  Atomic -->|no| Queue{Is it queue or cache state?}
  Queue -->|yes| Redis[Redis]
  Queue -->|no| Document{Is it a document or archive?}
  Document -->|no| Postgres
  Document -->|yes| Encrypt{Can it be encrypted before storage?}
  Encrypt -->|yes| Mongo[Optional MongoDB]
  Encrypt -->|no| Review[Security review and explicit decision]
```

## Why PostgreSQL Owns Transactions

```mermaid
flowchart LR
  User[User and organization] --> Quote[Quote request and quote]
  Quote --> Order[Order state]
  Order --> Payment[Payment intent]
  Order --> Dispatch[Dispatch proof]
  Order --> Audit[Audit event]
  Quote --> PG[(One PostgreSQL transaction boundary)]
  Order --> PG
  Payment --> PG
  Dispatch --> PG
  Audit --> PG
```

These records need relational constraints, organization-scoped queries, unique idempotency keys, and atomic state transitions. Splitting them across databases would create reconciliation work at the point where correctness matters most.

## Why Redis Owns Jobs

```mermaid
sequenceDiagram
  participant API as Express API
  participant R as Redis and BullMQ
  participant W as Worker
  participant P as PostgreSQL
  API->>R: Enqueue payment or reconciliation job
  API-->>API: Return without provider work
  W->>R: Claim job with retry policy
  W->>P: Apply idempotent transaction
  P-->>W: Commit or fail
  W-->>R: Complete or retry
```

Redis is not the source of truth for payment or order state. A lost or expired queue job can be recreated from the webhook ledger or operational trigger; the durable result is always written to PostgreSQL.

## When MongoDB Is Appropriate

```mermaid
flowchart TB
  Mongo[MongoDB document] --> Envelope[Version, iv, authTag, ciphertext]
  Envelope --> Key[32-byte encryption key]
  Envelope --> Timestamp[Created and updated timestamps]
  Envelope --> Collection[Validated collection name]
```

MongoDB may store a large, encrypted document that does not need to participate in an order transaction. Examples include a provider payload archive or a future document-heavy compliance record. The current helper uses AES-256-GCM and refuses missing or incorrectly sized keys.

MongoDB must not become the owner of:

- users, roles, organizations, or permissions
- inventory availability or price authority
- quote acceptance or order status
- payment verification or reconciliation results
- audit events needed to explain a transaction

## Operational Rules

```mermaid
flowchart LR
  Configure[Set MONGODB_URL] --> Key[Set MONGODB_ENCRYPTION_KEY]
  Key --> Connect[Connect with TLS and bounded timeouts]
  Connect --> Seed[Optional safe seed]
  Seed --> Ready[Readiness reports Mongo separately]
  Ready --> Disable[Remove URL to disable MongoDB]
```

- `MONGODB_URL` and `MONGODB_ENCRYPTION_KEY` must be supplied together.
- The key must decode from base64 to exactly 32 bytes.
- TLS is enabled by default.
- MongoDB failure must not silently replace PostgreSQL data.
- Production migrations remain Prisma migrations against PostgreSQL.
- A future MongoDB collection needs a retention, access, and deletion policy before use.
