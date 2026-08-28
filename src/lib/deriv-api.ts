// Minimal Deriv WebSocket client (current API, no auth, market data only).
// Browser-only: only instantiated from effects/handlers.

export const DERIV_WS_URL = "wss://ws.binaryws.com/websockets/v3?app_id=1089";

export interface DerivSymbol {
  symbol: string; // underlying_symbol (current API) with legacy fallback
  name: string;
  type: string;
  pipSize: number;
  market: string;
}

export interface TickPoint {
  epoch: number;
  quote: number;
  digit: number;
}

type Listener = (msg: Record<string, unknown>) => void;

export type ConnState = "CONECTANDO" | "CONECTADO" | "PERDIDA";

export class DerivClient {
  private ws: WebSocket | null = null;
  private reqId = 1;
  private listeners = new Set<Listener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private closedByUser = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private onState: (s: ConnState) => void) {}

  connect() {
    this.closedByUser = false;
    this.onState("CONECTANDO");
    const ws = new WebSocket(DERIV_WS_URL);
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.onState("CONECTADO");
      this.pingTimer = setInterval(() => this.send({ ping: 1 }), 25000);
    };
    ws.onmessage = (ev) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      this.listeners.forEach((l) => l(data));
    };
    ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      if (this.closedByUser) return;
      this.onState("PERDIDA");
      this.scheduleReconnect();
    };
    ws.onerror = () => {
      /* close handler drives reconnection */
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(1000 * 2 ** this.attempts, 15000);
    this.attempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  onMessage(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  get ready() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  send(payload: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  request<T = Record<string, unknown>>(payload: Record<string, unknown>, timeoutMs = 15000) {
    return new Promise<T>((resolve, reject) => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        reject(new Error("Sem conexão"));
        return;
      }
      const id = this.reqId++;
      const timer = setTimeout(() => {
        off();
        reject(new Error("Tempo esgotado"));
      }, timeoutMs);
      const off = this.onMessage((msg) => {
        if ((msg as { req_id?: number }).req_id !== id) return;
        clearTimeout(timer);
        off();
        const err = (msg as { error?: { message?: string } }).error;
        if (err) reject(new Error(err.message ?? "Erro da API"));
        else resolve(msg as T);
      });
      this.send({ ...payload, req_id: id });
    });
  }

  close() {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.listeners.clear();
    this.ws?.close();
    this.ws = null;
  }
}

interface RawSymbol {
  underlying_symbol?: string;
  symbol?: string;
  underlying_symbol_name?: string;
  display_name?: string;
  underlying_symbol_type?: string;
  symbol_type?: string;
  pip_size?: number;
  market?: string;
  market_display_name?: string;
  exchange_is_open?: number;
}

export function normalizeSymbols(list: RawSymbol[]): DerivSymbol[] {
  return list
    .map((s) => ({
      symbol: s.underlying_symbol ?? s.symbol ?? "",
      name: s.underlying_symbol_name ?? s.display_name ?? s.underlying_symbol ?? s.symbol ?? "",
      type: s.underlying_symbol_type ?? s.symbol_type ?? "",
      pipSize: typeof s.pip_size === "number" ? s.pip_size : 2,
      market: s.market ?? "",
    }))
    .filter((s) => s.symbol.length > 0);
}

const volRank = (s: DerivSymbol) => {
  const isVol = /volatility/i.test(s.name);
  return isVol ? 0 : 1;
};

/** Synthetic indices only, volatility indices first. */
export function pickSynthetics(all: DerivSymbol[]): DerivSymbol[] {
  const synth = all.filter(
    (s) => /synthetic/i.test(s.market) || /random|stpRNG|synthetic/i.test(s.type),
  );
  const pool = synth.length ? synth : all;
  return pool.sort((a, b) => volRank(a) - volRank(b) || a.name.localeCompare(b.name, "pt"));
}

/**
 * Fallback discovery: when active_symbols comes back empty (some regions/app
 * contexts return an empty list), probe candidate synthetic codes with
 * ticks_history and keep only the ones the API actually answers for.
 * Nothing is assumed valid — every symbol here is confirmed live by the API.
 */
const FALLBACK_CANDIDATES: Array<{ symbol: string; name: string }> = [
  { symbol: "R_10", name: "Volatility 10 Index" },
  { symbol: "R_25", name: "Volatility 25 Index" },
  { symbol: "R_50", name: "Volatility 50 Index" },
  { symbol: "R_75", name: "Volatility 75 Index" },
  { symbol: "R_100", name: "Volatility 100 Index" },
  { symbol: "1HZ10V", name: "Volatility 10 (1s) Index" },
  { symbol: "1HZ25V", name: "Volatility 25 (1s) Index" },
  { symbol: "1HZ50V", name: "Volatility 50 (1s) Index" },
  { symbol: "1HZ75V", name: "Volatility 75 (1s) Index" },
  { symbol: "1HZ100V", name: "Volatility 100 (1s) Index" },
];

export async function probeSynthetics(client: DerivClient): Promise<DerivSymbol[]> {
  const results = await Promise.all(
    FALLBACK_CANDIDATES.map(async (c) => {
      try {
        const res = await client.request<{ pip_size?: number; history?: unknown }>(
          { ticks_history: c.symbol, count: 1, end: "latest", style: "ticks" },
          10000,
        );
        if (!res.history) return null;
        return {
          symbol: c.symbol,
          name: c.name,
          type: "synthetic_index",
          pipSize: typeof res.pip_size === "number" ? res.pip_size : 2,
          market: "synthetic_index",
        } satisfies DerivSymbol;
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is DerivSymbol => r !== null);
}
