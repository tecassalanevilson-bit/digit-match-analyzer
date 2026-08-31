// Pure statistical helpers for last-digit analysis. No side effects, no browser APIs.

export type Trend = "SUBINDO" | "ESTAVEL" | "DESCENDO";
export type Condition = "FORTE" | "MODERADA" | "AGUARDAR";

export interface DigitStats {
  digit: number;
  countTotal: number;
  pctTotal: number;
  deviation: number; // pct points vs 10%
  pct20: number;
  pct50: number;
  pct100: number;
  pct300: number;
  pct500: number;
  gap: number; // ticks since last occurrence
  currentStreak: number;
  maxStreak: number;
  recentVsHistoric: number; // pct50 - pctTotal
  stability: number; // 0..1, higher = more stable across blocks
  trend: Trend;
}

export interface Candidate extends DigitStats {
  score: number;
  breakdown: {
    frequency: number;
    recent: number;
    windows: number;
    deviation: number;
    consistency: number;
    streak: number;
    data: number;
  };
  conflict: boolean;
  reasons: string[];
}

export const SCORE_CAP = 79;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Única função de cálculo do último dígito (histórico e LIVE). */
export function getLastDigit(price: string | number, pipSize: number): number {
  const s = typeof price === "number" ? price.toFixed(pipSize) : price;
  const clean = s.replace(/[^0-9]/g, "");
  return clean.length ? Number(clean[clean.length - 1]) : 0;
}

function pctIn(digits: number[], digit: number, n: number): number {
  if (digits.length === 0) return 0;
  const slice = n >= digits.length ? digits : digits.slice(digits.length - n);
  if (slice.length === 0) return 0;
  let c = 0;
  for (const d of slice) if (d === digit) c++;
  return (c / slice.length) * 100;
}

function stabilityOf(digits: number[], digit: number): number {
  // Split window into 4 blocks, compare block frequencies (lower spread = stabler)
  if (digits.length < 40) return 0;
  const block = Math.floor(digits.length / 4);
  const pcts: number[] = [];
  for (let i = 0; i < 4; i++) {
    const slice = digits.slice(i * block, (i + 1) * block);
    let c = 0;
    for (const d of slice) if (d === digit) c++;
    pcts.push((c / slice.length) * 100);
  }
  const mean = pcts.reduce((a, b) => a + b, 0) / 4;
  const variance = pcts.reduce((a, b) => a + (b - mean) ** 2, 0) / 4;
  const sd = Math.sqrt(variance);
  return clamp(1 - sd / 12, 0, 1);
}

function trendOf(short: number, mid: number, long: number): Trend {
  const a = short - mid;
  const b = mid - long;
  if (a > 1 && b >= -0.5) return "SUBINDO";
  if (a < -1 && b <= 0.5) return "DESCENDO";
  return "ESTAVEL";
}

export function computeDigitStats(digits: number[]): DigitStats[] {
  const n = digits.length;
  return Array.from({ length: 10 }, (_, digit) => {
    let countTotal = 0;
    let maxStreak = 0;
    let run = 0;
    let lastIndex = -1;
    for (let i = 0; i < n; i++) {
      if (digits[i] === digit) {
        countTotal++;
        lastIndex = i;
        run++;
        if (run > maxStreak) maxStreak = run;
      } else {
        run = 0;
      }
    }
    let currentStreak = 0;
    for (let i = n - 1; i >= 0 && digits[i] === digit; i--) currentStreak++;

    const pctTotal = n ? (countTotal / n) * 100 : 0;
    const pct20 = pctIn(digits, digit, 20);
    const pct50 = pctIn(digits, digit, 50);
    const pct100 = pctIn(digits, digit, 100);
    const pct300 = pctIn(digits, digit, 300);
    const pct500 = pctIn(digits, digit, 500);

    return {
      digit,
      countTotal,
      pctTotal,
      deviation: pctTotal - 10,
      pct20,
      pct50,
      pct100,
      pct300,
      pct500,
      gap: lastIndex === -1 ? n : n - 1 - lastIndex,
      currentStreak,
      maxStreak,
      recentVsHistoric: pct50 - pctTotal,
      stability: stabilityOf(digits, digit),
      trend: trendOf(pct20, pct50, pctTotal),
    };
  });
}

