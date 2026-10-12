import { headers } from "next/headers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "cloudflare:workers";

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export type AppUser = ChatGPTUser & { authMethod: "chatgpt" | "email" };

const SESSION_COOKIE = "study_log_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const userId = requestHeaders.get(USER_ID_HEADER);
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!userId || !email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    userId,
    displayName: fullName ?? email,
    email,
    fullName,
  };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export async function getAppUser(): Promise<AppUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await readEmailSession(token);
    if (session) return { ...session, authMethod: "email" };
  }
  const user = await getChatGPTUser();
  return user ? { ...user, authMethod: "chatgpt" } : null;
}

export async function makeEmailSessionToken(user: Pick<ChatGPTUser, "userId" | "email">) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(JSON.stringify({ ...user, issuedAt, expiresAt: issuedAt + SESSION_SECONDS }));
  return `${payload}.${base64UrlEncode(await sign(payload))}`;
}

export function emailSessionCookieHeader(token: string, maxAge = SESSION_SECONDS) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearEmailSessionCookieHeader() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

async function readEmailSession(token: string): Promise<ChatGPTUser | null> {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  let provided: Uint8Array;
  let decoded: { userId?: string; email?: string; issuedAt?: number; expiresAt?: number };
  try {
    provided = base64UrlDecode(signature);
    decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
  } catch {
    return null;
  }
  let expected: Uint8Array;
  try {
    expected = await sign(payload);
  } catch {
    return null;
  }
  if (!constantTimeEqual(provided, expected)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof decoded.userId !== "string" || !decoded.userId || typeof decoded.email !== "string" ||
      typeof decoded.issuedAt !== "number" || typeof decoded.expiresAt !== "number" ||
      decoded.issuedAt > now + 60 || decoded.expiresAt <= now || decoded.expiresAt - decoded.issuedAt > SESSION_SECONDS) return null;
  return { userId: decoded.userId, email: decoded.email, displayName: decoded.email, fullName: null };
}

async function sign(value: string): Promise<Uint8Array> {
  const secret = (env as unknown as Record<string, string | undefined>).APP_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Email authentication is not configured.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

function base64UrlEncode(bytes: Uint8Array | string) {
  const data = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
