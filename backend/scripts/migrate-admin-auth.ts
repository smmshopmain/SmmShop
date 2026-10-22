import { randomBytes } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { dbConnect } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { User } from "../src/models";

async function main() {
  loadEnvConfig(process.cwd());
  await dbConnect();

  const legacyAdmins = await User.countDocuments({ role: "admin" });
  if (!process.argv.includes("--apply")) {
    console.log(`Found ${legacyAdmins} database-managed admin account(s). No changes made.`);
    console.log("Review this count, then rerun with --apply to disable their old credentials.");
    return;
  }

  const passwordHash = await hashPassword(randomBytes(48).toString("base64url"));
  const result = await User.updateMany(
    { role: "admin" },
    { $set: { role: "user", passwordHash, isBanned: true } },
  );
  console.log(`Disabled ${result.modifiedCount} database-managed admin account(s).`);
}

main()
  .catch((error) => {
    console.error("Failed to migrate database-managed admin accounts:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const mongoose = await import("mongoose");
    await mongoose.default.disconnect();
  });
