import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** @deprecated знак убран — оставлено для совместимости */
  markOnly?: boolean;
};

const sizeClass = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
} as const;

export function BrandLogo({
  href = "/",
  className = "",
  size = "md",
  markOnly = false,
}: BrandLogoProps) {
  const inner = (
    <span
      className={`wc-brand-logo ${sizeClass[size]} ${className}`.trim()}
      aria-label="WebComet.ru"
    >
      {markOnly ? (
        <span className="wc-brand-wordmark">
          <span className="wc-brand-comet">W</span>
        </span>
      ) : (
        <span className="wc-brand-wordmark">
          <span className="wc-brand-web">Web</span>
          <span className="wc-brand-comet">Comet</span>
          <span className="wc-brand-tld">.ru</span>
        </span>
      )}
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex items-center no-underline">
      {inner}
    </Link>
  );
}
