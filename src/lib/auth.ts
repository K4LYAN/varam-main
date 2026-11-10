import "server-only";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS, verifySessionToken } from "./session";

/**
 * ADMIN_PASSWORD_HASH may be a raw bcrypt hash ($2a$/$2b$…) or the same hash
 * base64-encoded (recommended in .env files, where "$" can be expanded).
 */
function passwordHash(): string | null {
  const raw = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (!raw) return null;
  if (raw.startsWith("$2")) return raw;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return decoded.startsWith("$2") ? decoded : null;
  } catch {
    return null;
  }
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_EMAIL && passwordHash() && (process.env.AUTH_SECRET?.length ?? 0) >= 32);
}

/* Simple in-memory rate limiter: 5 failed attempts per IP per 15 minutes.
   On serverless hosting this is per instance — pair with your host's
   firewall / bot protection for stronger guarantees. */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function isRateLimited(): Promise<boolean> {
  const ip = await clientIp();
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

async function recordFailure() {
  const ip = await clientIp();
  const rec = attempts.get(ip);
  if (!rec || Date.now() - rec.first > WINDOW_MS) attempts.set(ip, { count: 1, first: Date.now() });
  else rec.count += 1;
}

export async function verifyCredentials(email: string, password: string): Promise<boolean> {
  const hash = passwordHash();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!hash || !adminEmail) return false;
  // Always run bcrypt to keep timing consistent whether or not the email matches.
  const passwordOk = await bcrypt.compare(password, hash);
  const ok = passwordOk && email.trim().toLowerCase() === adminEmail;
  if (!ok) await recordFailure();
  return ok;
}

export async function startSession(email: string) {
  const token = await createSessionToken(email);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getAdmin(): Promise<{ email: string } | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

/** Use at the top of every admin page and server action (defence in depth). */
export async function requireAdmin(): Promise<{ email: string }> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
