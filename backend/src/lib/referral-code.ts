import crypto from "crypto";

const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferralCode(length = 8) {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += REFERRAL_ALPHABET[crypto.randomInt(0, REFERRAL_ALPHABET.length)];
  }
  return code;
}

type ReferralCodeModel = {
  exists(filter: { referralCode: string }): Promise<unknown>;
};

export async function createUniqueReferralCode(UserModel: ReferralCodeModel) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const referralCode = generateReferralCode();
    if (!(await UserModel.exists({ referralCode }))) return referralCode;
  }

  throw new Error("Unable to generate a unique referral code");
}