/** MATCH score 0-100: internal statistical-quality score, NOT a probability. */
export function scoreMatch(s: DigitStats, sampleSize: number): Candidate {
  const frequency = clamp(((s.pctTotal - 8) / 6) * 25, 0, 25);
  const recent = clamp(((s.pct20 - 8) / 12) * 12, 0, 12) + clamp(((s.pct50 - 8) / 8) * 8, 0, 8);
  const windows = clamp(15 - Math.abs(s.pct50 - s.pctTotal) * 2.2, 0, 15);
  const deviation = clamp((s.deviation / 5) * 15, 0, 15);
  const consistency = clamp(s.stability * 10, 0, 10);
  const streakScore =
    clamp(s.maxStreak >= 2 ? 5 : 2, 0, 5) + clamp(s.gap <= 12 ? 5 - s.gap / 4 : 0, 0, 5);
  const data = clamp((sampleSize / 300) * 5, 0, 5);

  const reasons: string[] = [];
  let conflict = false;

  if (s.pctTotal > 10) reasons.push(`Frequência ${s.pctTotal.toFixed(1)}% acima do esperado (10%)`);
  else reasons.push(`Frequência ${s.pctTotal.toFixed(1)}% abaixo do esperado (10%)`);
  if (s.pct20 > s.pct50 && s.pct50 >= s.pctTotal) reasons.push("Janelas curtas confirmam a longa");
  if (Math.abs(s.pct50 - s.pctTotal) > 5) {
    reasons.push("Janela de 50 divergente da janela completa");
    conflict = true;
  }
  if (s.pct20 < 5 && s.pctTotal > 11) {
    reasons.push("Comportamento recente contradiz o histórico");
    conflict = true;
  }
  if (s.stability > 0.6) reasons.push("Frequência estável ao longo da janela");
  if (s.gap <= 10) reasons.push(`Ocorreu há ${s.gap} tick(s)`);
  if (sampleSize < 100) {
    reasons.push("Amostra pequena — confiança reduzida");
    conflict = true;
  }

  let score = frequency + recent + windows + deviation + consistency + streakScore + data;
  if (conflict) score *= 0.75;

  return {
    ...s,
    // Hard cap: an internal statistical score is never presented as 80%+
    // "confidence" without historical validation of real results.
    score: Math.round(clamp(score, 0, SCORE_CAP)),
    breakdown: {
      frequency: Math.round(frequency),
      recent: Math.round(recent),
      windows: Math.round(windows),
      deviation: Math.round(deviation),
      consistency: Math.round(consistency),
      streak: Math.round(streakScore),
      data: Math.round(data),
    },
    conflict,
    reasons,
  };
}

