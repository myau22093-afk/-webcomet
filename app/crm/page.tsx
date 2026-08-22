"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Eye,
  Loader2,
  LogOut,
  Mail,
  MousePointerClick,
  RefreshCw,
  Search,
  Users,
  Wallet,
} from "lucide-react";

type Stats = {
  todayVisits: number;
  weekUnique: number;
  activeNow: number;
  signupsWeek: number;
  totalUsers: number;
};

type DayStat = { date: string; count: number };
type TopEvent = { name: string; count: number };

type RecentEvent = {
  event_name: string;
  event_label: string | null;
  created_at: string;
  session_id: string;
  user_email: string | null;
  path: string | null;
};

type SessionRow = {
  sessionId: string;
  email: string | null;
  startedAt: string;
  lastSeenAt: string;
  pageViews: number;
  eventsCount: number;
  durationSec: number;
  firstPath: string | null;
  lastPath: string | null;
  ended: boolean;
};

type UserRow = {
  id: string;
  email: string | null;
  tokenBalance: number;
  totalUsed: number;
  tier: string | null;
  lastSeenAt: string | null;
};

type Tab = "overview" | "sessions" | "events" | "users";

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtDur(sec: number) {
  if (sec < 60) return `${sec}с`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}м ${s}с`;
  return `${Math.floor(m / 60)}ч ${m % 60}м`;
}

function eventLabel(name: string): string {
  const map: Record<string, string> = {
    page_view: "Просмотр страницы",
    click: "Клик",
    "click:register": "Клик: Регистрация",
    "click:login": "Клик: Вход",
    "click:create_site": "Клик: Создать сайт",
    "click:pricing": "Клик: Тарифы",
    signup_complete: "Регистрация",
    login: "Вход",
    session_end: "Ушёл с сайта",
    landing_niche: "Выбор ниши",
    landing_details: "Заполнил данные",
    landing_palette: "Выбор палитры",
    landing_tier: "Выбор тарифа",
    landing_photos: "Шаг фото",
    crm_tokens_add: "CRM: выдали токены",
    crm_tokens_remove: "CRM: забрали токены",
  };
  return map[name] ?? name;
}

export default function CrmPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);
  const [tablesOk, setTablesOk] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [visitsByDay, setVisitsByDay] = useState<DayStat[]>([]);
  const [topEvents, setTopEvents] = useState<TopEvent[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userQ, setUserQ] = useState("");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionEvents, setSessionEvents] = useState<RecentEvent[]>([]);

  const [tokenEmail, setTokenEmail] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenReason, setTokenReason] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenMsg, setTokenMsg] = useState("");

  const maxVisit = useMemo(
    () => Math.max(1, ...visitsByDay.map((d) => d.count)),
    [visitsByDay]
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/dashboard");
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const data = await res.json();
      setAuthed(true);
      setTablesOk(data.tablesOk !== false);
      setStats(data.stats);
      setVisitsByDay(data.visitsByDay ?? []);
      setTopEvents(data.topEvents ?? []);
      setRecentEvents(data.recentEvents ?? []);
      setSessions(data.recentSessions ?? []);
    } catch {
      setLoginErr("Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async (q?: string) => {
    const res = await fetch(`/api/crm/users?q=${encodeURIComponent(q ?? "")}`);
    if (!res.ok) return;
    const data = await res.json();
    setUsers(data.users ?? []);
  }, []);

  const loadSessionTimeline = useCallback(async (sessionId: string) => {
    setSelectedSession(sessionId);
    const res = await fetch(
      `/api/crm/events?sessionId=${encodeURIComponent(sessionId)}`
    );
    if (!res.ok) return;
    const data = await res.json();
    setSessionEvents(data.events ?? []);
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (authed && tab === "users") void loadUsers(userQ);
  }, [authed, tab, userQ, loadUsers]);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setLoginErr("");
    try {
      const res = await fetch("/api/crm/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: login, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setLoginErr(data.error ?? "Ошибка входа");
        return;
      }
      setAuthed(true);
      await loadDashboard();
    } catch {
      setLoginErr("Ошибка сети");
    } finally {
      setLoginBusy(false);
    }
  }

  async function onLogout() {
    await fetch("/api/crm/auth/logout", { method: "POST" });
    setAuthed(false);
  }

  async function onAdjustTokens(e: FormEvent) {
    e.preventDefault();
    setTokenBusy(true);
    setTokenMsg("");
    try {
      const res = await fetch("/api/crm/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: tokenEmail,
          tokens: Number(tokenAmount),
          reason: tokenReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTokenMsg(data.error ?? "Ошибка");
        return;
      }
      setTokenMsg(
        `Готово: ${data.email} → ${data.tokenBalance} ток. (${data.delta > 0 ? "+" : ""}${data.delta})`
      );
      setTokenAmount("");
      void loadUsers(userQ);
      void loadDashboard();
    } catch {
      setTokenMsg("Ошибка сети");
    } finally {
      setTokenBusy(false);
    }
  }

  if (authed === null) {
    return (
      <div className="wc-crm-screen">
        <Loader2 className="h-6 w-6 animate-spin text-violet-300" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="wc-crm-screen">
        <form className="wc-crm-login" onSubmit={onLogin}>
          <p className="wc-crm-login-badge">WebComet CRM</p>
          <h1 className="wc-crm-login-title">Вход в панель</h1>
          <input
            className="wc-crm-input"
            placeholder="Логин"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
          />
          <input
            className="wc-crm-input"
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {loginErr ? <p className="wc-crm-error">{loginErr}</p> : null}
          <button type="submit" className="wc-crm-btn" disabled={loginBusy}>
            {loginBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Войти"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="wc-crm">
      <header className="wc-crm-header">
        <div>
          <p className="wc-crm-kicker">WebComet</p>
          <h1 className="wc-crm-title">CRM · Аналитика</h1>
        </div>
        <div className="wc-crm-header-actions">
          <button
            type="button"
            className="wc-crm-ghost"
            onClick={() => void loadDashboard()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </button>
          <button type="button" className="wc-crm-ghost" onClick={() => void onLogout()}>
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        </div>
      </header>

      {!tablesOk ? (
        <div className="wc-crm-banner">
          Таблицы аналитики ещё не созданы. Выполните{" "}
          <code>supabase/migrate-analytics.sql</code> в Supabase SQL Editor.
        </div>
      ) : null}

      <nav className="wc-crm-tabs">
        {(
          [
            ["overview", "Обзор", Eye],
            ["sessions", "Сессии", Activity],
            ["events", "События", MousePointerClick],
            ["users", "Пользователи", Users],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            className={`wc-crm-tab ${tab === id ? "is-active" : ""}`}
            onClick={() => setTab(id)}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && stats ? (
        <div className="wc-crm-grid">
          <div className="wc-crm-stat">
            <span className="wc-crm-stat-label">Сегодня заходов</span>
            <strong className="wc-crm-stat-value">{stats.todayVisits}</strong>
          </div>
          <div className="wc-crm-stat">
            <span className="wc-crm-stat-label">Уникальных за 7 дней</span>
            <strong className="wc-crm-stat-value">{stats.weekUnique}</strong>
          </div>
          <div className="wc-crm-stat is-live">
            <span className="wc-crm-stat-label">Сейчас на сайте</span>
            <strong className="wc-crm-stat-value">{stats.activeNow}</strong>
          </div>
          <div className="wc-crm-stat">
            <span className="wc-crm-stat-label">Регистраций (нед.)</span>
            <strong className="wc-crm-stat-value">{stats.signupsWeek}</strong>
          </div>

          <section className="wc-crm-panel wc-crm-span-2">
            <h2 className="wc-crm-panel-title">Заходы за 7 дней</h2>
            <div className="wc-crm-chart">
              {visitsByDay.map((d) => (
                <div key={d.date} className="wc-crm-bar-wrap">
                  <div
                    className="wc-crm-bar"
                    style={{ height: `${Math.max(8, (d.count / maxVisit) * 100)}%` }}
                    title={`${d.date}: ${d.count}`}
                  />
                  <span className="wc-crm-bar-label">
                    {d.date.slice(5).replace("-", ".")}
                  </span>
                  <span className="wc-crm-bar-count">{d.count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="wc-crm-panel">
            <h2 className="wc-crm-panel-title">Топ действий</h2>
            <ul className="wc-crm-list">
              {topEvents.map((e) => (
                <li key={e.name} className="wc-crm-list-row">
                  <span>{eventLabel(e.name)}</span>
                  <strong>{e.count}</strong>
                </li>
              ))}
              {topEvents.length === 0 ? (
                <li className="wc-crm-muted">Пока нет событий</li>
              ) : null}
            </ul>
          </section>

          <section className="wc-crm-panel wc-crm-span-full">
            <h2 className="wc-crm-panel-title">Лента событий</h2>
            <div className="wc-crm-feed">
              {recentEvents.map((e, i) => (
                <div key={`${e.created_at}-${i}`} className="wc-crm-feed-item">
                  <span className="wc-crm-feed-time">{fmtTime(e.created_at)}</span>
                  <span className="wc-crm-feed-event">{eventLabel(e.event_name)}</span>
                  <span className="wc-crm-feed-meta">
                    {e.user_email ?? e.event_label ?? e.path ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "sessions" ? (
        <div className="wc-crm-split">
          <section className="wc-crm-panel">
            <h2 className="wc-crm-panel-title">Сессии</h2>
            <div className="wc-crm-table-wrap">
              <table className="wc-crm-table">
                <thead>
                  <tr>
                    <th>Когда</th>
                    <th>Email</th>
                    <th>Страниц</th>
                    <th>Событий</th>
                    <th>Время</th>
                    <th>Последняя</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr
                      key={s.sessionId}
                      className={
                        selectedSession === s.sessionId ? "is-selected" : ""
                      }
                      onClick={() => void loadSessionTimeline(s.sessionId)}
                    >
                      <td>{fmtTime(s.startedAt)}</td>
                      <td>{s.email ?? "—"}</td>
                      <td>{s.pageViews}</td>
                      <td>{s.eventsCount}</td>
                      <td>{fmtDur(s.durationSec)}</td>
                      <td className="wc-crm-muted">{s.lastPath ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="wc-crm-panel">
            <h2 className="wc-crm-panel-title">Путь сессии</h2>
            {!selectedSession ? (
              <p className="wc-crm-muted">Выберите сессию слева</p>
            ) : (
              <ol className="wc-crm-timeline">
                {sessionEvents.map((e, i) => (
                  <li key={`${e.created_at}-${i}`}>
                    <span className="wc-crm-feed-time">{fmtTime(e.created_at)}</span>
                    <strong>{eventLabel(e.event_name)}</strong>
                    <span className="wc-crm-muted">
                      {e.event_label ?? e.path ?? ""}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      ) : null}

      {tab === "events" ? (
        <section className="wc-crm-panel">
          <h2 className="wc-crm-panel-title">Все события</h2>
          <div className="wc-crm-feed">
            {recentEvents.map((e, i) => (
              <div key={`ev-${e.created_at}-${i}`} className="wc-crm-feed-item">
                <span className="wc-crm-feed-time">{fmtTime(e.created_at)}</span>
                <span className="wc-crm-feed-event">{eventLabel(e.event_name)}</span>
                <span className="wc-crm-feed-meta">
                  {e.user_email ?? e.event_label ?? e.path ?? e.session_id.slice(0, 12)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "users" ? (
        <div className="wc-crm-split">
          <section className="wc-crm-panel">
            <h2 className="wc-crm-panel-title">Пользователи</h2>
            <div className="wc-crm-search">
              <Search className="h-4 w-4" />
              <input
                placeholder="Поиск по email…"
                value={userQ}
                onChange={(e) => setUserQ(e.target.value)}
              />
            </div>
            <div className="wc-crm-table-wrap">
              <table className="wc-crm-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Баланс</th>
                    <th>Потрачено</th>
                    <th>Был</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => u.email && setTokenEmail(u.email)}
                    >
                      <td>{u.email ?? "—"}</td>
                      <td>{u.tokenBalance}</td>
                      <td>{u.totalUsed}</td>
                      <td className="wc-crm-muted">
                        {u.lastSeenAt ? fmtTime(u.lastSeenAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="wc-crm-panel">
            <h2 className="wc-crm-panel-title">
              <Wallet className="inline h-4 w-4" /> Токены
            </h2>
            <form className="wc-crm-token-form" onSubmit={onAdjustTokens}>
              <label className="wc-crm-field">
                <Mail className="h-4 w-4" />
                <input
                  type="email"
                  placeholder="Email пользователя"
                  value={tokenEmail}
                  onChange={(e) => setTokenEmail(e.target.value)}
                  required
                />
              </label>
              <label className="wc-crm-field">
                <ArrowUpRight className="h-4 w-4 text-emerald-300" />
                <input
                  type="number"
                  placeholder="Кол-во (+ выдать, − забрать)"
                  value={tokenAmount}
                  onChange={(e) => setTokenAmount(e.target.value)}
                  required
                />
              </label>
              <label className="wc-crm-field">
                <ArrowDownRight className="h-4 w-4 text-zinc-400" />
                <input
                  placeholder="Причина (необязательно)"
                  value={tokenReason}
                  onChange={(e) => setTokenReason(e.target.value)}
                />
              </label>
              <button type="submit" className="wc-crm-btn" disabled={tokenBusy}>
                {tokenBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Применить"
                )}
              </button>
              {tokenMsg ? <p className="wc-crm-token-msg">{tokenMsg}</p> : null}
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
