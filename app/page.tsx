"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { formatDate, shiftDate, todayDate } from "@/app/lib/date-utils";
import type {
  DashboardSnapshot,
  MealSlot,
  ToolPayload,
  WeeklyTrendPoint,
} from "@/app/lib/dashboard-types";

type RpcRequest = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
};

type RpcResponse = {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { message?: string };
};

type RpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
};

type ToolResultEnvelope = {
  structuredContent?: ToolPayload | null;
  content?: unknown;
  _meta?: unknown;
};

type WidgetState = {
  activeDate: string;
  mealSlot: MealSlot;
  composer: string;
};

type OpenAiBridge = {
  toolOutput?: ToolPayload | ToolResultEnvelope | null;
  widgetState?: WidgetState | null;
  locale?: string;
  callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  setWidgetState?: (state: WidgetState) => Promise<void> | void;
};

type SetGlobalsEvent = CustomEvent<{
  globals?: Partial<OpenAiBridge>;
}>;

function getOpenAiBridge(): OpenAiBridge | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return (window as Window & { openai?: OpenAiBridge }).openai;
}

function extractDashboard(payload: ToolPayload | null | undefined): DashboardSnapshot | null {
  if (!payload || typeof payload !== "object") return null;
  if (payload.kind === "dashboard" && payload.dashboard) return payload.dashboard;
  return null;
}

function unwrapToolPayload(raw: unknown): ToolPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;

  if ("structuredContent" in payload) {
    const sc = payload.structuredContent;
    if (sc && typeof sc === "object") return sc as ToolPayload;
    return null;
  }

  if ("kind" in payload) return payload as ToolPayload;
  return null;
}

function useMcpBridge(onPayload: (payload: ToolPayload) => void) {
  const handlerRef = useRef(onPayload);
  const pendingRef = useRef(
    new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
  );
  const nextIdRef = useRef(1);
  const [ready, setReady] = useState(() =>
    typeof window !== "undefined" && typeof getOpenAiBridge()?.callTool === "function"
  );

  useEffect(() => {
    handlerRef.current = onPayload;
  }, [onPayload]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleMessage = (event: MessageEvent<RpcResponse | RpcNotification>) => {
      if (event.source !== window.parent) {
        return;
      }

      const message = event.data;
      if (!message || message.jsonrpc !== "2.0") {
        return;
      }

      if ("id" in message && typeof message.id === "number") {
        const pending = pendingRef.current.get(message.id);
        if (!pending) {
          return;
        }
        pendingRef.current.delete(message.id);

        if (message.error) {
          pending.reject(new Error(message.error.message ?? "RPC request failed"));
          return;
        }

        pending.resolve(message.result);
        return;
      }

      if (
        "method" in message &&
        message.method === "ui/notifications/tool-result" &&
        "params" in message &&
        message.params
      ) {
        const payload = unwrapToolPayload(message.params as ToolPayload | ToolResultEnvelope);
        if (payload) {
          handlerRef.current(payload);
        }
      }
    };

    const handleSetGlobals = (event: Event) => {
      const customEvent = event as SetGlobalsEvent;
      if (typeof customEvent.detail?.globals?.callTool === "function") {
        setReady(true);
      }
    };

    window.addEventListener("message", handleMessage, { passive: true });
    window.addEventListener("openai:set_globals", handleSetGlobals, { passive: true });

    if (window.parent === window) {
      return () => {
        window.removeEventListener("message", handleMessage);
        window.removeEventListener("openai:set_globals", handleSetGlobals);
      };
    }

    const rpcRequest = (method: string, params?: unknown) =>
      new Promise<unknown>((resolve, reject) => {
        const id = nextIdRef.current++;
        pendingRef.current.set(id, { resolve, reject });
        const message: RpcRequest = { jsonrpc: "2.0", id, method, params };
        window.parent.postMessage(message, "*");
      });

    const rpcNotify = (method: string, params?: unknown) => {
      const message: RpcNotification = { jsonrpc: "2.0", method, params };
      window.parent.postMessage(message, "*");
    };

    void rpcRequest("ui/initialize", {
      appInfo: { name: "chatgpt-calories-ai", version: "0.1.0" },
      appCapabilities: {},
      protocolVersion: "2026-01-26",
    })
      .then(() => {
        rpcNotify("ui/notifications/initialized", {});
        setReady(true);
      })
      .catch(() => {
        setReady(typeof getOpenAiBridge()?.callTool === "function");
      });

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("openai:set_globals", handleSetGlobals);
      pendingRef.current.clear();
    };
  }, []);

  const callTool = useCallback(async (name: string, args: Record<string, unknown>) => {
    if (typeof window === "undefined") {
      return null;
    }

    if (getOpenAiBridge()?.callTool) {
      const result = await getOpenAiBridge()?.callTool?.(name, args);
      const payload = unwrapToolPayload(result as ToolResultEnvelope | ToolPayload);
      if (payload) {
        handlerRef.current(payload);
      }
      return result;
    }

    const id = nextIdRef.current++;
    const response = await new Promise<unknown>((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject });
      const request: RpcRequest = {
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: args },
      };
      window.parent.postMessage(request, "*");
    });

    const payload = unwrapToolPayload(response as ToolResultEnvelope | ToolPayload);
    if (payload) {
      handlerRef.current(payload);
    }
    return response;
  }, []);

  return { ready, callTool };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function CalorieRing({
  remaining,
  consumed,
  target,
}: {
  remaining: number;
  consumed: number;
  target: number;
}) {
  const radius = 86;
  const circumference = 2 * Math.PI * radius;
  const progress = clamp(consumed / Math.max(target, 1), 0, 1.2);
  const over = consumed > target;
  const dashOffset = circumference * (1 - Math.min(progress, 1));

  return (
    <div className="ring-wrap" aria-label="calorie progress">
      <svg viewBox="0 0 200 200" role="presentation">
        <circle className="ring-track" cx="100" cy="100" r={radius} />
        <circle
          className={`ring-fill ${over ? "ring-fill--over" : ""}`}
          cx="100"
          cy="100"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="ring-center">
        <div className="ring-center__value">{Math.round(remaining)}</div>
        <div className="ring-center__label">kcal left</div>
      </div>
    </div>
  );
}

