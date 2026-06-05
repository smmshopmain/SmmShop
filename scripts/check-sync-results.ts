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
    const { SyncStatus, ProviderLog } = await import('../src/models/index.ts');

    const status = await SyncStatus.findOne({ taskType: 'service_sync' }).lean();
    console.log('SyncStatus:');
    console.dir(status, { depth: 5 });

    const recentLogs = await ProviderLog.find({ scope: 'service_sync' }).sort({ createdAt: -1 }).limit(40).lean();
    console.log('\nRecent ProviderLog entries (latest 40):');
    for (const l of recentLogs) {
      console.log(JSON.stringify({ level: l.level, action: l.action, message: l.message, details: l.details, createdAt: l.createdAt }, null, 2));
    }

    const importCount = await ProviderLog.countDocuments({ scope: 'service_sync', action: 'service_import' });
    console.log('\nTotal service_import logs:', importCount);

    await mongoose.disconnect();
  }catch(err){
    console.error('ERROR', err);
    process.exit(1);
  }
})();
