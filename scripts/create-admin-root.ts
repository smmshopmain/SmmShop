import mongoose from 'mongoose';
import { hashPassword } from '../src/lib/auth';

(async function main(){
  try{
    let uri = process.env.MONGODB_URI;
    if(!uri){
      const fs = await import('fs');
      const path = 'backend/.env.local';
      if(fs.existsSync(path)){
        const content = fs.readFileSync(path,'utf8');
        const m = content.match(/^MONGODB_URI=(.+)$/m);
        if(m) uri = m[1].trim();
      }
    }
    if(!uri){ console.error('MONGODB_URI not set'); process.exit(1); }
    await mongoose.connect(uri);
    const { User } = await import('../src/models/index.ts');

    const ADMIN_PHONE = '6388391842';
    const ADMIN_PASSWORD = '12345678';
    const ADMIN_EMAIL = `admin+${ADMIN_PHONE}@smm.local`;
    const ADMIN_NAME = 'Admin';

    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    const existingUser = await User.findOne({ phone: ADMIN_PHONE });
    if (existingUser) {
      existingUser.name = ADMIN_NAME;
      existingUser.email = ADMIN_EMAIL;
      existingUser.role = 'admin';
      existingUser.passwordHash = passwordHash;
      existingUser.referralCode = existingUser.referralCode || Math.random().toString(36).slice(2,10).toUpperCase();
      existingUser.isBanned = false;
      existingUser.walletFrozen = false;
      await existingUser.save();
      console.log(`Updated existing admin user: phone=${ADMIN_PHONE}`);
    } else {
      await User.create({ name: ADMIN_NAME, email: ADMIN_EMAIL, phone: ADMIN_PHONE, passwordHash, role: 'admin', referralCode: Math.random().toString(36).slice(2,10).toUpperCase() });
      console.log(`Created new admin user: phone=${ADMIN_PHONE}`);
    }

    await mongoose.disconnect();
  }catch(err){ console.error(err); process.exit(1); }
})();
