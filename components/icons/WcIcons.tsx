/** Иконки WebComet — единый стиль, читаемый размер */

type IconProps = { className?: string };

/** Мастер: палочка + искры (одинаковая в сайдбаре и в шапке мастера) */
export function IconWizard({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M4.5 19.5L14.2 9.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12.8 8.4l2.8 2.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16.2 4.2l.55 1.7 1.7.55-1.7.55-.55 1.7-.55-1.7-1.7-.55 1.7-.55.55-1.7z"
        fill="currentColor"
      />
      <path
        d="M20.2 8.6l.35 1.05 1.05.35-1.05.35-.35 1.05-.35-1.05-1.05-.35 1.05-.35.35-1.05z"
        fill="currentColor"
        opacity="0.75"
      />
      <path
        d="M19.4 13.2l.28.85.85.28-.85.28-.28.85-.28-.85-.85-.28.85-.28.28-.85z"
        fill="currentColor"
        opacity="0.55"
      />
    </svg>
  );
}

export function IconPro({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M8 12.5h8M8 9.2h5.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconGear({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 3.75v1.7M12 18.55v1.7M3.75 12h1.7M18.55 12h1.7M6.1 6.1l1.2 1.2M16.7 16.7l1.2 1.2M17.9 6.1l-1.2 1.2M7.3 16.7l-1.2 1.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconHost({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4.5 8h15v3.5h-15V8zM4.5 13.8h15V17.3h-15v-3.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="9.75" r="0.85" fill="currentColor" />
      <circle cx="8" cy="15.55" r="0.85" fill="currentColor" />
    </svg>
  );
}

export function IconTariffs({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 3.8l1.55 4.5h4.75l-3.85 2.8 1.45 4.55L12 13.2l-3.9 2.45 1.45-4.55-3.85-2.8h4.75L12 3.8z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
