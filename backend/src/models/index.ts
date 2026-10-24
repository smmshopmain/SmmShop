import mongoose, { Schema, model, models } from "mongoose";
import {
  DEFAULT_VERIFICATION_SCHEDULE,
  DEPOSIT_STATUSES,
  ORDER_STATUSES,
  REFILL_STATUSES,
} from "@/lib/constants";
import { DEFAULT_ENABLED_LOADING_ANIMATIONS, LOADING_ANIMATION_IDS } from "@/lib/loading-animations";
import { generateReferralCode } from "@/lib/referral-code";

const money = { type: Number, default: 0, min: 0 };

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    googleSub: { type: String, unique: true, sparse: true, index: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    passwordHash: { type: String, required: true },
    marketingUnsubscribed: { type: Boolean, default: false, index: true },
    marketingUnsubscribedAt: Date,
    role: { type: String, enum: ["user", "staff", "secondary_admin", "admin"], default: "user", index: true },
    walletBalance: money,
    referralCode: { type: String, unique: true, sparse: true, index: true, default: generateReferralCode },
    referredBy: { type: Schema.Types.ObjectId, ref: "User" },
    referralEarnings: money,
    isBanned: { type: Boolean, default: false },
    walletFrozen: { type: Boolean, default: false },
    lastLoginAt: Date,
    activeSessionId: String,
    loginHistory: [
      {
        loggedInAt: { type: Date, required: true },
        device: { type: String, required: true },
        location: { type: String, required: true },
      },
    ],
    passwordResetTokenHash: String,
    passwordResetExpiresAt: Date,
    passwordResetAttempts: { type: Number, default: 0 },
    emailChangeNewEmail: { type: String, lowercase: true, trim: true },
    emailChangeTokenHash: String,
    emailChangeExpiresAt: Date,
    emailChangeAttempts: { type: Number, default: 0 },
    phoneChangeNewPhone: { type: String, trim: true },
    phoneChangeTokenHash: String,
    phoneChangeExpiresAt: Date,
    phoneChangeAttempts: { type: Number, default: 0 },
    passwordChangeTokenHash: String,
    passwordChangeExpiresAt: Date,
    passwordChangeAttempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const PendingRegistrationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    referralCode: { type: String, trim: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    attempts: { type: Number, default: 0, min: 0 },
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
    deletedAt: { type: Date, default: null },
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

const EmailCampaignSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    kind: { type: String, enum: ["announcement", "advertisement"], required: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 10000 },
    includeUnsubscribed: { type: Boolean, default: false },
    scheduledAt: { type: Date, required: true, index: true },
    recipientCutoffAt: { type: Date, required: true },
    cursor: { type: Schema.Types.ObjectId },
    status: {
      type: String,
      enum: ["scheduled", "queued", "sending", "sent", "partial", "failed"],
      default: "queued",
      index: true,
    },
    recipientCount: { type: Number, default: 0, min: 0 },
    sentCount: { type: Number, default: 0, min: 0 },
    failedCount: { type: Number, default: 0, min: 0 },
    lockUntil: Date,
    lastError: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true },
);
EmailCampaignSchema.index({ status: 1, scheduledAt: 1, lockUntil: 1 });

