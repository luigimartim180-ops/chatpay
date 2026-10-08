# API Contract K

All K endpoints require a signed owner JWT. Query endpoints receive `token` in the query string; POST endpoints receive `token` in the JSON body.

| Route | Method | Auth | Expected status | Minimal body/query |
|---|---|---|---|---|
| `/api/coupon-config` | GET | `token` query, valid JWT | 200; 401 without/invalid token | `?token=...` |
| `/api/coupon-config` | POST | `token` JSON, valid JWT | 200; 400 invalid JSON; 401 without/invalid token | `{ "token": "..." }` |
| `/api/group-deal` | GET | `token` query, valid JWT | 200; 401 without/invalid token | `?token=...` |
| `/api/group-deal` | POST | `token` JSON, valid JWT | 200; 400 invalid JSON; 401 without/invalid token | `{ "token": "..." }` |
| `/api/price-watch` | GET | `token` query, valid JWT | 200; 401 without/invalid token | `?token=...` |
| `/api/price-watch` | POST | `token` JSON, valid JWT | 200 or 404 product; 400 invalid JSON; 401 without/invalid token | `{ "token": "...", "prod_id": "..." }` |
| `/api/offer-calc` | POST | `token` JSON, valid JWT | 200; 400 invalid JSON; 401 without/invalid token | `{ "token": "...", "cents": 1000 }` |
| `/api/offer-calc` | GET | `token` query, valid JWT | 200; 401 without/invalid token | `?token=...&cents=1000` |
| `/api/supervision` | GET | `token` query, valid JWT | 200; 401 without/invalid token | `?token=...` |
| `/api/supervision` | POST | `token` JSON, valid JWT | 200; 400 invalid JSON; 401 without/invalid token | `{ "token": "..." }` |
| `/api/approvals` | GET | `token` query, valid JWT | 200; 401 without/invalid token | `?token=...` |
| `/api/approvals/:id` | POST | `token` JSON, valid JWT | 200 or 404 approval; 400 invalid JSON; 401 without/invalid token | `{ "token": "..." }` |

A route/method outside this matrix is expected to return 404. Authentication failures must never become 500 responses.
