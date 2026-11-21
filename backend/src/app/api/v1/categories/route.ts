import { NextRequest } from "next/server";
import { runResellerApiRequest } from "@/lib/reseller-api";
import { Service } from "@/models";

export async function GET(request: NextRequest) {
  return runResellerApiRequest(request, "rest", {}, "categories.list", async () => {
    const services = await Service.find({ active: true })
      .populate({ path: "provider", match: { enabled: true }, select: "_id" })
      .select("category provider")
      .lean();
    return { categories: [...new Set(services.filter((service) => service.provider).map((service) => service.category))].sort() };
  });
}
