import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { isAdminRole, normalizeRole, UserRole } from "@/lib/roles";
import { User } from "@/models";

const COOKIE_NAME = "smm_token";
const isProduction = process.env.NODE_ENV === "production";
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
  path: "/",
} as const;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  authSource?: "environment" | "database";
};

function environmentAdminCredentials() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return null;

  const name = process.env.ADMIN_NAME?.trim() || "Admin";
  const normalizedUsername = username.toLowerCase();
  const id = createHash("sha256").update(`environment-admin:${normalizedUsername}`).digest("hex").slice(0, 24);
  const email = normalizedUsername.includes("@") ? normalizedUsername : "admin@environment.local";
  const fingerprint = createHmac("sha256", jwtSecret())
    .update(`${normalizedUsername}\0${password}\0${name}`)
    .digest("hex");

  return { username, password, name, id, email, fingerprint };
}

function safeStringEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function usernameMatches(input: string, configured: string) {
  if (safeStringEqual(input.trim().toLowerCase(), configured.trim().toLowerCase())) return true;
  const phoneIdentifier = /^[+()\d\s.-]+$/;
  if (!phoneIdentifier.test(input) || !phoneIdentifier.test(configured)) return false;

  const inputPhone = input.replace(/\D/g, "");
  const configuredPhone = configured.replace(/\D/g, "");
  return Boolean(inputPhone && configuredPhone && safeStringEqual(inputPhone, configuredPhone));
}

export function isEnvironmentAdmin(user: AuthUser) {
  const credentials = environmentAdminCredentials();
  return Boolean(
    credentials &&
      user.authSource === "environment" &&
      user.role === "admin" &&
      user.id === credentials.id &&
      user.email === credentials.email,
  );
}

export function authenticateEnvironmentAdmin(username: string, password: string): AuthUser | null {
  const credentials = environmentAdminCredentials();
  if (!credentials || !usernameMatches(username, credentials.username)) return null;
  if (!safeStringEqual(password, credentials.password)) return null;

  return {
    id: credentials.id,
    email: credentials.email,
    name: credentials.name,
    role: "admin",
    authSource: "environment",
  };
}

function jwtSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET || "development-secret-change-me");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function signSession(user: AuthUser) {
  const credentials = user.authSource === "environment" ? environmentAdminCredentials() : null;
  if (user.authSource === "environment" && !credentials) {
    throw new Error("Environment-managed admin credentials are not configured");
  }

  const token = new SignJWT(
    credentials ? { ...user, credentialFingerprint: credentials.fingerprint } : user,
  )
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d");
  return token.sign(jwtSecret());
}

export async function verifySession(token?: string): Promise<AuthUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    if (!payload.sub || !payload.email || !payload.name || !payload.role) return null;
    const user: AuthUser = {
      id: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      role: normalizeRole(payload.role),
    };
    if (payload.authSource === "environment") {
      const credentials = environmentAdminCredentials();
      if (
        user.role !== "admin" ||
        !credentials ||
        user.id !== credentials.id ||
        user.email !== credentials.email ||
        user.name !== credentials.name ||
        typeof payload.credentialFingerprint !== "string" ||
        !safeStringEqual(payload.credentialFingerprint, credentials.fingerprint)
      ) {
        return null;
      }
      user.authSource = "environment";
    } else if (payload.authSource === "database") {
      if (user.role !== "admin") return null;
      user.authSource = "database";
    } else if (user.role === "admin") {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export async function currentUser() {
  const store = await cookies();
  return verifySession(store.get(COOKIE_NAME)?.value);
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");
  if (isEnvironmentAdmin(user)) {
    throw new Error("Environment-managed admin accounts do not have a user profile");
  }
  await dbConnect();
  const dbUser = await User.findById(user.id);
  if (!dbUser || dbUser.isBanned) throw new Error("Unauthorized");
  if (user.authSource === "database" && normalizeRole(dbUser.role) !== "admin") {
    throw new Error("Unauthorized");
  }
  return {
    auth: {
      ...user,
      email: dbUser.email,
      name: dbUser.name,
      role: normalizeRole(dbUser.role),
    },
    dbUser,
  };
}

export async function requireAdmin() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");
  if (isEnvironmentAdmin(user)) {
    return { auth: user, dbUser: null };
  }

  const result = await requireUser();
  if (!isAdminRole(result.auth.role)) throw new Error("Forbidden");
  return result;
}

export async function setSessionCookie(user: AuthUser) {
  const token = await signSession(user);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function setSessionCookieOnResponse(response: NextResponse, user: AuthUser) {
  const token = await signSession(user);
  response.cookies.set(COOKIE_NAME, token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
}
