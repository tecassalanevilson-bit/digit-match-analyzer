import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useScanner, SAMPLE_OPTIONS } from "@/hooks/use-scanner";
import { conditionOf, confirmations } from "@/lib/digit-analysis";
import { byDigit, bySymbol, totals } from "@/lib/backtest";
import {
  Card,
  CandidateRow,
  DigitTable,
  Distribution,
  LastDigits,
  Stat,
  WindowConfirm,
  conditionDot,
  conditionTone,
} from "@/components/scanner/panels";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Digit Scanner AI — Análise de Digit Matches e Differs" },
      {
        name: "description",
        content:
          "Scanner estatístico de últimos dígitos com dados reais da Deriv: score 0–100, filtro conservador, confirmação por janelas e backtest de acertos reais.",
      },
      { property: "og:title", content: "Digit Scanner AI — Matches e Differs da Deriv" },
      {
        property: "og:description",
        content:
          "Score estatístico 0–100, sinais filtrados, modo LIVE e taxa de acerto medida por resultados reais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "tap-target rounded-lg border px-3 text-sm font-bold transition-colors",
        active
          ? "border-gold bg-gold text-gold-foreground"
          : "border-border bg-surface-2 text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Index() {
  const s = useScanner();
  const ranking = s.mode === "MATCH" ? s.matchRanking : s.differRanking;
  const top = ranking[0];
  const condition = conditionOf(
    top,
    s.mode,
    s.conservative,
    s.digits.length,
    s.conn === "CONECTADO",
  );

  // Register signals for the real-result backtest (resolved on the next live tick)
  useEffect(() => {
    if (!s.live || !top || condition === "AGUARDAR" || !s.current) return;
    s.registerSignal({
      symbol: s.current.symbol,
      symbolName: s.current.name,
      mode: s.mode,
      digit: top.digit,
      score: top.score,
      window: s.digits.length,
      condition,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.live, s.digits.length, top?.digit, top?.score, condition, s.mode]);

  const agg = useMemo(() => totals(s.signals), [s.signals]);
  const perDigit = useMemo(() => byDigit(s.signals), [s.signals]);
  const perSymbol = useMemo(() => bySymbol(s.signals), [s.signals]);
  const history = useMemo(() => [...s.signals].slice(-20).reverse(), [s.signals]);
  const conf = top ? confirmations(top, s.mode) : 0;

  return (
    <main className="mx-auto max-w-2xl space-y-3 px-3 py-4 pb-16">
      <header className="panel p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">
              DIGIT <span className="text-gold">SCANNER AI</span>
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Análise estatística de últimos dígitos · dados reais da Deriv
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-md px-2 py-1 font-mono text-[11px] font-bold",
              s.conn === "CONECTADO"
                ? "bg-success/15 text-success"
                : s.conn === "CONECTANDO"
                  ? "bg-gold/15 text-gold"
                  : "bg-destructive/15 text-destructive",
            )}
          >
            {s.conn === "PERDIDA"
              ? "🔴 CONEXÃO PERDIDA"
              : s.conn === "CONECTANDO"
                ? "🟡 CONECTANDO"
                : s.live
                  ? "🟢 LIVE"
                  : "🟢 CONECTADO"}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Índice" value={s.current?.name ?? "—"} />
          <Stat label="Último preço" value={s.lastPrice} />
          <Stat
            label="Último dígito"
            value={String(s.digits[s.digits.length - 1] ?? "—")}
            tone="text-gold"
          />
          <Stat label="Ticks analisados" value={String(s.digits.length)} />
          <Stat label="Última atualização" value={s.lastUpdate} />
          <Stat label="Modo" value={s.conservative ? "CONSERVADOR" : "NORMAL"} />
        </div>

        {s.conn === "PERDIDA" ? (
          <p className="mt-3 rounded-md bg-destructive/15 px-3 py-2 text-xs text-destructive">
            Conexão perdida. Reconectando automaticamente… a análise continua quando a conexão voltar.
          </p>
        ) : null}
        {s.error ? (
          <p className="mt-3 rounded-md bg-destructive/15 px-3 py-2 text-xs text-destructive">
            {s.error}
          </p>
        ) : null}
      </header>

      <Card title="Controlos" icon="⚙️">
        <label className="text-[11px] text-muted-foreground uppercase" htmlFor="idx">
          Índice
        </label>
        <select
          id="idx"
          value={s.symbol}
          onChange={(e) => s.setSymbol(e.target.value)}
          className="tap-target mt-1 mb-3 w-full rounded-lg border border-input bg-surface-2 px-3 text-sm font-semibold"
        >
          {s.symbols.length === 0 ? <option value="">A carregar símbolos…</option> : null}
          {s.symbols.map((sym) => (
            <option key={sym.symbol} value={sym.symbol}>
              {sym.name}
            </option>
          ))}
        </select>

        <p className="text-[11px] text-muted-foreground uppercase">Amostra</p>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {SAMPLE_OPTIONS.map((n) => (
            <Toggle key={n} active={s.sample === n} onClick={() => s.setSample(n)}>
              {n}
            </Toggle>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Toggle active={s.mode === "MATCH"} onClick={() => s.setMode("MATCH")}>
            🎯 MATCH
          </Toggle>
          <Toggle active={s.mode === "DIFFER"} onClick={() => s.setMode("DIFFER")}>
            🚫 DIFFER
          </Toggle>
          <Toggle active={s.conservative} onClick={() => s.setConservative(true)}>
            CONSERVADOR
          </Toggle>
          <Toggle active={!s.conservative} onClick={() => s.setConservative(false)}>
            NORMAL
          </Toggle>
        </div>

        <button
          type="button"
          onClick={s.refresh}
          disabled={s.loading}
          className="mt-3 h-14 w-full rounded-xl bg-primary text-base font-extrabold text-primary-foreground disabled:opacity-60"
        >
          {s.loading ? "A ATUALIZAR…" : "🔄 ATUALIZAR AGORA"}
        </button>
        <button
          type="button"
          onClick={() => s.setLive(!s.live)}
          className={cn(
            "mt-2 h-12 w-full rounded-xl text-sm font-extrabold",
            s.live ? "bg-destructive text-destructive-foreground" : "bg-success text-success-foreground",
          )}
        >
          {s.live ? "⏹ PARAR" : "🟢 LIVE"}
        </button>
        <p
          className={cn(
            "mt-2 rounded-md px-3 py-2 text-center font-mono text-[11px] font-bold",
            !s.live
              ? "bg-destructive/15 text-destructive"
              : s.tickStale
                ? "bg-gold/15 text-gold"
                : "bg-success/15 text-success",
          )}
        >
          {!s.live
            ? "🔴 LIVE PARADO"
            : s.tickStale
              ? "⚠️ SEM TICKS RECENTES"
              : "🟢 LIVE ATIVO · NORMAL"}
          {" · último tick: "}
          {s.diag.lastTickTime}
          {s.live ? ` · fonte: ${s.liveSource}` : ""}
        </p>
      </Card>

      <Card title="Diagnóstico LIVE" icon="🧪">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Símbolo" value={s.diag.symbol} />
          <Stat label="Pip size" value={String(s.pipSize)} />
          <Stat label="Último preço recebido" value={s.diag.lastQuote} />
          <Stat label="Último dígito calculado" value={s.diag.lastDigit} tone="text-gold" />
          <Stat label="Último epoch" value={s.diag.lastEpoch} />
          <Stat label="Ticks recebidos (LIVE)" value={String(s.diag.received)} />
          <Stat label="Último tick recebido" value={s.diag.lastTickTime} />
          <Stat label="Precisão (casas)" value={String(s.pipSize)} />
        </div>
      </Card>

      <Card title="Últimos 20 dígitos" icon="🔢">
        <LastDigits digits={s.digits} />
      </Card>

      <Card title={`${s.mode === "MATCH" ? "🎯 MATCH" : "🚫 DIFFER"}`}>
        {!top ? (
          <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-gold font-mono text-3xl font-extrabold text-gold-foreground">
                {top.digit}
              </span>
              <div>
                <p className="font-mono text-lg font-bold">{top.score}/100</p>
                <p className={cn("text-sm font-bold", conditionTone(condition))}>
                  {conditionDot(condition)}{" "}
                  {condition === "AGUARDAR" ? "AGUARDAR" : `CONDIÇÃO ${condition}`}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat label="Frequência" value={`${top.pctTotal.toFixed(1)}%`} />
              <Stat label="Última ocorrência" value={`${top.gap} ticks atrás`} />
              <Stat label="Sequência atual" value={String(top.currentStreak)} />
              <Stat label="Janelas a confirmar" value={`${conf}/3`} />
            </div>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {top.reasons.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
            {condition !== "AGUARDAR" ? (
              <div className="mt-3 rounded-lg border border-gold/50 bg-gold/10 p-3 text-xs">
                <p className="font-bold text-gold">🔔 CONDIÇÃO {condition} DETECTADA</p>
                <p className="mt-1 font-mono">
                  {s.current?.name} · {s.mode} · dígito {top.digit} · {top.score}/100
                </p>
                <p className="mt-1 text-muted-foreground">
                  Score estatístico, não garantia de acerto. Nenhuma operação é executada
                  automaticamente.
                </p>
              </div>
            ) : (
              <p className="mt-3 rounded-lg bg-surface-2/60 p-3 text-xs text-muted-foreground">
                Sem condição suficientemente forte agora — o scanner prefere AGUARDAR a produzir um
                sinal fraco.
              </p>
            )}
          </>
        )}
      </Card>

      <Card title="Match Analyzer" icon="🎯">
        <div className="space-y-2">
          {s.matchRanking.slice(0, 3).map((c, i) => (
            <CandidateRow key={c.digit} medal={["🥇", "🥈", "🥉"][i] ?? ""} c={c} />
          ))}
        </div>
        {top ? (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            Score do topo: freq {top.breakdown.frequency}/25 · recente {top.breakdown.recent}/20 ·
            janelas {top.breakdown.windows}/15 · desvio {top.breakdown.deviation}/15 · consist.{" "}
            {top.breakdown.consistency}/10 · seq {top.breakdown.streak}/10 · dados{" "}
            {top.breakdown.data}/5
          </p>
        ) : null}
        <p className="mt-2 text-[11px] text-muted-foreground">
          O score é uma medida interna de qualidade da condição estatística — não representa
          probabilidade de acerto.
        </p>
      </Card>

      <Card title="Differ — menor suporte" icon="🚫">
        <div className="space-y-2">
          {s.differRanking.slice(0, 3).map((c, i) => (
            <CandidateRow key={c.digit} medal={["🥇", "🥈", "🥉"][i] ?? ""} c={c} />
          ))}
        </div>
      </Card>

      <Card title="Distribuição dos dígitos" icon="📊">
        <Distribution stats={s.stats} />
        <p className="mt-2 text-[11px] text-muted-foreground">
          🟢 acima da média · 🔴 abaixo da média · ⚪ próximo de 10%. Estar acima de 10% não é, por si
          só, um sinal de MATCH.
        </p>
      </Card>

      <Card title="Análise por dígito" icon="🔎">
        <DigitTable stats={s.stats} />
      </Card>

      <Card title="Confirmação de janelas" icon="📊">
        <WindowConfirm stats={s.stats} />
      </Card>

      <Card title="Backtest dos sinais" icon="📈">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Total de sinais" value={String(agg.total)} />
          <Stat label="Pendentes" value={String(agg.pending)} />
          <Stat label="Acertos" value={String(agg.hits)} tone="text-success" />
          <Stat label="Erros" value={String(agg.misses)} tone="text-destructive" />
        </div>
        <p className="mt-2 font-mono text-lg font-bold">
          Taxa de acerto: {agg.total ? `${agg.rate.toFixed(1)}%` : "—"}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Calculada apenas com resultados reais verificados no tick seguinte ao sinal.
        </p>
        <button
          type="button"
          onClick={s.clearSignals}
          className="tap-target mt-3 w-full rounded-lg border border-border bg-surface-2 text-sm font-bold"
        >
          Limpar histórico
        </button>
      </Card>

      <Card title="Taxa por dígito" icon="🏅">
        {perDigit.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem sinais concluídos.</p>
        ) : (
          <table className="w-full font-mono text-[11px]">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1">Dígito</th>
                <th className="py-1">Sinais</th>
                <th className="py-1">Acertos</th>
                <th className="py-1">Erros</th>
                <th className="py-1">Taxa</th>
              </tr>
            </thead>
            <tbody>
              {perDigit.map((r) => (
                <tr key={r.key} className="border-t border-border/60">
                  <td className="py-1 font-bold text-gold">{r.label}</td>
                  <td className="py-1">{r.total}</td>
                  <td className="py-1 text-success">{r.hits}</td>
                  <td className="py-1 text-destructive">{r.misses}</td>
                  <td className="py-1">{r.rate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Taxa por índice" icon="🌐">
        {perSymbol.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem sinais concluídos.</p>
        ) : (
          <table className="w-full font-mono text-[11px]">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1">Índice</th>
                <th className="py-1">Sinais</th>
                <th className="py-1">Acertos</th>
                <th className="py-1">Erros</th>
                <th className="py-1">Taxa</th>
              </tr>
            </thead>
            <tbody>
              {perSymbol.map((r) => (
                <tr key={r.key} className="border-t border-border/60">
                  <td className="py-1 text-gold">{r.label}</td>
                  <td className="py-1">{r.total}</td>
                  <td className="py-1 text-success">{r.hits}</td>
                  <td className="py-1 text-destructive">{r.misses}</td>
                  <td className="py-1">{r.rate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Histórico dos sinais" icon="🗂️">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda sem sinais registados.</p>
        ) : (
          <ul className="space-y-1 font-mono text-[11px]">
            {history.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 border-b border-border/50 pb-1"
              >
                <span className="text-muted-foreground">
                  {new Date(r.time).toLocaleTimeString("pt-PT", { hour12: false })}
                </span>
                <span className="truncate">{r.symbolName}</span>
                <span className="text-gold">
                  {r.mode === "MATCH" ? "🎯" : "🚫"} {r.digit}
                </span>
                <span>{r.score}</span>
                <span
                  className={
                    r.result === "ACERTO"
                      ? "text-success"
                      : r.result === "ERRO"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }
                >
                  {r.result === "ACERTO" ? "✅" : r.result === "ERRO" ? "❌" : "⏳"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <footer className="px-1 pb-4 text-[11px] leading-relaxed text-muted-foreground">
        Ferramenta apenas de análise estatística. Não pede token, senha ou dados bancários da Deriv e
        não executa operações. Nenhuma precisão ou lucro é prometido; a taxa de acerto mostrada vem
        exclusivamente dos resultados reais registados pelo sistema.
      </footer>
    </main>
  );
}
