

(async function(){
  try{
    const loginRes = await fetch('http://localhost:3002/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin+6388391842@smm.local', password: '12345678' }),
      redirect: 'manual'
    });
    const loginBody = await loginRes.text();
    console.log('Login status', loginRes.status, loginBody);
    const setCookie = loginRes.headers.get('set-cookie') || loginRes.headers.get('Set-Cookie');
    console.log('set-cookie header:', setCookie?.slice?.(0,200));
    const cookie = setCookie ? setCookie.split(';')[0] : null;
    if(!cookie){ console.error('No cookie from login, cannot call admin API'); process.exit(1); }

    const svcRes = await fetch('http://localhost:3002/api/admin/services', { headers: { cookie } });
    const svcBody = await svcRes.text();
    console.log('Services status', svcRes.status);
    console.log(svcBody.slice(0,500));
  }catch(e){ console.error(e); process.exit(1); }
})();
