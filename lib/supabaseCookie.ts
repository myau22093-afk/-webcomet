import type { CookieOptions } from "@supabase/ssr";

/** Chrome/Safari режут cookie старше ~400 дней. */
export const AUTH_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export const AUTH_COOKIE_OPTIONS: CookieOptions = {
  path: "/",
  sameSite: "lax",
  maxAge: AUTH_COOKIE_MAX_AGE,
};

export function withAuthCookieOptions(options?: CookieOptions): CookieOptions {
  return {
    ...AUTH_COOKIE_OPTIONS,
    ...options,
    path: options?.path ?? "/",
    sameSite: options?.sameSite ?? "lax",
    maxAge:
      options?.maxAge === 0
        ? 0
        : (options?.maxAge ?? AUTH_COOKIE_MAX_AGE),
  };
}
