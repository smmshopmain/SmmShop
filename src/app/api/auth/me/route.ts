import { fail, ok } from "@/lib/api";
import { currentUser } from "@/lib/auth";

export async function GET() {
  const user = await currentUser();
  if (!user) return fail("Unauthorized", 401);
  return ok(user);
}
