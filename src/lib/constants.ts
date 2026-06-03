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
  "If you submit an incorrect, private, deleted, inaccessible, or invalid link, no refund will be provided.";

export const WARNING_HI =
  "Agar aap galat, private, deleted, inaccessible ya invalid link submit karte hain to kisi bhi prakar ka refund nahi diya jayega.";

export const DEFAULT_VERIFICATION_SCHEDULE = {
  verificationStartTime: "10:00",
  verificationEndTime: "22:00",
};

export type OrderStatus = (typeof ORDER_STATUSES)[number];
