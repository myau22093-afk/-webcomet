import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClass = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
} as const;

export function BrandLogo({
  href = "/",
  className = "",
  size = "md",
}: BrandLogoProps) {
  return (
    <Link
      href={href}
      className={`wc-brand-logo ${sizeClass[size]} ${className}`.trim()}
    >
      <span className="wc-brand-web">Web</span>
      <span className="wc-brand-comet">Comet</span>
    </Link>
  );
}
