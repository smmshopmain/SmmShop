import type { PipelineStage } from "mongoose";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export class InvalidAnalyticsDateRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAnalyticsDateRangeError";
  }
}

function parseDate(value: string | undefined, field: "from" | "to") {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidAnalyticsDateRangeError(`The ${field} date must use YYYY-MM-DD format.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new InvalidAnalyticsDateRangeError(`The ${field} date is not a valid calendar date.`);
  }
  return date;
}

export function analyticsDateFilter(from?: string, to?: string) {
  const start = parseDate(from, "from");
  const end = parseDate(to, "to");
  if (start && end && start > end) {
    throw new InvalidAnalyticsDateRangeError("The start date must be on or before the end date.");
  }

  const createdAt: Record<string, Date> = {};
  if (start) createdAt.$gte = start;
  if (end) createdAt.$lt = new Date(end.getTime() + DAY_IN_MS);
  return Object.keys(createdAt).length ? { createdAt } : {};
}

export function excludeRefundedOrderStages(): PipelineStage[] {
  return [
    { $addFields: { _analyticsOrderReference: { $toString: "$_id" } } },
    {
      $lookup: {
        from: "wallettransactions",
        localField: "_analyticsOrderReference",
        foreignField: "reference",
        pipeline: [{ $match: { type: "refund" } }, { $limit: 1 }],
        as: "_analyticsRefund",
      },
    },
    { $match: { "_analyticsRefund.0": { $exists: false } } },
  ];
}
