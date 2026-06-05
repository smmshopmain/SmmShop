import { dbConnect } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { User } from "../src/models";

const ADMIN_PHONE = "6388391842";
const ADMIN_PASSWORD = "12345678";
const ADMIN_EMAIL = `admin+${ADMIN_PHONE}@smm.local`;
const ADMIN_NAME = "Admin";

async function main() {
  await dbConnect();

  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const referralCode = Math.random().toString(36).slice(2, 10).toUpperCase();

  const existingUser = await User.findOne({ phone: ADMIN_PHONE });
  if (existingUser) {
    existingUser.name = ADMIN_NAME;
    existingUser.email = ADMIN_EMAIL;
    existingUser.role = "admin";
    existingUser.passwordHash = passwordHash;
    existingUser.referralCode = existingUser.referralCode || referralCode;
    existingUser.isBanned = false;
    existingUser.walletFrozen = false;
    await existingUser.save();
    console.log(`Updated existing admin user: phone=${ADMIN_PHONE}`);
  } else {
    await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      passwordHash,
      role: "admin",
      referralCode,
    });
    console.log(`Created new admin user: phone=${ADMIN_PHONE}`);
  }
}

main()
  .then(() => {
    console.log("Admin setup complete.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to create or update admin user:", error);
    process.exit(1);
  });