const UploadedFileSchema = new Schema(
  {
    folder: { type: String, enum: ["deposit-proofs", "payment-qr"], required: true, index: true },
    fileName: { type: String, required: true, trim: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
UploadedFileSchema.index({ folder: 1, fileName: 1 }, { unique: true });

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

const SyncStatusSchema = new Schema(
  {
    taskType: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ["pending", "running", "completed", "failed"], default: "pending", index: true },
    message: String,
    total: { type: Number, default: 0, min: 0 },
    processed: { type: Number, default: 0, min: 0 },
    details: Schema.Types.Mixed,
    startedAt: Date,
    finishedAt: Date,
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
export const PendingRegistration =
  models.PendingRegistration || model("PendingRegistration", PendingRegistrationSchema);
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
export const EmailCampaign = models.EmailCampaign || model("EmailCampaign", EmailCampaignSchema);
export const UploadedFile = models.UploadedFile || model("UploadedFile", UploadedFileSchema);
export const AuditLog = models.AuditLog || model("AuditLog", AuditLogSchema);
export const ProviderLog = models.ProviderLog || model("ProviderLog", ProviderLogSchema);
export const SyncStatus = models.SyncStatus || model("SyncStatus", SyncStatusSchema);
export const Notification =
  models.Notification || model("Notification", NotificationSchema);
export const RateLimit = models.RateLimit || model("RateLimit", RateLimitSchema);

export type PlatformSettings = {
  appearance: {
    designPreset: "default" | "studio" | "orbit" | "atelier" | "pulse" | "midnight";
    animationsEnabled: boolean;
    entranceEnabled: boolean;
    floatingEnabled: boolean;
    hoverEnabled: boolean;
    animationColor: string;
    animationSpeed: number;
    loadingAnimationsEnabled: boolean;
    loadingAnimationMode: "random" | "specific";
    selectedLoadingAnimation: (typeof LOADING_ANIMATION_IDS)[number];
    enabledLoadingAnimations: Array<(typeof LOADING_ANIMATION_IDS)[number]>;
  };
  pricing: {
    globalMarginPercent: number;
    categoryMargins: Record<string, number>;
    serviceMargins: Record<string, number>;
  };
  deposits: {
    verificationMode: "manual" | "automatic";
    verificationStartTime: string;
    verificationEndTime: string;
    minimumWalletAddAmount: number;
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
  auth: { googleEnabled: boolean };
  email: EmailManagementSettings;
  referrals: {
    enabled: boolean;
    commissionPercent: number;
    commissionAmount: number;
    minimumReferredWalletAddAmount: number;
  };
};

export type EmailManagementSettings = {
  brandName: string;
  primaryColor: string;
  accentColor: string;
  templates: {
    registrationOtp: { subject: string; body: string };
    forgotPasswordOtp: { subject: string; body: string };
    verificationOtp: { subject: string; body: string };
    welcome: { subject: string; headline: string; body: string };
  };
};

export const DEFAULT_EMAIL_MANAGEMENT_SETTINGS: EmailManagementSettings = {
  brandName: "SMM Panel",
  primaryColor: "#0b3038",
  accentColor: "#087e78",
  templates: {
    registrationOtp: {
      subject: "Verify your SMM Panel email",
      body: "Enter this OTP to finish creating your account.\nMobile number entered for registration: {{phone}}\nThis OTP expires in {{expiryMinutes}} minutes. If you did not create an account, ignore this email.",
    },
    forgotPasswordOtp: {
      subject: "SMM Panel password reset OTP",
      body: "Your password reset OTP is below. It expires in {{expiryMinutes}} minutes. If you did not request this, ignore this email.",
    },
    verificationOtp: {
      subject: "SMM Panel verification code",
      body: "Your account verification OTP is below. It expires in {{expiryMinutes}} minutes. If you did not request this, ignore this email.",
    },
    welcome: {
      subject: "Welcome to SMM Panel — your growth workspace is ready",
      headline: "Welcome aboard, {{name}}!",
      body: "Your account is ready. Explore social growth services, manage your wallet, track orders, and get support from one workspace.",
    },
  },
};

export async function getSettings() {
  const records = await Setting.find().lean();
  const settings: PlatformSettings = {
    appearance: {
      designPreset: "default",
      animationsEnabled: true,
      entranceEnabled: true,
      floatingEnabled: true,
      hoverEnabled: true,
      animationColor: "#14b8a6",
      animationSpeed: 1,
      loadingAnimationsEnabled: true,
      loadingAnimationMode: "random",
      selectedLoadingAnimation: LOADING_ANIMATION_IDS[0],
      enabledLoadingAnimations: DEFAULT_ENABLED_LOADING_ANIMATIONS,
    },
    pricing: { globalMarginPercent: 20, categoryMargins: {}, serviceMargins: {} },
    deposits: {
      verificationMode: "manual",
      ...DEFAULT_VERIFICATION_SCHEDULE,
      minimumWalletAddAmount: 0,
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
    auth: { googleEnabled: false },
    email: DEFAULT_EMAIL_MANAGEMENT_SETTINGS,
    referrals: {
      enabled: true,
      commissionPercent: 2,
      commissionAmount: 0,
      minimumReferredWalletAddAmount: 0,
    },
  };

  for (const record of records as Array<{ key: string; value: unknown }>) {
    if (record.key === "appearance" && record.value && typeof record.value === "object" && !Array.isArray(record.value)) {
      const value = record.value as Partial<PlatformSettings["appearance"]>;
      settings.appearance = {
        ...settings.appearance,
        ...value,
      };
    }
    if (record.key === "pricing") settings.pricing = { ...settings.pricing, ...(record.value as Partial<PlatformSettings["pricing"]>) };
    if (record.key === "deposits") {
      const value = record.value as Partial<PlatformSettings["deposits"]>;
      settings.deposits = {
        ...settings.deposits,
        ...value,
        payment: {
          ...settings.deposits.payment,
          ...(value.payment ?? {}),
        },
      };
    }
    if (record.key === "provider") settings.provider = { ...settings.provider, ...(record.value as Partial<PlatformSettings["provider"]>) };
    if (record.key === "auth") settings.auth = { ...settings.auth, ...(record.value as Partial<PlatformSettings["auth"]>) };
    if (record.key === "email") {
      const value = record.value as Partial<EmailManagementSettings>;
      settings.email = {
        ...settings.email,
        ...value,
        templates: {
          ...settings.email.templates,
          ...(value.templates ?? {}),
        },
      };
    }
    if (record.key === "referrals") settings.referrals = { ...settings.referrals, ...(record.value as Partial<PlatformSettings["referrals"]>) };
  }

  return settings;
}

export type MongoDoc = mongoose.Document & { _id: mongoose.Types.ObjectId };
