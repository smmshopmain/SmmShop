import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { isAdminRole, normalizeRole, UserRole } from "@/lib/roles";
import { User } from "@/models";

const COOKIE_NAME = "smm_token";
const isProduction = process.env.NODE_ENV === "production";
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: isProduction,
  path: "/",
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

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
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(jwtSecret());
}

export async function verifySession(token?: string): Promise<AuthUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    if (!payload.sub || !payload.email || !payload.name || !payload.role) return null;
    return {
      id: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      role: normalizeRole(payload.role),
    };
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
  await dbConnect();
  const dbUser = await User.findById(user.id);
  if (!dbUser || dbUser.isBanned) throw new Error("Unauthorized");
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

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
}
