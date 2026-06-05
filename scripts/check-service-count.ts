import mongoose from 'mongoose';

(async function main(){
  try{
    let uri = process.env.MONGODB_URI;
    if(!uri){
      // try reading backend/.env.local
      try{
        const fs = await import('fs');
        const path = 'backend/.env.local';
        if(fs.existsSync(path)){
          const content = fs.readFileSync(path, 'utf8');
          const m = content.match(/^MONGODB_URI=(.+)$/m);
          if(m) uri = m[1].trim();
        }
      }catch{}
    }
    if(!uri){
      console.error('MONGODB_URI not set');
      process.exit(1);
    }
    await mongoose.connect(uri);
    const { Service } = await import('../src/models/index.ts');
    const count = await Service.countDocuments({});
    console.log('Service count:', count);
    await mongoose.disconnect();
  }catch(err){
    console.error('ERROR', err);
    process.exit(1);
  }
})();
