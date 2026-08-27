import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DerivClient,
  normalizeSymbols,
  pickSynthetics,
  lastDigit as _unused,
  type ConnState,
  type DerivSymbol,
} from "@/lib/deriv-api";
import { lastDigit, computeDigitStats, scoreMatch, scoreDiffer } from "@/lib/digit-analysis";
import { loadSignals, saveSignals, type SignalRecord } from "@/lib/backtest";

void _unused;

export const SAMPLE_OPTIONS = [50, 100, 300, 500, 1000, 2000];

export function useScanner() {
  const [conn, setConn] = useState<ConnState>("CONECTANDO");
  const [symbols, setSymbols] = useState<DerivSymbol[]>([]);
  const [symbol, setSymbol] = useState<string>("");
  const [sample, setSample] = useState(300);
  const [live, setLive] = useState(false);
  const [conservative, setConservative] = useState(true);
  const [mode, setMode] = useState<"MATCH" | "DIFFER">("MATCH");
  const [digits, setDigits] = useState<number[]>([]);
  const [lastPrice, setLastPrice] = useState<string>("—");
  const [lastUpdate, setLastUpdate] = useState<string>("—");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<SignalRecord[]>([]);

  const clientRef = useRef<DerivClient | null>(null);
  const pipRef = useRef(2);
  const subRef = useRef<string | null>(null);
  const digitsRef = useRef<number[]>([]);
  const pendingRef = useRef<SignalRecord | null>(null);
  const cooldownRef = useRef(0);

  const stamp = () =>
    setLastUpdate(
      new Date().toLocaleTimeString("pt-PT", { hour12: false, timeZone: undefined }),
    );

  const current = useMemo(() => symbols.find((s) => s.symbol === symbol), [symbols, symbol]);

  useEffect(() => {
    setSignals(loadSignals());
  }, []);

  const pushDigit = useCallback(
    (d: number, size: number) => {
      const next = [...digitsRef.current, d];
      if (next.length > size) next.splice(0, next.length - size);
      digitsRef.current = next;
      setDigits(next);
      // Resolve pending backtest signal against this brand-new tick
      const pending = pendingRef.current;
      if (pending) {
        pendingRef.current = null;
        const hit = pending.mode === "MATCH" ? d === pending.digit : d !== pending.digit;
        setSignals((prev) => {
          const updated = prev.map((s) =>
            s.id === pending.id
              ? { ...s, result: hit ? ("ACERTO" as const) : ("ERRO" as const), resultDigit: d }
              : s,
          );
          saveSignals(updated);
          return updated;
        });
      }
    },
    [],
  );

  const loadHistory = useCallback(
    async (sym: string, size: number) => {
      const client = clientRef.current;
      if (!client || !client.ready || !sym) return;
      setLoading(true);
      setError(null);
      try {
        const res = await client.request<{
          history?: { prices: number[]; times: number[] };
          pip_size?: number;
        }>({
          ticks_history: sym,
          adjust_start_time: 1,
          count: size,
          end: "latest",
          style: "ticks",
        });
        const prices = res.history?.prices ?? [];
        const pip = pipRef.current;
        const list = prices.map((p) => lastDigit(p, pip));
        digitsRef.current = list;
        setDigits(list);
        if (prices.length) setLastPrice(prices[prices.length - 1].toFixed(pip));
        stamp();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao obter histórico");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Connection + symbols
  useEffect(() => {
    const client = new DerivClient((s) => setConn(s));
    clientRef.current = client;

    const off = client.onMessage((msg) => {
      const tick = (msg as { tick?: { quote: number; symbol?: string } }).tick;
      if (!tick) return;
      const pip = pipRef.current;
      setLastPrice(tick.quote.toFixed(pip));
      pushDigit(lastDigit(tick.quote, pip), sampleRef.current);
      stamp();
    });

    const bootstrap = async () => {
      try {
        const res = await client.request<{ active_symbols?: unknown[] }>({
          active_symbols: "brief",
          product_type: "basic",
        });
        const all = normalizeSymbols((res.active_symbols ?? []) as never[]);
        const synth = pickSynthetics(all);
        setSymbols(synth);
        setSymbol((prev) => prev || (synth[0]?.symbol ?? ""));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao obter símbolos");
      }
    };

    const offState = client.onMessage((msg) => {
      if ((msg as { msg_type?: string }).msg_type) return;
    });

    let started = false;
    const poll = setInterval(() => {
      if (client.ready && !started) {
        started = true;
        void bootstrap();
      }
    }, 200);

    client.connect();
    return () => {
      clearInterval(poll);
      off();
      offState();
      client.close();
      clientRef.current = null;
    };
  }, [pushDigit]);

  const sampleRef = useRef(sample);
  useEffect(() => {
    sampleRef.current = sample;
  }, [sample]);

  // Reload history when symbol / sample changes (and after reconnection)
  useEffect(() => {
    if (!symbol || conn !== "CONECTADO") return;
    const sym = symbols.find((s) => s.symbol === symbol);
    pipRef.current = sym?.pipSize ?? 2;
    void loadHistory(symbol, sample);
  }, [symbol, sample, conn, symbols, loadHistory]);

  // Live subscription
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;
    if (subRef.current && (!live || subRef.current !== symbol || conn !== "CONECTADO")) {
      client.send({ forget_all: "ticks" });
      subRef.current = null;
    }
    if (live && symbol && conn === "CONECTADO") {
      client.send({ ticks: symbol, subscribe: 1 });
      subRef.current = symbol;
    }
  }, [live, symbol, conn]);

  const stats = useMemo(() => computeDigitStats(digits), [digits]);
  const matchRanking = useMemo(
    () => stats.map((s) => scoreMatch(s, digits.length)).sort((a, b) => b.score - a.score),
    [stats, digits.length],
  );
  const differRanking = useMemo(
    () => stats.map((s) => scoreDiffer(s, digits.length)).sort((a, b) => b.score - a.score),
    [stats, digits.length],
  );

  const registerSignal = useCallback(
    (rec: Omit<SignalRecord, "id" | "time" | "result">) => {
      if (pendingRef.current) return;
      const now = Date.now();
      if (now - cooldownRef.current < 4000) return;
      cooldownRef.current = now;
      const record: SignalRecord = {
        ...rec,
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        time: now,
        result: "PENDENTE",
      };
      pendingRef.current = record;
      setSignals((prev) => {
        const updated = [...prev, record];
        saveSignals(updated);
        return updated;
      });
    },
    [],
  );

  const clearSignals = useCallback(() => {
    pendingRef.current = null;
    setSignals([]);
    saveSignals([]);
  }, []);

  const refresh = useCallback(() => {
    if (symbol) void loadHistory(symbol, sample);
  }, [symbol, sample, loadHistory]);

  return {
    conn,
    symbols,
    symbol,
    setSymbol,
    sample,
    setSample,
    live,
    setLive,
    conservative,
    setConservative,
    mode,
    setMode,
    digits,
    stats,
    matchRanking,
    differRanking,
    lastPrice,
    lastUpdate,
    loading,
    error,
    refresh,
    current,
    signals,
    registerSignal,
    clearSignals,
  };
}
