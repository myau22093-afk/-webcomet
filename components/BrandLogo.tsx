import Link from "next/link";
import { IconCometMark } from "@/components/icons/WcIcons";

type BrandLogoProps = {
  href?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Только знак кометы */
  markOnly?: boolean;
};

const sizeClass = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
} as const;

const markSize = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-8 w-8",
} as const;

export function BrandLogo({
  href = "/",
  className = "",
  size = "md",
  markOnly = false,
}: BrandLogoProps) {
  const inner = (
    <span className={`wc-brand-logo ${sizeClass[size]} ${className}`.trim()}>
      <IconCometMark className={`wc-brand-mark ${markSize[size]}`} />
      {!markOnly ? (
        <span className="wc-brand-wordmark" aria-label="WebComet">
          <span className="wc-brand-web">Web</span>
          <span className="wc-brand-comet">Comet</span>
        </span>
      ) : null}
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex items-center no-underline">
      {inner}
    </Link>
  );
}
