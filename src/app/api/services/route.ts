import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { Category, Service } from "@/models";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const category = searchParams.get("category");
    const filter: Record<string, unknown> = { active: true };
    if (category) filter.category = category;
    if (query) filter.$text = { $search: query };

    const [services, categories] = await Promise.all([
      Service.find(filter).sort({ category: 1, name: 1 }).limit(250).lean(),
      Category.find({ active: true }).sort({ name: 1 }).select("name").lean(),
    ]);
    const categoryNames = [...new Set(categories.map((item) => item.name))];
    const fallbackCategories = categoryNames.length > 0 ? categoryNames : await Service.distinct("category", { active: true });
    return ok({ services, categories: fallbackCategories });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load services");
  }
}
