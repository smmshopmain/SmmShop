export const ORDER_STATUSES = [
  "Pending",
  "Processing",
  "In Progress",
  "Completed",
  "Partial",
  "Canceled",
] as const;

export const DEPOSIT_STATUSES = ["Pending", "Approved", "Rejected"] as const;

export const REFILL_STATUSES = [
  "Pending",
  "Processing",
  "Completed",
  "Rejected",
  "Canceled",
] as const;

export const WARNING_EN =
  "Wrong/private/invalid link par refund nahi milega.";

export const WARNING_HI =
  "Galat/private/invalid link par refund nahi milega.";

export const DEFAULT_VERIFICATION_SCHEDULE = {
  verificationStartTime: "10:00",
  verificationEndTime: "22:00",
};

export type OrderStatus = (typeof ORDER_STATUSES)[number];
