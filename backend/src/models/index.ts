import mongoose, { Schema, model, models } from "mongoose";
import {
  DEFAULT_VERIFICATION_SCHEDULE,
  DEPOSIT_STATUSES,
  ORDER_STATUSES,
  REFILL_STATUSES,
} from "@/lib/constants";

const money = { type: Number, default: 0, min: 0 };

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    walletBalance: money,
    referralCode: { type: String, unique: true, sparse: true, index: true },
    referredBy: { type: Schema.Types.ObjectId, ref: "User" },
    referralEarnings: money,
    isBanned: { type: Boolean, default: false },
    walletFrozen: { type: Boolean, default: false },
    lastLoginAt: Date,
    passwordResetTokenHash: String,
    passwordResetExpiresAt: Date,
    passwordResetAttempts: { type: Number, default: 0 },
    emailChangeNewEmail: { type: String, lowercase: true, trim: true },
    emailChangeTokenHash: String,
    emailChangeExpiresAt: Date,
    emailChangeAttempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const WalletTransactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["credit", "debit", "refund", "deposit", "admin_adjustment", "referral", "promo"],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    source: { type: String, required: true },
    reference: String,
    note: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

const DepositSchema = new Schema(
  {
    depositId: { type: String, unique: true, sparse: true, index: true, trim: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    utr: { type: String, required: true, trim: true },
    proofUrl: String,
    status: { type: String, enum: DEPOSIT_STATUSES, default: "Pending", index: true },
    mode: { type: String, enum: ["manual", "automatic"], default: "manual" },
    verificationStartTime: String,
    verificationEndTime: String,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    adminAction: { type: String, enum: ["telegram_approve", "telegram_reject", "web_approve", "web_reject"] },
    adminTelegramId: String,
    reviewedAt: Date,
    rejectionReason: String,
  },
  { timestamps: true },
);

const ProviderSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    apiUrl: { type: String, required: true, trim: true },
    apiKey: { type: String, required: true },
    username: { type: String, trim: true },
    enabled: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 1, index: true },
    balance: money,
    lastBalanceSyncAt: Date,
    lastServiceSyncAt: Date,
    serviceCache: {
      lastFetchedAt: Date,
      serviceCount: Number,
      raw: Schema.Types.Mixed,
    },
    lastError: String,
  },
  { timestamps: true },
);
ProviderSchema.index({ apiUrl: 1, apiKey: 1 }, { unique: true });

const CategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, index: true },
    providers: [{ type: Schema.Types.ObjectId, ref: "Provider" }],
    active: { type: Boolean, default: true, index: true },
    serviceCount: { type: Number, default: 0, min: 0 },
    lastSyncedAt: Date,
    providerData: Schema.Types.Mixed,
  },
  { timestamps: true },
);

const ServiceSchema = new Schema(
  {
    provider: { type: Schema.Types.ObjectId, ref: "Provider", required: true, index: true },
    providerServiceId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, index: "text" },
    categoryRef: { type: Schema.Types.ObjectId, ref: "Category", index: true },
    category: { type: String, required: true, index: true },
    type: String,
    providerRate: { type: Number, required: true },
    sellingRate: { type: Number, required: true },
    min: { type: Number, default: 1 },
    max: { type: Number, default: 100000 },
    refill: { type: Boolean, default: false },
    cancel: { type: Boolean, default: false },
    active: { type: Boolean, default: true, index: true },
    marginPercent: Number,
    lastSyncedAt: Date,
    providerData: Schema.Types.Mixed,
  },
  { timestamps: true },
);
ServiceSchema.index({ provider: 1, providerServiceId: 1 }, { unique: true });

const OrderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    provider: { type: Schema.Types.ObjectId, ref: "Provider", required: true, index: true },
    providerOrderId: { type: String, index: true },
    link: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ORDER_STATUSES, default: "Pending", index: true },
    providerCost: { type: Number, required: true },
    providerCharge: Number,
    sellingPrice: { type: Number, required: true },
    promoCode: String,
    promoDiscount: money,
    profit: { type: Number, required: true },
    startCount: Number,
    remains: Number,
    warningAcceptedAt: { type: Date, required: true },
    lastStatusSyncAt: Date,
    providerResponse: Schema.Types.Mixed,
  },
  { timestamps: true },
);

const RefillSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    provider: { type: Schema.Types.ObjectId, ref: "Provider", required: true },
    providerRefillId: String,
    status: { type: String, enum: REFILL_STATUSES, default: "Pending", index: true },
    lastStatusSyncAt: Date,
    providerResponse: Schema.Types.Mixed,
  },
  { timestamps: true },
);

const TicketSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true },
    status: { type: String, enum: ["Open", "Answered", "Closed"], default: "Open", index: true },
    priority: { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
    messages: [
      {
        sender: { type: Schema.Types.ObjectId, ref: "User" },
        body: { type: String, required: true },
        isAdmin: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

const PromoCodeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountType: { type: String, enum: ["percent", "fixed"], default: "percent" },
    discountValue: { type: Number, required: true },
    maxUses: Number,
    usedCount: { type: Number, default: 0 },
    minOrderAmount: money,
    active: { type: Boolean, default: true },
    expiresAt: Date,
  },
  { timestamps: true },
);

const ReferralSchema = new Schema(
  {
    referrer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    referredUser: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    earnings: money,
    status: { type: String, enum: ["Pending", "Paid"], default: "Pending" },
  },
  { timestamps: true },
);

const SettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

const AuditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true, index: true },
    entity: String,
    entityId: String,
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    ip: String,
    userAgent: String,
  },
  { timestamps: true },
);

const ProviderLogSchema = new Schema(
  {
    provider: { type: Schema.Types.ObjectId, ref: "Provider", index: true },
    level: { type: String, enum: ["info", "warning", "error"], default: "info", index: true },
    scope: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    message: { type: String, required: true },
    details: Schema.Types.Mixed,
  },
  { timestamps: true },
);

const NotificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User" },
    channel: { type: String, enum: ["in_app", "telegram", "email"], default: "in_app" },
    title: { type: String, required: true },
    body: String,
    readAt: Date,
  },
  { timestamps: true },
);

const RateLimitSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    count: { type: Number, default: 0 },
    resetAt: { type: Date, required: true },
  },
  { timestamps: true },
);
RateLimitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

export const User = models.User || model("User", UserSchema);
export const WalletTransaction =
  models.WalletTransaction || model("WalletTransaction", WalletTransactionSchema);
export const Deposit = models.Deposit || model("Deposit", DepositSchema);
export const Order = models.Order || model("Order", OrderSchema);
export const Refill = models.Refill || model("Refill", RefillSchema);
export const Service = models.Service || model("Service", ServiceSchema);
export const Category = models.Category || model("Category", CategorySchema);
export const Provider = models.Provider || model("Provider", ProviderSchema);
export const Ticket = models.Ticket || model("Ticket", TicketSchema);
export const PromoCode = models.PromoCode || model("PromoCode", PromoCodeSchema);
export const Referral = models.Referral || model("Referral", ReferralSchema);
export const Setting = models.Setting || model("Setting", SettingsSchema);
export const AuditLog = models.AuditLog || model("AuditLog", AuditLogSchema);
export const ProviderLog = models.ProviderLog || model("ProviderLog", ProviderLogSchema);
export const Notification =
  models.Notification || model("Notification", NotificationSchema);
export const RateLimit = models.RateLimit || model("RateLimit", RateLimitSchema);

export type PlatformSettings = {
  pricing: {
    globalMarginPercent: number;
    categoryMargins: Record<string, number>;
    serviceMargins: Record<string, number>;
  };
  deposits: {
    verificationMode: "manual" | "automatic";
    verificationStartTime: string;
    verificationEndTime: string;
    payment: {
      qrImageUrl: string;
      upiId: string;
      accountNumber: string;
      ifsc: string;
      accountName: string;
      bankName: string;
      instructions: string;
    };
  };
  provider: { lowBalanceThreshold: number };
  referrals: { commissionPercent: number };
};

export async function getSettings() {
  const records = await Setting.find().lean();
  const settings: PlatformSettings = {
    pricing: { globalMarginPercent: 20, categoryMargins: {}, serviceMargins: {} },
    deposits: {
      verificationMode: "manual",
      ...DEFAULT_VERIFICATION_SCHEDULE,
      payment: {
        qrImageUrl: "",
        upiId: "",
        accountNumber: "",
        ifsc: "",
        accountName: "",
        bankName: "",
        instructions: "",
      },
    },
    provider: { lowBalanceThreshold: 100 },
    referrals: { commissionPercent: 2 },
  };

  for (const record of records as Array<{ key: string; value: unknown }>) {
    if (record.key === "pricing") settings.pricing = { ...settings.pricing, ...(record.value as Partial<PlatformSettings["pricing"]>) };
    if (record.key === "deposits") settings.deposits = { ...settings.deposits, ...(record.value as Partial<PlatformSettings["deposits"]>) };
    if (record.key === "provider") settings.provider = { ...settings.provider, ...(record.value as Partial<PlatformSettings["provider"]>) };
    if (record.key === "referrals") settings.referrals = { ...settings.referrals, ...(record.value as Partial<PlatformSettings["referrals"]>) };
  }

  return settings;
}

export type MongoDoc = mongoose.Document & { _id: mongoose.Types.ObjectId };
