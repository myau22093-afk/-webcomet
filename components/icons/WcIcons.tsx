/** Минималистичные иконки WebComet — без «игрушечных» lucide-дефолтов */

type IconProps = { className?: string };

export function IconCometMark({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="wcCometCore" x1="8" y1="6" x2="26" y2="24">
          <stop stopColor="#a78bfa" />
          <stop offset="0.45" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#818cf8" />
        </linearGradient>
        <linearGradient id="wcCometTail" x1="2" y1="28" x2="18" y2="12">
          <stop stopColor="#38bdf8" stopOpacity="0" />
          <stop offset="0.35" stopColor="#7dd3fc" stopOpacity="0.55" />
          <stop offset="1" stopColor="#c4b5fd" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <path
        d="M4 28C10 22 14 18 18 12"
        stroke="url(#wcCometTail)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M7 26C11.5 21.5 14.5 18 17 14"
        stroke="url(#wcCometTail)"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="21.5" cy="10.5" r="5.2" fill="url(#wcCometCore)" />
      <circle cx="21.5" cy="10.5" r="2.1" fill="#f8fafc" opacity="0.95" />
    </svg>
  );
}

export function IconWizard({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M5 19L15.5 8.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M14.2 7.2l2.6 2.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M17.5 4.5l.35 1.15L19 6l-1.15.35L17.5 7.5l-.35-1.15L16 6l1.15-.35L17.5 4.5z"
        fill="currentColor"
      />
      <path
        d="M20.2 9.2l.22.72.78.22-.78.22-.22.72-.22-.72-.78-.22.78-.22.22-.72z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

export function IconPro({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="4.5"
        y="5.5"
        width="15"
        height="13"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 12.5h8M8 9.5h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconGear({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 4.5v1.4M12 18.1v1.4M4.5 12h1.4M18.1 12h1.4M6.4 6.4l1 1M16.6 16.6l1 1M17.6 6.4l-1 1M7.4 16.6l-1 1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconHost({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M5 8.5h14v3.2H5V8.5zM5 13.8h14V17H5v-3.2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="10.1" r="0.7" fill="currentColor" />
      <circle cx="8" cy="15.4" r="0.7" fill="currentColor" />
    </svg>
  );
}

export function IconTariffs({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 4.5l1.35 3.9h4.1l-3.3 2.4 1.25 3.9L12 12.5 8.6 14.7l1.25-3.9-3.3-2.4h4.1L12 4.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
