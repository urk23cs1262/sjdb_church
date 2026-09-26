async function checkProduction() {
  console.log('--- Probing Vercel Frontend ---');
  try {
    const res = await fetch('https://st-jb-church.vercel.app/');
    const html = await res.text();
    const hasGuard = html.includes('Vite Deployment Guard');
    const scriptMatches = html.match(/src="\/assets\/[^"]+"/g);
    console.log('Vercel Guard Present:', hasGuard);
    console.log('Vercel Current Bundle Scripts:', scriptMatches);
  } catch (e) {
    console.error('Vercel probe error:', e.message);
  }

  console.log('\n--- Probing Render Backend ---');
  try {
    const healthRes = await fetch('https://st-jb-church.onrender.com/api/health');
    const health = await healthRes.json();
    console.log('Render Health:', {
      uptimeSeconds: health.uptimeSeconds,
      lastWarmedAt: health.cache?.lastWarmedAt
    });
  } catch (e) {
    console.error('Render health error:', e.message);
  }

  try {
    const saintRes = await fetch('https://st-jb-church.onrender.com/api/saint-of-the-day');
    const saint = await saintRes.json();
    console.log('Render Saint:', {
      saintName: saint.saintName,
      feastTitle: saint.feastTitle,
      image: saint.image,
      lastSynced: saint.saint?.lastSynced
    });
  } catch (e) {
    console.error('Render saint error:', e.message);
  }
}

checkProduction();
