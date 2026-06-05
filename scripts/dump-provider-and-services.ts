import mongoose from 'mongoose';

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
    if(!uri){
      console.error('MONGODB_URI not set');
      process.exit(1);
    }

    await mongoose.connect(uri);
    const { Provider, Service } = await import('../src/models/index.ts');

    const provider = await Provider.findOne().lean();
    if(!provider){
      console.log('No providers found');
    } else {
      console.log('Provider:', { _id: provider._id, name: provider.name });
      const cache = provider.serviceCache ?? null;
      if(cache && cache.lastFetchedAt){
        console.log('serviceCache.lastFetchedAt:', cache.lastFetchedAt);
      }
      if(cache && cache.raw){
        try{
          const raw = cache.raw;
          if(Array.isArray(raw)){
            console.log('serviceCache.raw is array with length', raw.length);
            console.log('First item:', JSON.stringify(raw[0], null, 2));
          }else{
            console.log('serviceCache.raw type:', typeof raw);
            const str = JSON.stringify(raw);
            console.log('Raw snippet:', str.slice(0, 1000));
          }
        }catch(e){ console.error('error reading raw', e); }
      } else {
        console.log('No serviceCache.raw present');
      }
    }

    const sample = await Service.find().limit(10).select('providerServiceId name category providerRate sellingRate active').lean();
    console.log('\nSample services (up to 10):');
    console.dir(sample, { depth: 5 });

    await mongoose.disconnect();
  }catch(err){
    console.error('ERROR', err);
    process.exit(1);
  }
})();
