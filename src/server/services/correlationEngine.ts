/**
 * Correlation Engine (shared primitives)
 *
 * Pure, dependency-free statistics shared by the Sleep Analytics service and the
 * cross-domain Insights service. Both surfaces use the SAME approach so the app
 * speaks one statistical language: a factor↔outcome relationship is summarized as
 * a present/absent group split plus a Cohen's d effect size.
 *
 * This is deliberately simple (no p-values, no regression): it answers
 * "on days WITH this factor, was the outcome meaningfully different?" and is
 * always presented to the user as correlation, never causation.
 */

// ─── Shared types ──────────────────────────────────────────────────────────────

export interface FactorSeries {
  /** Stable id (metricKey, habitId, medicationId, …). */
  id: string;
  /** Human-readable label. */
  name: string;
  /** Provenance label for grouping/filtering in the UI. */
  source: string;
  /** dayKey -> numeric signal (0/1 for boolean/toggle, raw value for numeric). */
  byDay: Map<string, number>;
}

export interface OutcomeSeries {
  /** Stable key (wellbeing metricKey, etc.). */
  key: string;
  /** Human-readable label. */
  label: string;
  /** Whether a higher outcome value is "good" (used to derive improves/worsens). */
  higherIsBetter: boolean;
  /** dayKey -> outcome value. */
  byDay: Map<string, number>;
}

export interface CorrelationResult {
  factorId: string;
  factorName: string;
  factorSource: string;
  outcomeKey: string;
  outcomeLabel: string;
  factorPresentMean: number;
  factorAbsentMean: number;
  /** Signed difference (present − absent), in outcome units. */
  meanDifference: number;
  /** Cohen's d effect size (present vs absent). */
  effectSize: number;
  direction: 'improves' | 'worsens';
  nPresent: number;
  nAbsent: number;
  /** Pre-rendered, caveated sentence including both sample sizes. */
  message: string;
}

export interface CorrelateOptions {
  /** Minimum days per group before a correlation is surfaced. Default 5. */
  minPerGroup?: number;
  /** Minimum |Cohen's d| before a correlation is surfaced. Default 0.2. */
  minEffectSize?: number;
  /** Max correlations returned overall. Default 12. */
  maxResults?: number;
  /** Keep only the strongest outcome per factor when true. Default true. */
  bestOutcomePerFactor?: boolean;
}

// ─── Primitives ─────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Cohen's d effect size between two samples. Returns 0 when either group is too
 * small to estimate variance. When neither group has within-group spread, the
 * result saturates to ±4 (a sentinel "maximal" effect) so identical-value groups
 * with different means are still ranked.
 */
export function cohensD(a: number[], b: number[]): number {
  if (a.length < 2 || b.length < 2) return 0;
  const ma = a.reduce((x, y) => x + y, 0) / a.length;
  const mb = b.reduce((x, y) => x + y, 0) / b.length;
  const va = a.reduce((acc, v) => acc + (v - ma) ** 2, 0) / (a.length - 1);
  const vb = b.reduce((acc, v) => acc + (v - mb) ** 2, 0) / (b.length - 1);
  const pooled = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2));
  if (pooled === 0) {
    if (ma === mb) return 0;
    return ma > mb ? 4 : -4;
  }
  return (ma - mb) / pooled;
}

/**
 * Collapse a factor series into present/absent day sets.
 * Boolean-like series (all 0/1) split on 1 vs 0. Numeric series split on the
 * median of their non-zero values (high vs low / absent).
 */
export function splitByFactor(
  series: FactorSeries,
  dayKeys: string[]
): { present: Set<string>; absent: Set<string> } {
  const present = new Set<string>();
  const absent = new Set<string>();
  const values = dayKeys.map((dk) => series.byDay.get(dk) ?? 0);
  const isBinary = values.every((v) => v === 0 || v === 1);
  if (isBinary) {
    for (const dk of dayKeys) {
      ((series.byDay.get(dk) ?? 0) >= 1 ? present : absent).add(dk);
    }
    return { present, absent };
  }
  const nonZero = values.filter((v) => v > 0).sort((a, b) => a - b);
  const median = nonZero.length ? nonZero[Math.floor(nonZero.length / 2)] : 0;
  for (const dk of dayKeys) {
    ((series.byDay.get(dk) ?? 0) >= median && median > 0 ? present : absent).add(dk);
  }
  return { present, absent };
}

// ─── Generic correlation ────────────────────────────────────────────────────────

const DEFAULTS: Required<CorrelateOptions> = {
  minPerGroup: 5,
  minEffectSize: 0.2,
  maxResults: 12,
  bestOutcomePerFactor: true,
};

/**
 * Correlate every factor against every outcome via present/absent group means +
 * Cohen's d. Returns results ranked by |effect size|, filtered by the options'
 * minimum group size and minimum effect.
 */
export function correlateFactorsToOutcomes(
  factors: FactorSeries[],
  outcomes: OutcomeSeries[],
  dayKeys: string[],
  options: CorrelateOptions = {}
): CorrelationResult[] {
  const opts = { ...DEFAULTS, ...options };
  const results: CorrelationResult[] = [];

  for (const f of factors) {
    const { present, absent } = splitByFactor(f, dayKeys);
    for (const outcome of outcomes) {
      const presentVals: number[] = [];
      const absentVals: number[] = [];
      for (const dk of present) {
        const v = outcome.byDay.get(dk);
        if (typeof v === 'number' && Number.isFinite(v)) presentVals.push(v);
      }
      for (const dk of absent) {
        const v = outcome.byDay.get(dk);
        if (typeof v === 'number' && Number.isFinite(v)) absentVals.push(v);
      }
      if (presentVals.length < opts.minPerGroup || absentVals.length < opts.minPerGroup) continue;

      const d = cohensD(presentVals, absentVals);
      if (Math.abs(d) < opts.minEffectSize) continue;

      const mPresent = presentVals.reduce((a, b) => a + b, 0) / presentVals.length;
      const mAbsent = absentVals.reduce((a, b) => a + b, 0) / absentVals.length;
      const diff = mPresent - mAbsent;
      const improves = outcome.higherIsBetter ? diff > 0 : diff < 0;
      const dirWord = diff > 0 ? 'higher' : 'lower';
      const magnitude = Math.abs(round1(diff));

      const message =
        `On days with "${f.name}", your ${outcome.label} is ${magnitude} ${dirWord} ` +
        `(n=${presentVals.length} vs ${absentVals.length}). Correlation, not proof.`;

      results.push({
        factorId: f.id,
        factorName: f.name,
        factorSource: f.source,
        outcomeKey: outcome.key,
        outcomeLabel: outcome.label,
        factorPresentMean: round1(mPresent),
        factorAbsentMean: round1(mAbsent),
        meanDifference: round1(diff),
        effectSize: round1(d),
        direction: improves ? 'improves' : 'worsens',
        nPresent: presentVals.length,
        nAbsent: absentVals.length,
        message,
      });
    }
  }

  let ranked = results;
  if (opts.bestOutcomePerFactor) {
    const bestPerFactor = new Map<string, CorrelationResult>();
    for (const r of results) {
      const prev = bestPerFactor.get(r.factorId);
      if (!prev || Math.abs(r.effectSize) > Math.abs(prev.effectSize)) bestPerFactor.set(r.factorId, r);
    }
    ranked = Array.from(bestPerFactor.values());
  }

  return ranked
    .sort((a, b) => Math.abs(b.effectSize) - Math.abs(a.effectSize))
    .slice(0, opts.maxResults);
}
