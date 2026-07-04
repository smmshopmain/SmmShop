export type PlatformSettings = {
  pricing: { globalMarginPercent: number; categoryMargins?: Record<string, number>; serviceMargins?: Record<string, number> };
  deposits: {
    verificationMode: string;
    verificationStartTime: string;
    verificationEndTime: string;
    minimumWalletAddAmount: number;
    payment: PaymentSettings;
  };
  provider: { lowBalanceThreshold: number };
  referrals: { commissionPercent: number };
};

type PaymentSettings = {
  qrImageUrl: string;
  upiId: string;
  accountNumber: string;
  ifsc: string;
  accountName: string;
  bankName: string;
  instructions: string;
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

class Query<T = unknown> {
  constructor(private result: T[] = []) {}
  populate(..._args: unknown[]) {
    void _args;
    return this;
  }
  sort(..._args: unknown[]) {
    void _args;
    return this;
  }
  limit(..._args: unknown[]) {
    void _args;
    return this;
  }
  select(..._args: unknown[]) {
    void _args;
    return this;
  }
  lean() {
    return Promise.resolve(this.result);
  }
}

export const Order = {
  find: (_filter?: unknown) => {
    void _filter;
    return new Query<unknown>([]);
  },
  aggregate: async (_ops?: unknown) => {
    void _ops;
    return [] as unknown[];
  },
};

export const Deposit = {
  find: (_filter?: unknown) => {
    void _filter;
    return new Query<unknown>([]);
  },
};
export const WalletTransaction = {
  find: (_filter?: unknown) => {
    void _filter;
    return new Query<unknown>([]);
  },
  aggregate: async (..._args: unknown[]): Promise<unknown[]> => {
    void _args;
    return [];
  },
};
export const Notification = {
  find: (_filter?: unknown) => {
    void _filter;
    return new Query<unknown>([]);
  },
};
export const Refill = {
  find: (_filter?: unknown) => {
    void _filter;
    return new Query<unknown>([]);
  },
};
export const Ticket = {
  find: (_filter?: unknown) => {
    void _filter;
    return new Query<unknown>([]);
  },
};
export const PromoCode = {
  find: (_filter?: unknown) => {
    void _filter;
    return new Query<unknown>([]);
  },
};
export const Provider = {
  find: (_filter?: unknown) => {
    void _filter;
    return new Query<unknown>([]);
  },
};
export const Service = {
  find: (_filter?: unknown) => {
    void _filter;
    return new Query<unknown>([]);
  },
  distinct: async (_field?: string) => {
    void _field;
    return [] as string[];
  },
};
export const Category = {
  find: (_filter?: unknown) => {
    void _filter;
    return new Query<unknown>([]);
  },
};
export const Referral = {
  find: (_filter?: unknown) => {
    void _filter;
    return new Query<unknown>([]);
  },
  distinct: async () => [] as string[],
};
export const AuditLog = {
  find: (_filter?: unknown) => {
    void _filter;
    return new Query<unknown>([]);
  },
};

export async function getSettings(): Promise<PlatformSettings> {
  return defaultSettings;
}

 
