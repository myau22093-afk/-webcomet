"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { History, LogIn, LogOut } from "lucide-react";
import {
  IconGear,
  IconHost,
  IconTariffs,
  IconWizard,
} from "@/components/icons/WcIcons";

export type StudioRailItemId = "studio" | "settings" | "hosting" | "pricing";

type Props = {
  visible: boolean;
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
  loggedIn: boolean;
  userEmail?: string | null;
  activeId?: StudioRailItemId;
  onSelectStudio?: () => void;
  onSelectSettings?: () => void;
  onAuthClick?: () => void;
  onSignOut?: () => void;
  expandedExtra?: ReactNode;
  className?: string;
};

function MenuBarsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M5 7.5h14M5 12h14M5 16.5h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StudioIconRail({
  visible,
  expanded,
  onExpandedChange,
  loggedIn,
  userEmail,
  activeId = "studio",
  onSelectStudio,
  onSelectSettings,
  onAuthClick,
  onSignOut,
  expandedExtra,
  className = "",
}: Props) {
  if (!visible) return null;

  return (
    <aside
      className={`wc-studio-rail ${expanded ? "is-expanded" : "is-collapsed"} ${className}`.trim()}
      aria-label="Меню студии"
    >
      <div className="wc-studio-rail-inner">
        <div className="wc-studio-rail-top">
          <Link href="/" className="wc-studio-rail-brand" aria-label="WebComet.ru">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="wc-studio-rail-mark"
              src="/wc-mark.png?v=4"
              alt=""
              width={36}
              height={36}
            />
            {expanded ? (
              <span className="wc-studio-rail-wordmark">
                <span className="wc-lovable-mark-name">WebComet</span>
                <span className="wc-lovable-mark-tld">.ru</span>
              </span>
            ) : null}
          </Link>

          <button
            type="button"
            className="wc-studio-rail-menu-btn"
            onClick={() => onExpandedChange(!expanded)}
            aria-label={expanded ? "Свернуть меню" : "Развернуть меню"}
            title={expanded ? "Свернуть" : "Меню"}
          >
            <span className="wc-studio-rail-ico">
              <MenuBarsIcon className="h-5 w-5" />
            </span>
            <span className="wc-studio-rail-label">Меню</span>
          </button>
        </div>

        <div className="wc-studio-rail-divider" aria-hidden />

        <nav className="wc-studio-rail-nav">
          <button
            type="button"
            className={`wc-studio-rail-item ${activeId === "studio" ? "is-active" : ""}`}
            onClick={() => onSelectStudio?.()}
            title="Студия"
          >
            <span className="wc-studio-rail-ico">
              <IconWizard className="h-6 w-6" />
            </span>
            <span className="wc-studio-rail-label">Студия</span>
          </button>

          <button
            type="button"
            className={`wc-studio-rail-item ${activeId === "settings" ? "is-active" : ""}`}
            onClick={() => {
              if (!loggedIn) {
                onAuthClick?.();
                return;
              }
              onSelectSettings?.();
            }}
            title="Настройки"
          >
            <span className="wc-studio-rail-ico">
              <IconGear className="h-6 w-6" />
            </span>
            <span className="wc-studio-rail-label">Настройки</span>
          </button>

          <Link
            href={loggedIn ? "/hosting" : "#"}
            className={`wc-studio-rail-item ${activeId === "hosting" ? "is-active" : ""}`}
            title="Хостинг"
            onClick={(e) => {
              if (!loggedIn) {
                e.preventDefault();
                onAuthClick?.();
              }
            }}
          >
            <span className="wc-studio-rail-ico">
              <IconHost className="h-6 w-6" />
            </span>
            <span className="wc-studio-rail-label">Хостинг</span>
          </Link>

          <Link
            href={loggedIn ? "/pricing" : "#"}
            className={`wc-studio-rail-item ${activeId === "pricing" ? "is-active" : ""}`}
            title="Тарифы"
            onClick={(e) => {
              if (!loggedIn) {
                e.preventDefault();
                onAuthClick?.();
              }
            }}
          >
            <span className="wc-studio-rail-ico">
              <IconTariffs className="h-6 w-6" />
            </span>
            <span className="wc-studio-rail-label">Тарифы</span>
          </Link>
        </nav>

        {expanded && expandedExtra ? (
          <div className="wc-studio-rail-extra">
            <div className="wc-studio-rail-extra-head">
              <History className="h-3.5 w-3.5" />
              <span>История</span>
            </div>
            {expandedExtra}
          </div>
        ) : null}

        <div className="wc-studio-rail-bottom">
          {loggedIn ? (
            <>
              <div className="wc-studio-rail-user" title={userEmail ?? ""}>
                <span className="wc-studio-rail-avatar">
                  {(userEmail?.[0] ?? "U").toUpperCase()}
                </span>
                <span className="wc-studio-rail-label wc-studio-rail-email">
                  {userEmail ?? "Аккаунт"}
                </span>
              </div>
              {onSignOut ? (
                <button
                  type="button"
                  className="wc-studio-rail-item"
                  onClick={onSignOut}
                  title="Выйти"
                >
                  <span className="wc-studio-rail-ico">
                    <LogOut className="h-5 w-5" />
                  </span>
                  <span className="wc-studio-rail-label">Выйти</span>
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className="wc-studio-rail-item wc-studio-rail-cta"
              onClick={onAuthClick}
              title="Войти"
            >
              <span className="wc-studio-rail-ico">
                <LogIn className="h-5 w-5" />
              </span>
              <span className="wc-studio-rail-label">Войти</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
