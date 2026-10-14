# Validation: blind replay of the 2026-10-13 O7 history

Run 2026-10-14 by `npm run validate` (tools/validate.ts) on fixtures/sweeps and fixtures/python.

**Gate (spec §14):** the TypeScript prediction matches the recorded Python prediction within ±0.5 Ω in R and in X, for every variant. Result: **PASS** (6 of 6 rows).

## 1. Gate: TypeScript vs the recorded Python predictions

| Variant | Prediction | TypeScript Z (Ω) | Python Z (Ω) | ΔR | ΔX | Gate |
|---|---|---|---|---|---|---|
| 1.245 m + 342 nH | 80/200 predicted from 130/230 + 100/200 | 6.64 + j12.59 | 6.64 + j12.59 | −0.00 | −0.00 | PASS |
| 1.245 m + 342 nH | 80/180 + loop predicted from 3 sweeps + loop shift | 7.24 + j18.00 | 7.24 + j18.00 | −0.00 | −0.00 | PASS |
| 1.2825 m + 329 nH | 80/200 predicted from 130/230 + 100/200 | 6.43 + j12.67 | 6.43 + j12.67 | −0.00 | −0.00 | PASS |
| 1.2825 m + 329 nH | 80/180 + loop predicted from 3 sweeps + loop shift | 6.83 + j16.89 | 6.83 + j16.89 | +0.00 | +0.00 | PASS |
| 1.5094 m + 256 nH | 80/200 predicted from 130/230 + 100/200 | 4.77 + j8.01 | 4.77 + j8.01 | +0.00 | +0.00 | PASS |
| 1.5094 m + 256 nH | 80/180 + loop predicted from 3 sweeps + loop shift | 4.98 + j11.52 | 4.98 + j11.52 | −0.00 | −0.00 | PASS |

## 2. Prediction vs measurement (reported, not gated)

| Variant | Prediction | Predicted Z (Ω) | Measured Z (Ω) | ΔR | ΔX |
|---|---|---|---|---|---|
| 1.245 m + 342 nH | 80/200 predicted from 130/230 + 100/200 | 6.64 + j12.59 | 5.03 + j4.30 | +1.61 | +8.29 |
| 1.245 m + 342 nH | 80/180 + loop predicted from 3 sweeps + loop shift | 7.24 + j18.00 | 7.81 + j27.89 | −0.56 | −9.90 |
| 1.2825 m + 329 nH | 80/200 predicted from 130/230 + 100/200 | 6.43 + j12.67 | 5.03 + j4.30 | +1.39 | +8.37 |
| 1.2825 m + 329 nH | 80/180 + loop predicted from 3 sweeps + loop shift | 6.83 + j16.89 | 7.81 + j27.89 | −0.98 | −11.00 |
| 1.5094 m + 256 nH | 80/200 predicted from 130/230 + 100/200 | 4.77 + j8.01 | 5.03 + j4.30 | −0.26 | +3.71 |
| 1.5094 m + 256 nH | 80/180 + loop predicted from 3 sweeps + loop shift | 4.98 + j11.52 | 7.81 + j27.89 | −2.82 | −16.38 |

## 3. C+D cross-check at 13.5601 MHz (reported, not gated)

T-model fitted to the 2026-09-30 cap-free sweep; series 100 pF, shunt 3 × 100 + 30 pF; no fitted board inductance; 1.5094 m cable; compared with the 2026-10-01 sweep.

| Source | Z (Ω) |
|---|---|
| TypeScript | 6.81 + j6.38 |
| Python | 6.81 + j6.38 |
| Measured | 16.86 + j48.21 |

## 4. Shorted-jumper fit at fixed cable lengths (reported, not gated)

Band 2–25 MHz. The historical band is not recorded, so the recorded values are a comparison, not a target.

| Cable (m) | TypeScript L_j (nH) | Python L_j (nH) | Recorded L_j (nH) |
|---|---|---|---|
| 1.245 | 343.6 | 343.6 | 342 |
| 1.2825 | 328.6 | 328.6 | 329 |
| 1.5094 | 248.0 | 248.0 | 256 |

## What this shows

- Section 1 passing means the TypeScript tool reproduces the Python model on the same data. It does not show the model is right.
- Section 2 is the model's real accuracy on a build it had not seen. Read it before trusting a recommendation.
- Sections 3 and 4 rest on recipes whose historical settings are not fully recorded, so they are comparisons, not gates.
