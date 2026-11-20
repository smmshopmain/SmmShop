import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { Service, User } from "@/models";

const wishlistSchema = z.object({
  action: z.enum(["add", "remove"]),
  serviceId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid service id."),
});

export async function GET() {
  try {
    await dbConnect();
    const { auth } = await requireUser();
    const user = await User.findById(auth.id).select("wishlistServices").lean();
    if (!user) return fail("User not found", 404);

    const serviceIds: string[] = (user.wishlistServices ?? []).map((serviceId: unknown) => String(serviceId));
    const services = await Service.find({ _id: { $in: serviceIds } })
      .select("providerServiceId name category sellingRate min max refill active")
      .lean();
    const serviceById = new Map(services.map((service) => [String(service._id), service]));

    return ok({
      services: serviceIds
        .map((serviceId) => serviceById.get(serviceId))
        .filter((service) => service !== undefined),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load wishlist", 401);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();
    const { auth } = await requireUser();
    const input = await parseBody(request, wishlistSchema);

    if (input.action === "add") {
      const service = await Service.findOne({ _id: input.serviceId, active: true }).select("_id").lean();
      if (!service) return fail("This service is no longer available.", 404);
      const update = await User.updateOne(
        { _id: auth.id },
        { $addToSet: { wishlistServices: service._id } },
      );
      if (update.matchedCount === 0) return fail("User not found", 404);
    } else {
      const update = await User.updateOne(
        { _id: auth.id },
        { $pull: { wishlistServices: input.serviceId } },
      );
      if (update.matchedCount === 0) return fail("User not found", 404);
    }

    return ok({ serviceId: input.serviceId, saved: input.action === "add" });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update wishlist");
  }
}
