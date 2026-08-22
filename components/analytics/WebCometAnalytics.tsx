"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

const SID_KEY = "wc-analytics-sid";
const START_KEY = "wc-analytics-start";

function getSessionId(): string {
  try {
    let sid = localStorage.getItem(SID_KEY);
    if (!sid || sid.length < 12) {
      sid = `wc_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem(SID_KEY, sid);
      localStorage.setItem(START_KEY, String(Date.now()));
    }
    return sid;
  } catch {
    return `wc_${Date.now()}_fallback`;
  }
}

function sessionDurationSec(): number {
  try {
    const start = Number(localStorage.getItem(START_KEY) || Date.now());
    return Math.max(0, Math.floor((Date.now() - start) / 1000));
  } catch {
    return 0;
  }
}

function pickUtm(search: URLSearchParams) {
  return {
    utmSource: search.get("utm_source"),
    utmMedium: search.get("utm_medium"),
    utmCampaign: search.get("utm_campaign"),
  };
}

function clickLabel(el: Element): string {
  const attr = el.getAttribute("data-wc-event");
  if (attr) return attr;
  const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (text) return text;
  if (el instanceof HTMLAnchorElement && el.href) {
    try {
      return new URL(el.href).pathname;
    } catch {
      return el.href.slice(0, 80);
    }
  }
  return el.tagName.toLowerCase();
}

function eventNameFromClick(el: Element): string {
  const custom = el.getAttribute("data-wc-event");
  if (custom) return `click:${custom}`;
  const text = (el.textContent || "").toLowerCase();
  if (text.includes("регистр")) return "click:register";
  if (text.includes("войти") || text.includes("вход")) return "click:login";
  if (text.includes("создать сайт") || text.includes("собрать сайт")) {
    return "click:create_site";
  }
  if (el instanceof HTMLAnchorElement) {
    const href = el.getAttribute("href") || "";
    if (href.includes("/register")) return "click:register";
    if (href.includes("/login")) return "click:login";
    if (href.includes("/pricing")) return "click:pricing";
  }
  return "click";
}

async function postJson(url: string, body: Record<string, unknown>) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}

export function WebCometAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userRef = useRef<{ id?: string; email?: string }>({});
  const lastPathRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    void getSupabase()
      .auth.getUser()
      .then(({ data }) => {
        if (cancelled) return;
        if (data.user) {
          userRef.current = {
            id: data.user.id,
            email: data.user.email ?? undefined,
          };
        }
      });
    const { data: sub } = getSupabase().auth.onAuthStateChange((_ev, session) => {
      if (session?.user) {
        userRef.current = {
          id: session.user.id,
          email: session.user.email ?? undefined,
        };
        void postJson("/api/analytics/event", {
          sessionId: getSessionId(),
          eventName: "login",
          eventLabel: session.user.email ?? undefined,
          path: window.location.pathname,
          userId: session.user.id,
          userEmail: session.user.email ?? undefined,
        });
      } else {
        userRef.current = {};
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/crm")) return;
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;

    const sessionId = getSessionId();
    const utm = pickUtm(searchParams);
    void postJson("/api/analytics/visit", {
      sessionId,
      path: pathname,
      referrer: document.referrer || null,
      ...utm,
      userId: userRef.current.id ?? null,
      userEmail: userRef.current.email ?? null,
    });
    void postJson("/api/analytics/event", {
      sessionId,
      eventName: "page_view",
      eventLabel: pathname,
      path: pathname,
      userId: userRef.current.id ?? null,
      userEmail: userRef.current.email ?? null,
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    if (pathname?.startsWith("/crm")) return;

    const sessionId = getSessionId();
    const heartbeat = window.setInterval(() => {
      void postJson("/api/analytics/heartbeat", {
        sessionId,
        path: window.location.pathname,
        durationSec: sessionDurationSec(),
        userId: userRef.current.id ?? null,
        userEmail: userRef.current.email ?? null,
      });
    }, 30_000);

    const onClick = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      const el = target.closest(
        "button, a, [role='button'], input[type='submit'], [data-wc-event]"
      );
      if (!el || el.closest("[data-wc-no-track]")) return;

      void postJson("/api/analytics/event", {
        sessionId: getSessionId(),
        eventName: eventNameFromClick(el),
        eventLabel: clickLabel(el),
        path: window.location.pathname,
        userId: userRef.current.id ?? null,
        userEmail: userRef.current.email ?? null,
        properties: {
          tag: el.tagName.toLowerCase(),
        },
      });
    };

    const onLeave = () => {
      void postJson("/api/analytics/heartbeat", {
        sessionId: getSessionId(),
        path: window.location.pathname,
        durationSec: sessionDurationSec(),
        ended: true,
        userId: userRef.current.id ?? null,
        userEmail: userRef.current.email ?? null,
      });
      void postJson("/api/analytics/event", {
        sessionId: getSessionId(),
        eventName: "session_end",
        eventLabel: `${sessionDurationSec()}s`,
        path: window.location.pathname,
        userId: userRef.current.id ?? null,
        userEmail: userRef.current.email ?? null,
        properties: { durationSec: sessionDurationSec() },
      });
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("pagehide", onLeave);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onLeave();
    });

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [pathname]);

  return null;
}

/** Вызов из кода: кастомное целевое действие */
export function trackEvent(
  name: string,
  label?: string,
  properties?: Record<string, unknown>
) {
  try {
    const sessionId = localStorage.getItem(SID_KEY) || getSessionId();
    void postJson("/api/analytics/event", {
      sessionId,
      eventName: name,
      eventLabel: label,
      path: window.location.pathname,
      properties: properties ?? {},
    });
  } catch {
    /* ignore */
  }
}
