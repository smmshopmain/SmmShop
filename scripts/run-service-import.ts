(async () => {
  try {
    console.log('Starting service import test...');
    const mod = await import('../src/lib/sync-tasks');
    if (!mod || typeof mod.serviceImportTask !== 'function') {
      console.error('serviceImportTask not found');
      process.exit(2);
    }
    const result = await mod.serviceImportTask();
    console.log('Service import result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Service import failed:', err instanceof Error ? err.message : err);
    if (err && typeof err === 'object') console.error(err);
    process.exit(1);
  }
})();
