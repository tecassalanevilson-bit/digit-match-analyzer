export interface SignalRecord {
  id: string;
  time: number;
  symbol: string;
  symbolName: string;
  mode: "MATCH" | "DIFFER";
  digit: number;
  score: number;
  window: number;
  condition: "FORTE" | "MODERADA";
  result: "PENDENTE" | "ACERTO" | "ERRO";
  resultDigit?: number;
}

const KEY = "digit-scanner-signals-v1";
const MAX = 500;

export function loadSignals(): SignalRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SignalRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveSignals(list: SignalRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* storage unavailable */
  }
}

export interface Agg {
  key: string;
  label: string;
  total: number;
  hits: number;
  misses: number;
  rate: number;
}

function agg(records: SignalRecord[], keyOf: (r: SignalRecord) => [string, string]): Agg[] {
  const map = new Map<string, Agg>();
  for (const r of records) {
    if (r.result === "PENDENTE") continue;
    const [key, label] = keyOf(r);
    const cur = map.get(key) ?? { key, label, total: 0, hits: 0, misses: 0, rate: 0 };
    cur.total++;
    if (r.result === "ACERTO") cur.hits++;
    else cur.misses++;
    cur.rate = (cur.hits / cur.total) * 100;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export const byDigit = (r: SignalRecord[]) => agg(r, (x) => [String(x.digit), `Dígito ${x.digit}`]);
export const bySymbol = (r: SignalRecord[]) => agg(r, (x) => [x.symbol, x.symbolName]);

export function totals(records: SignalRecord[]) {
  const closed = records.filter((r) => r.result !== "PENDENTE");
  const hits = closed.filter((r) => r.result === "ACERTO").length;
  return {
    total: closed.length,
    pending: records.length - closed.length,
    hits,
    misses: closed.length - hits,
    rate: closed.length ? (hits / closed.length) * 100 : 0,
  };
}
