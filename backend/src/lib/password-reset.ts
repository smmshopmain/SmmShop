import crypto from "crypto";

export function createPasswordResetOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export function hashPasswordResetOtp(email: string, otp: string) {
  const secret = process.env.JWT_SECRET || "development-secret-change-me";
  return crypto
    .createHmac("sha256", secret)
    .update(`${email.toLowerCase()}:${otp}`)
    .digest("hex");
}

export function hashEmailChangeOtp(userId: string, email: string, otp: string) {
  const secret = process.env.JWT_SECRET || "development-secret-change-me";
  return crypto
    .createHmac("sha256", secret)
    .update(`email-change:${userId}:${email.toLowerCase()}:${otp}`)
    .digest("hex");
}

export function hashPhoneChangeOtp(userId: string, phone: string, otp: string) {
  const secret = process.env.JWT_SECRET || "development-secret-change-me";
  return crypto
    .createHmac("sha256", secret)
    .update(`phone-change:${userId}:${phone}:${otp}`)
    .digest("hex");
}

export function hashPasswordChangeOtp(userId: string, otp: string) {
  const secret = process.env.JWT_SECRET || "development-secret-change-me";
  return crypto
    .createHmac("sha256", secret)
    .update(`password-change:${userId}:${otp}`)
    .digest("hex");
}
