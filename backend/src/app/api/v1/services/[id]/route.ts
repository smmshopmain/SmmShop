import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { getApiDiscount, publicService, ResellerApiError, runResellerApiRequest } from "@/lib/reseller-api";
import { Service } from "@/models";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runResellerApiRequest(request, "rest", {}, "services.get", async (context) => {
    if (!mongoose.isValidObjectId(id)) {
      throw new ResellerApiError("SERVICE_UNAVAILABLE", "The requested service is unavailable.", 404);
    }
    const service = await Service.findById(id)
      .populate({ path: "provider", match: { enabled: true }, select: "_id" })
      .lean();
    if (!service || !service.active || !service.provider) {
      throw new ResellerApiError("SERVICE_UNAVAILABLE", "The requested service is unavailable.", 404);
    }
    return publicService(service, getApiDiscount(context));
  });
}