function MacroCard({
  label,
  remaining,
  consumed,
  target,
  color,
}: {
  label: string;
  remaining: number;
  consumed: number;
  target: number;
  color: string;
}) {
  const progress = clamp((consumed / Math.max(target, 1)) * 100, 0, 100);

  return (
    <div className="card macro-card">
      <div className="macro-card__label">{label}</div>
      <div className="macro-card__value">{Math.round(remaining)}</div>
      <div className="macro-card__unit">g left</div>
      <div className="macro-card__bar">
        <div
          className="macro-card__bar-fill"
          style={{ width: `${progress}%`, background: color }}
        />
      </div>
    </div>
  );
}

function CompactTrend({ points }: { points: WeeklyTrendPoint[] }) {
  const maxVal = Math.max(...points.map((p) => p.target), 1);

  return (
    <div className="card trend-card">
      <div className="trend-card__title">7-day calories</div>
      <div className="trend-bars">
        {points.map((point) => {
          const over = point.calories > point.target;
          const height = (point.calories / maxVal) * 100;

          return (
            <div key={point.date} className="trend-col">
              <div
                className={`trend-bar ${over ? "trend-bar--over" : "trend-bar--under"}`}
                style={{ height: `${height}%` }}
              />
              <span className="trend-day">
                {new Date(`${point.date}T12:00:00Z`)
                  .toLocaleDateString("en-US", { weekday: "short" })
                  .slice(0, 2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const initialPayload = unwrapToolPayload(getOpenAiBridge()?.toolOutput);
  const initialDashboard = extractDashboard(initialPayload);

  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(initialDashboard);
  const [activeDate, setActiveDate] = useState(
    getOpenAiBridge()?.widgetState?.activeDate ?? initialDashboard?.date ?? todayDate()
  );
  const [status, setStatus] = useState("Ready");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const didAutoHydrateRef = useRef(false);

  const locale = getOpenAiBridge()?.locale ?? "en-US";

  const applyPayload = useCallback((payload: ToolPayload) => {
    if (payload.kind === "dashboard") {
      setDashboard(payload.dashboard);
      setActiveDate(payload.dashboard.date);
    }
  }, []);

  const bridge = useMcpBridge(applyPayload);

  const hydratedRef = useRef(!!initialDashboard);

  useEffect(() => {
    if (typeof window === "undefined" || hydratedRef.current) {
      return;
    }

    const tryHydrate = () => {
      if (hydratedRef.current) return;

      const payload = unwrapToolPayload(getOpenAiBridge()?.toolOutput);
      if (payload) {
        applyPayload(payload);
        hydratedRef.current = true;
      }

      const ws = getOpenAiBridge()?.widgetState as WidgetState | null;
      if (ws?.activeDate) {
        setActiveDate(ws.activeDate);
      }
    };

    const onSetGlobals = () => tryHydrate();
    window.addEventListener("openai:set_globals", onSetGlobals, { passive: true });
    const timer = window.setInterval(tryHydrate, 300);

    tryHydrate();

    return () => {
      window.removeEventListener("openai:set_globals", onSetGlobals);
      window.clearInterval(timer);
    };
  }, [applyPayload]);

  useEffect(() => {
    void getOpenAiBridge()?.setWidgetState?.({
      activeDate,
      mealSlot: "lunch",
      composer: "",
    });
  }, [activeDate]);

  const runTool = useCallback(
    async (busyToken: string, nextStatus: string, name: string, args: Record<string, unknown>) => {
      setBusyKey(busyToken);
      setStatus(nextStatus);
      try {
        const response = await bridge.callTool(name, args);
        const payload = unwrapToolPayload(response as ToolPayload | ToolResultEnvelope | null);
        if (payload?.kind) {
          applyPayload(payload);
        }
        setStatus("Synced");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Tool call failed");
      } finally {
        setBusyKey((current) => (current === busyToken ? null : current));
      }
    },
    [bridge, applyPayload]
  );

  const hydrateDashboard = useCallback(
    async (force = false) => {
      if (!bridge.ready) {
        setStatus("Bridge connecting");
        return;
      }
      if (!force && didAutoHydrateRef.current) {
        return;
      }

      didAutoHydrateRef.current = true;
      await runTool("hydrate", "Loading dashboard", "open_calorie_dashboard", {
        date: activeDate,
      });
    },
    [activeDate, bridge.ready, runTool]
  );

  useEffect(() => {
    if (dashboard || !bridge.ready) {
      return;
    }
    void hydrateDashboard();
  }, [dashboard, bridge.ready, hydrateDashboard]);

  async function handleDateChange(delta: number) {
    const nextDate = shiftDate(activeDate, delta);
    await runTool("day-swap", `Loading ${nextDate}`, "load_day_snapshot", {
      date: nextDate,
    });
  }

  if (!dashboard) {
    return (
      <main className="shell shell--empty">
        <div className="card empty-card">
          <h1>Calorie Command</h1>
          <p>Open the dashboard from ChatGPT to see your calories.</p>
          <button
            type="button"
            className="cta"
            disabled={busyKey === "hydrate" || !bridge.ready}
            onClick={() => void hydrateDashboard(true)}
          >
            {busyKey === "hydrate" ? "Loading..." : "Load dashboard"}
          </button>
          <p className="empty-card__hint">{bridge.ready ? status : "Connecting..."}</p>
        </div>
      </main>
    );
  }

  const { summary, weeklyTrend } = dashboard;

  return (
    <main className="shell">
      <header className="header">
        <span className="header__date">{formatDate(dashboard.date, locale)}</span>
        <div className="header__nav">
          <button type="button" className="nav-btn" onClick={() => void handleDateChange(-1)}>
            &larr;
          </button>
          <button type="button" className="nav-btn" onClick={() => void handleDateChange(1)}>
            &rarr;
          </button>
        </div>
      </header>

      <section className="card hero-card">
        <CalorieRing
          remaining={summary.remaining.calories}
          consumed={summary.totals.calories}
          target={summary.targets.calories}
        />
        <p className="hero-subtitle">
          {Math.round(summary.totals.calories)} of {summary.targets.calories} kcal consumed
        </p>
      </section>

      <div className="macro-row">
        <MacroCard
          label="Protein"
          remaining={summary.remaining.protein}
          consumed={summary.totals.protein}
          target={summary.targets.protein}
          color="var(--protein)"
        />
        <MacroCard
          label="Carbs"
          remaining={summary.remaining.carbs}
          consumed={summary.totals.carbs}
          target={summary.targets.carbs}
          color="var(--carbs)"
        />
        <MacroCard
          label="Fat"
          remaining={summary.remaining.fat}
          consumed={summary.totals.fat}
          target={summary.targets.fat}
          color="var(--fat)"
        />
      </div>

      <CompactTrend points={weeklyTrend} />

      <div className="card streak-card">
        <div className="streak-card__left">
          <span className="streak-card__days">{summary.streak} day streak</span>
          <span className="streak-card__momentum">{summary.momentumLabel}</span>
        </div>
        <div>
          <div className="streak-card__score">{summary.adherenceScore}</div>
          <div className="streak-card__score-label">adherence</div>
        </div>
      </div>

      {summary.coachNote && <p className="coach-note">{summary.coachNote}</p>}
    </main>
  );
}
