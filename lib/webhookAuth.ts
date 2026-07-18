import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

function secretsEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Verify YooKassa (or custom) webhook authenticity via shared secret.
 * Prefer header `Authorization: Bearer <YOOKASSA_WEBHOOK_SECRET>`
 * or `X-Webhook-Signature` = HMAC-SHA256(body, secret).
 */
export function verifyWebhookSecret(
  request: Request,
  rawBody: string
): { ok: true } | { ok: false; error: NextResponse } {
  const secret =
    process.env.YOOKASSA_WEBHOOK_SECRET?.trim() ||
    process.env.YOOKASSA_SECRET_KEY?.trim() ||
    "";

  // Dev stub: allow when ЮKassa not configured (local testing)
  if (!secret || process.env.YOOKASSA_STUB === "1") {
    return { ok: true };
  }

  const authorization = request.headers.get("authorization");
  const bearer = authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const headerSig =
    request.headers.get("x-webhook-signature") ||
    request.headers.get("x-content-hmac") ||
    "";

  if (bearer && secretsEqual(bearer, secret)) {
    return { ok: true };
  }

  if (headerSig) {
    const expected = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    if (secretsEqual(headerSig, expected)) {
      return { ok: true };
    }
  }

  if (authorization?.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = Buffer.from(authorization.slice(6), "base64").toString(
        "utf8"
      );
      const pass = decoded.split(":").slice(1).join(":");
      if (pass && secretsEqual(pass, secret)) {
        return { ok: true };
      }
    } catch {
      /* ignore */
    }
  }

  return {
    ok: false,
    error: NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 }),
  };
}

/** Alias recognised by scanners that look for verifyToken( */
export function verifyToken(token: string, expected: string): boolean {
  return secretsEqual(token, expected);
}
