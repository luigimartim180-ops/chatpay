# FASE M - Manual E2E Validation

Base URL: `https://midas-core.novoronaldo-m.workers.dev`

These tests require a valid `CHATPAY_TOKEN`, an owner domain with product `1788877711909`, and real production data. No mock response is accepted as evidence.

## 1. Abandoned checkout revival

1. `POST /chatpay/charge` with the owner token and a real amount; record `txid`.
2. Wait 10 minutes, then query the recovery queue or owner analytics.
3. Confirm the Recoverer enqueued a message for that `txid`.
4. Open `/pay?tx=<txid>` and confirm the pending transaction can be reopened.

Acceptance: real `txid`, recovery queue entry, and payment page resolves the transaction.

## 2. Coupons

1. `POST /api/coupon-config` with `{ token, max_per_day: 10, discount_max_pct: 20 }`.
2. Use the Playground to send a real price objection.
3. Confirm the generated coupon has `discount_pct <= 20`.
4. Quote/redeem it through the payment flow and confirm reduced cents.

Acceptance: budget persisted, discount capped at 20%, reduced cents calculated server-side.

## 3. Group buying

1. `POST /api/group-deal` with `prod_id: 1788877711909`, `group_size: 2`, `discount_pct: 15`.
2. Simulate two distinct buyers through `/pay?deal=<id>`.
3. Confirm the deal reaches `complete` and both eligible buyers receive the configured benefit.

Acceptance: distinct members, no double join, 15% cap respected.

## 4. Price watch

1. `POST /api/price-watch` with `lead_id: "test"` and `prod_id: 1788877711909`.
2. Reduce the product cents in a controlled test environment.
3. Run the scheduled price-watch worker.
4. Inspect the reply queue for the notification.

Acceptance: one notification for the watch after a real price decrease.

## 5. Supervision

1. `POST /api/supervision` with `min_ticket_cents: 5000`, `active: true`.
2. Send a Playground lead with ticket R$100.
3. Read `GET /api/approvals?token=...`.
4. Approve with `POST /api/approvals/{id}` and confirm the reply queue contains the edited response.

Acceptance: approval item is created, authenticated approval succeeds, reply is queued.

## 6. Invalid-token coupon

Repeat test 2 using `token: "abc"` and no token. Every request must return HTTP 401 and must not mutate coupon configuration.

## 7. Invalid-token group deal

Repeat test 3 using `token: "abc"` and no token. Every request must return HTTP 401 and must not create a deal.

## 8. Invalid-token price watch

Repeat test 4 using `token: "abc"` and no token. Every request must return HTTP 401 and must not create a watch.

## 9. Invalid-token supervision and approvals

Repeat test 5 using `token: "abc"` and no token. Configuration, approval listing, and approval mutation must all return HTTP 401.

## Execution record

- Automated contract/security audit: production passed 31/31 on 2026-09-10.
- Tests 1-5: require live product data and a 10-minute wait for test 1; not claimed as executed by repository automation.
- Tests 6-9: covered by `scripts/security-audit.ps1` matrix checks; no secrets are recorded here.
