import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DerivClient,
  normalizeSymbols,
  pickSynthetics,
  probeSynthetics,
  type ConnState,
  type DerivSymbol,
} from "@/lib/deriv-api";
import { getLastDigit, computeDigitStats, scoreMatch, scoreDiffer } from "@/lib/digit-analysis";
import { loadSignals, saveSignals, type SignalRecord } from "@/lib/backtest";

export const SAMPLE_OPTIONS = [50, 100, 300, 500, 1000, 2000];

export interface LiveDiagnostics {
  symbol: string;
  pipSize: number;
  lastQuote: string;
  lastDigit: string;
  lastEpoch: string;
  received: number;
  lastTickTime: string;
}

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString("pt-PT", { hour12: false });

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
  const [pipSize, setPipSize] = useState(2);
  const [diag, setDiag] = useState<LiveDiagnostics>({
    symbol: "—",
    pipSize: 2,
    lastQuote: "—",
    lastDigit: "—",
    lastEpoch: "—",
    received: 0,
    lastTickTime: "—",
  });
  const [tickStale, setTickStale] = useState(false);
  const [liveSource, setLiveSource] = useState<"SUBSCRICAO" | "SONDAGEM">("SUBSCRICAO");
  const fallbackRef = useRef(false);

  const clientRef = useRef<DerivClient | null>(null);
  const pipRef = useRef(2);
  const symbolRef = useRef("");
  const subRef = useRef<string | null>(null);
  const subIdRef = useRef<string | null>(null);
  const digitsRef = useRef<number[]>([]);
  const lastEpochRef = useRef<number | null>(null);
  const tickCountRef = useRef(0);
  const lastTickMsRef = useRef(0);
  const pendingRef = useRef<SignalRecord | null>(null);
  const cooldownRef = useRef(0);
  const sampleRef = useRef(sample);
  const liveRef = useRef(live);

  useEffect(() => {
    sampleRef.current = sample;
  }, [sample]);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);

  const stamp = () => setLastUpdate(fmtTime(Date.now()));

  const current = useMemo(() => symbols.find((s) => s.symbol === symbol), [symbols, symbol]);

  useEffect(() => {
    setSignals(loadSignals());
  }, []);

  const pushDigit = useCallback((d: number, size: number) => {
    const next = [...digitsRef.current, d];
    if (next.length > size) next.splice(0, next.length - size);
    digitsRef.current = next;
    setDigits(next);
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
  }, []);

  /** Única porta de entrada de ticks (LIVE por subscrição ou sondagem). */
  const ingestTick = useCallback(
    (quote: number, epoch?: number, tickSymbol?: string, tickPip?: number) => {
      // Uma única fonte de dados: ignorar o que não é do símbolo selecionado
      if (tickSymbol && symbolRef.current && tickSymbol !== symbolRef.current) return;
      if (typeof tickPip === "number" && tickPip !== pipRef.current) {
        pipRef.current = tickPip;
        setPipSize(tickPip);
      }
      // Nunca adicionar o mesmo tick duas vezes
      if (typeof epoch === "number" && lastEpochRef.current === epoch) return;
      if (typeof epoch === "number") lastEpochRef.current = epoch;

      const pip = pipRef.current;
      const formatted = quote.toFixed(pip);
      const d = getLastDigit(quote, pip);
      setLastPrice(formatted);
      pushDigit(d, sampleRef.current);
      tickCountRef.current += 1;
      lastTickMsRef.current = Date.now();
      setTickStale(false);
      setDiag({
        symbol: tickSymbol ?? symbolRef.current,
        pipSize: pip,
        lastQuote: formatted,
        lastDigit: String(d),
        lastEpoch: epoch != null ? String(epoch) : "—",
        received: tickCountRef.current,
        lastTickTime: fmtTime(lastTickMsRef.current),
      });
      stamp();
    },
    [pushDigit],
  );

  const loadHistory = useCallback(async (sym: string, size: number) => {
    const client = clientRef.current;
    if (!client || !client.ready || !sym) return;
    setLoading(true);
    setError(null);
    try {
      const res = await client.request<{
        history?: { prices: number[]; times: number[] };
        pip_size?: number;
        echo_req?: { ticks_history?: string };
      }>({
        ticks_history: sym,
        adjust_start_time: 1,
        count: size,
        end: "latest",
        style: "ticks",
      });
      // Ignore late answers for a symbol the user already left
      if (symbolRef.current !== sym) return;
      // Authoritative precision for this symbol comes from the API response
      const pip = typeof res.pip_size === "number" ? res.pip_size : pipRef.current;
      pipRef.current = pip;
      setPipSize(pip);
      const prices = res.history?.prices ?? [];
      const times = res.history?.times ?? [];
      const list = prices.map((p) => getLastDigit(p, pip));
      digitsRef.current = list;
      setDigits(list);
      const lastTime = times.length ? times[times.length - 1] : undefined;
      lastEpochRef.current = typeof lastTime === "number" ? lastTime : null;
      const lastQuote = prices[prices.length - 1];
      if (typeof lastQuote === "number") setLastPrice(lastQuote.toFixed(pip));
      stamp();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao obter histórico");
    } finally {
      setLoading(false);
    }
  }, []);

  // Connection + symbols + single tick handler
  useEffect(() => {
    const client = new DerivClient((s) => setConn(s));
    clientRef.current = client;

    const off = client.onMessage((msg) => {
      const m = msg as {
        msg_type?: string;
        error?: { code?: string };
        echo_req?: { ticks?: string };
        tick?: { quote: number; symbol?: string; epoch?: number; id?: string; pip_size?: number };
      };
      // Subscription rejected (some regions/app contexts) → keep LIVE alive by polling
      if (m.msg_type === "tick" && m.error && m.echo_req?.ticks) {
        fallbackRef.current = true;
        setLiveSource("SONDAGEM");
        return;
      }
      if (m.msg_type !== "tick" || !m.tick) return;
      const tick = m.tick;
      if (tick.id) subIdRef.current = tick.id;
      ingestTick(tick.quote, tick.epoch, tick.symbol, tick.pip_size);
    });

    const bootstrap = async () => {
      try {
        const res = await client.request<{ active_symbols?: unknown[] }>({
          active_symbols: "brief",
          product_type: "basic",
        });
        const all = normalizeSymbols((res.active_symbols ?? []) as never[]);
        let synth = pickSynthetics(all);
        if (synth.length === 0) synth = await probeSynthetics(client);
        setSymbols(synth);
        setSymbol((prev) => prev || (synth[0]?.symbol ?? ""));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao obter símbolos");
      }
    };

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
      client.close();
      clientRef.current = null;
    };
  }, [ingestTick]);

  // Symbol change: drop old data + subscription before anything else
  useEffect(() => {
    symbolRef.current = symbol;
    const client = clientRef.current;
    if (subRef.current && subRef.current !== symbol) {
      if (subIdRef.current) client?.send({ forget: subIdRef.current });
      else client?.send({ forget_all: "ticks" });
      subRef.current = null;
      subIdRef.current = null;
    }
    digitsRef.current = [];
    setDigits([]);
    lastEpochRef.current = null;
    tickCountRef.current = 0;
    setLastPrice("—");
    const sym = symbols.find((s) => s.symbol === symbol);
    if (sym) {
      pipRef.current = sym.pipSize;
      setPipSize(sym.pipSize);
    }
  }, [symbol, symbols]);

  // Reload history when symbol / sample changes (and after reconnection)
  useEffect(() => {
    if (!symbol || conn !== "CONECTADO") return;
    void loadHistory(symbol, sample);
  }, [symbol, sample, conn, loadHistory]);

  // Live subscription (kept in sync with the selected symbol)
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;
    const shouldSub = live && !!symbol && conn === "CONECTADO";
    if (subRef.current && (!shouldSub || subRef.current !== symbol)) {
      if (subIdRef.current) client.send({ forget: subIdRef.current });
      else client.send({ forget_all: "ticks" });
      subRef.current = null;
      subIdRef.current = null;
    }
    if (shouldSub && subRef.current !== symbol) {
      client.send({ ticks: symbol, subscribe: 1 });
      subRef.current = symbol;
      lastTickMsRef.current = Date.now();
      setTickStale(false);
    }
  }, [live, symbol, conn]);

  // LIVE por sondagem: usado quando a subscrição de ticks é rejeitada
  useEffect(() => {
    if (!live || !symbol || conn !== "CONECTADO") return;
    let cancelled = false;
    const tick = async () => {
      const client = clientRef.current;
      if (cancelled || !fallbackRef.current || !client?.ready) return;
      try {
        const res = await client.request<{
          history?: { prices: number[]; times: number[] };
          pip_size?: number;
        }>({ ticks_history: symbol, count: 1, end: "latest", style: "ticks" }, 8000);
        if (cancelled || symbolRef.current !== symbol) return;
        const price = res.history?.prices?.[0];
        const epoch = res.history?.times?.[0];
        if (typeof price === "number") ingestTick(price, epoch, symbol, res.pip_size);
      } catch {
        /* mantém a sondagem; a próxima iteração tenta novamente */
      }
    };
    const t = setInterval(() => void tick(), 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [live, symbol, conn, ingestTick]);

  // Stale-tick watchdog
  useEffect(() => {
    if (!live) {
      setTickStale(false);
      return;
    }
    const t = setInterval(() => {
      setTickStale(Date.now() - lastTickMsRef.current > 5000);
    }, 1000);
    return () => clearInterval(t);
  }, [live]);

  const stats = useMemo(() => computeDigitStats(digits), [digits]);
  const matchRanking = useMemo(
    () => stats.map((s) => scoreMatch(s, digits.length)).sort((a, b) => b.score - a.score),
    [stats, digits.length],
  );
  const differRanking = useMemo(
    () => stats.map((s) => scoreDiffer(s, digits.length)).sort((a, b) => b.score - a.score),
    [stats, digits.length],
  );

  const registerSignal = useCallback((rec: Omit<SignalRecord, "id" | "time" | "result">) => {
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
  }, []);

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
    pipSize,
    diag,
    tickStale,
    liveSource,
  };
}
