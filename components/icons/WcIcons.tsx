/** Иконки WebComet — единый стиль, читаемый размер */

type IconProps = { className?: string };

/** Мастер в сайдбаре */
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
      <path
        d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M19.4 13.2v-2.4l-1.7-.3a6.8 6.8 0 0 0-.6-1.4l1-1.4-1.7-1.7-1.4 1a6.8 6.8 0 0 0-1.4-.6L12.4 4.6h-2.4l-.3 1.7a6.8 6.8 0 0 0-1.4.6l-1.4-1-1.7 1.7 1 1.4a6.8 6.8 0 0 0-.6 1.4l-1.7.3v2.4l1.7.3c.1.5.3 1 .6 1.4l-1 1.4 1.7 1.7 1.4-1c.4.3.9.5 1.4.6l.3 1.7h2.4l.3-1.7c.5-.1 1-.3 1.4-.6l1.4 1 1.7-1.7-1-1.4c.3-.4.5-.9.6-1.4l1.7-.3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
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
