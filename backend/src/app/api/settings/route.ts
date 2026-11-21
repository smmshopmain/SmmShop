import { fail, ok } from "@/lib/api";
import { dbConnect } from "@/lib/db";
import { getSettings } from "@/models";

export async function GET() {
  try {
    await dbConnect();
    const settings = await getSettings();
    return ok({
      ...settings,
      api: undefined,
      auth: {
        googleEnabled:
          settings.auth.googleEnabled &&
          Boolean(process.env.GOOGLE_CLIENT_ID?.trim()) &&
          Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim()),
      },
      apiEnabled: settings.api.enabled,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load settings", 500);
  }
}