/** DIFFER score: quality of the condition for "digit will NOT appear". */
export function scoreDiffer(s: DigitStats, sampleSize: number): Candidate {
  const frequency = clamp(((10 - s.pctTotal) / 5) * 25, 0, 25);
  const recent = clamp(((10 - s.pct20) / 10) * 12, 0, 12) + clamp(((10 - s.pct50) / 7) * 8, 0, 8);
  const windows = clamp(15 - Math.abs(s.pct50 - s.pctTotal) * 2.2, 0, 15);
  const deviation = clamp((-s.deviation / 4) * 15, 0, 15);
  const consistency = clamp(s.stability * 10, 0, 10);
  const streakScore = clamp(s.currentStreak === 0 ? 6 : 2, 0, 6) + (s.maxStreak <= 2 ? 4 : 1);
  const data = clamp((sampleSize / 300) * 5, 0, 5);

  const reasons: string[] = [];
  let conflict = false;

  reasons.push(`Suporte estatístico baixo: ${s.pctTotal.toFixed(1)}% na janela`);
  if (s.pct20 <= s.pct50 && s.pct50 <= s.pctTotal) reasons.push("Tendência de queda confirmada");
  if (s.pct20 > 15) {
    reasons.push("Aparece com força nos últimos 20 ticks");
    conflict = true;
  }
  if (Math.abs(s.pct50 - s.pctTotal) > 5) {
    reasons.push("Janelas divergentes");
    conflict = true;
  }
  if (sampleSize < 100) {
    reasons.push("Amostra pequena — confiança reduzida");
    conflict = true;
  }

  let score = frequency + recent + windows + deviation + consistency + streakScore + data;
  if (conflict) score *= 0.75;

  return {
    ...s,
    // Hard cap: an internal statistical score is never presented as 80%+
    // "confidence" without historical validation of real results.
    score: Math.round(clamp(score, 0, SCORE_CAP)),
    breakdown: {
      frequency: Math.round(frequency),
      recent: Math.round(recent),
      windows: Math.round(windows),
      deviation: Math.round(deviation),
      consistency: Math.round(consistency),
      streak: Math.round(streakScore),
      data: Math.round(data),
    },
    conflict,
    reasons,
  };
}

export function confirmations(c: Candidate, mode: "MATCH" | "DIFFER"): number {
  const wins = [c.pct20, c.pct50, c.pct100].filter((p) =>
    mode === "MATCH" ? p > 10 : p < 10,
  ).length;
  return wins;
}

/**
 * Rigorous gate. MATCH is never produced just because a digit sits above the
 * 10% average: every criterion below must hold (recent + historic frequency,
 * gap, streak, cross-window stability, minimum sample, frequency trend and
 * multi-window confirmation). Anything short of that is AGUARDAR.
 */
export function conditionOf(
  c: Candidate | undefined,
  mode: "MATCH" | "DIFFER",
  conservative: boolean,
  sampleSize: number,
  connected: boolean,
): Condition {
  if (!c || !connected) return "AGUARDAR";

  const minSample = conservative ? 300 : 100;
  if (sampleSize < minSample) return "AGUARDAR";
  if (c.conflict && conservative) return "AGUARDAR";

  const conf = confirmations(c, mode);

  if (mode === "MATCH") {
    const historic = c.pctTotal >= (conservative ? 11 : 10.5);
    const recent = c.pct50 >= 10.5 && c.pct20 >= 10;
    const gapOk = c.gap <= (conservative ? 15 : 25);
    const streakOk = c.maxStreak >= 2;
    const stable = c.stability >= (conservative ? 0.55 : 0.4);
    const trendOk = c.trend !== "DESCENDO";
    const checks = [historic, recent, gapOk, streakOk, stable, trendOk];
    const passed = checks.filter(Boolean).length;

    if (!historic || !recent) return "AGUARDAR";
    if (conf < (conservative ? 3 : 2)) return "AGUARDAR";
    if (conservative && passed < 6) return "AGUARDAR";
    if (!conservative && passed < 4) return "AGUARDAR";
    if (c.score >= 70 && conf === 3 && passed === 6) return "FORTE";
    return conservative ? "AGUARDAR" : "MODERADA";
  }

  // DIFFER
  const lowHistoric = c.pctTotal <= (conservative ? 9 : 9.5);
  const lowRecent = c.pct50 <= 9.5 && c.pct20 <= 10;
  const noStreak = c.currentStreak === 0;
  const stable = c.stability >= (conservative ? 0.5 : 0.35);
  const trendOk = c.trend !== "SUBINDO";
  const checks = [lowHistoric, lowRecent, noStreak, stable, trendOk];
  const passed = checks.filter(Boolean).length;

  if (!lowHistoric || !lowRecent) return "AGUARDAR";
  if (conf < (conservative ? 3 : 2)) return "AGUARDAR";
  if (conservative && passed < 5) return "AGUARDAR";
  if (!conservative && passed < 3) return "AGUARDAR";
  if (c.score >= 70 && conf === 3 && passed === 5) return "FORTE";
  return conservative ? "AGUARDAR" : "MODERADA";
}

