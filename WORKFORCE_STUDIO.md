# Workforce planning studio — Phase 2 + forecasting baseline

## Scope

The core engine is in `planner/engine.mjs` and is independent of the UI. The public `/studio/` experience uses synthetic inputs and no user accounts. The engine accepts a department array with headcount, UPH, productive share, absenteeism, attrition, weekly forecasts, overtime limits, and hiring lead time. Transfer edges define eligible department-to-department support, paid-hour caps and receiving efficiency.

### Decision sequence

1. Compute department-level expected base capacity and productive-hour demand.
2. Calculate one recruitment cohort per department using the largest post-lead-time base capacity deficit.
3. Allocate transfer edges in configured order, only from available donor surplus.
4. Cover residual deficits with capped overtime; report uncovered demand.
5. Show week-by-week actions and labor costs.

### Forecast baseline

`forecast(history, weeks, 'trend'|'movingAverage')` implements a linear trend or historical mean baseline. `backtest` uses expanding-window one-step predictions and reports mean absolute error (MAE). **This is not ML.** Do not use it as proof of accuracy on future real-world demand. For future ML, compare learned models against these baselines using time-ordered holdouts and per-department error metrics.

### Known limitations

- Transfer eligibility is department-level, not employee/shift-level. Transfer ordering is greedy and not globally optimized.
- Hiring cohorts are heuristics and assume immediate full productivity after the lead time; attrition is an expected-value approximation.
- Overtime wages use a single loaded hourly rate and premium; no differential rates or labor-law constraints.
- Cross-department demand units cannot be added meaningfully without converting to hours; model reports productive hours.
- Forecast UI extrapolates from synthetic history; real production requires data connectors, validation, confidence intervals and scenario persistence.
- No database, authentication, client upload or multi-tenant isolation is implemented.

## QA

Run `npm test` (Node 18+) and `npm run build`. In the Cloudflare Pages preview, check `/studio/`, department editing, week switching, scenario reset, responsive layout, and all links. Do not deploy to paying customers as a production decision tool before independent model validation.
