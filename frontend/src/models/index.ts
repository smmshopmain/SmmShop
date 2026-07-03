export type PlatformSettings = {
  pricing: { globalMarginPercent: number; categoryMargins?: Record<string, number>; serviceMargins?: Record<string, number> };
  deposits: { verificationMode: string; verificationStartTime: string; verificationEndTime: string; minimumWalletAddAmount: number; payment: any };
  provider: { lowBalanceThreshold: number };
  referrals: { commissionPercent: number };
};

const defaultSettings: PlatformSettings = {
  pricing: { globalMarginPercent: 20, categoryMargins: {}, serviceMargins: {} },
  deposits: {
    verificationMode: "manual",
    verificationStartTime: "10:00",
    verificationEndTime: "22:00",
    minimumWalletAddAmount: 0,
    payment: { qrImageUrl: "", upiId: "", accountNumber: "", ifsc: "", accountName: "", bankName: "", instructions: "" },
  },
  provider: { lowBalanceThreshold: 100 },
  referrals: { commissionPercent: 2 },
};

class Query {
  constructor(private result: any[] = []) {}
  populate(..._args: any[]) {
    return this;
  }
  sort(..._args: any[]) {
    return this;
  }
  limit(..._args: any[]) {
    return this;
  }
  select(..._args: any[]) {
    return this;
  }
  lean() {
    return Promise.resolve(this.result);
  }
}

export const Order = {
  find: (_filter?: any) => new Query([]),
  aggregate: async (_ops?: any) => [] as any[],
};

export const Deposit = { find: (_filter?: any) => new Query([]) };
export const WalletTransaction = { find: (_filter?: any) => new Query([]), aggregate: async (..._args: any[]): Promise<any[]> => [] };
export const Notification = { find: (_filter?: any) => new Query([]) };
export const Refill = { find: (_filter?: any) => new Query([]) };
export const Ticket = { find: (_filter?: any) => new Query([]) };
export const PromoCode = { find: (_filter?: any) => new Query([]) };
export const Provider = { find: (_filter?: any) => new Query([]) };
export const Service = { find: (_filter?: any) => new Query([]), distinct: async (_field?: string) => [] };
export const Category = { find: (_filter?: any) => new Query([]) };
export const Referral = { find: (_filter?: any) => new Query([]), distinct: async () => [] };
export const AuditLog = { find: (_filter?: any) => new Query([]) };

export async function getSettings(): Promise<PlatformSettings> {
  return defaultSettings;
}

 
