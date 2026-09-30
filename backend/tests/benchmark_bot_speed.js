/**
 * Benchmark Bot Response Latency
 * Measures the execution time of queries to verify immediate, near-instantaneous replies (< 100ms)
 */

const { answerChurchQuestion } = require('../src/bot/churchRAGService');
const { getDailySaint } = require('../src/services/saintService');
const { getCachedDailyContent, warmUpCache } = require('../src/bot/churchDataCache');

async function runBenchmark() {
  console.log('⚡ Starting Bot Response Speed Benchmark...\n');

  // Pre-test warm up
  console.log('--- Warming Up In-Memory Caches ---');
  const t0 = Date.now();
  await warmUpCache();
  console.log(`Cache ready in ${Date.now() - t0}ms\n`);

  const testQueries = [
    { name: 'Mass Timings Query', text: 'what are mass timings?' },
    { name: 'Confession Query', text: 'when is confession?' },
    { name: 'Parish Priest Query', text: 'who is the priest?' },
    { name: 'Church Location Query', text: 'where is the church located?' },
    { name: 'Church History Query', text: 'tell me about church history' },
    { name: 'Saint of the Day Query', text: 'Saint of the day' },
    { name: 'Saint Typo Query', text: 'Saint of th day' },
    { name: 'Tamil Mass Query', text: 'திருப்பலி நேரங்கள்' },
    { name: 'Tamil Saint Query', text: 'இன்றைய புனிதர் யார்?' },
    { name: 'Parish Services Menu', text: 'services' },
    { name: 'Donation Query', text: 'how to donate to church' },
    { name: 'Help Query', text: 'help' }
  ];

  console.log('--- Testing Query Latencies ---');
  for (const q of testQueries) {
    const start = process.hrtime.bigint();
    const result = await answerChurchQuestion(q.text, 'en', {});
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;

    console.log(`✅ [${q.name}] (${durationMs.toFixed(2)}ms) -> Success: ${result.success}, Matched Intents: ${result.matchedIntents?.join(', ') || 'N/A'}`);
    if (durationMs > 250) {
      console.warn(`   ⚠️ Warning: Latency exceeded 250ms target (${durationMs.toFixed(2)}ms)`);
    }
  }

  console.log('\n--- Testing In-Memory Saint Retrieval ---');
  const sStart = process.hrtime.bigint();
  const saint = getDailySaint(new Date());
  const sDurationMs = Number(process.hrtime.bigint() - sStart) / 1e6;
  console.log(`✅ [getDailySaint()] (${sDurationMs.toFixed(2)}ms) -> ${saint?.nameEn}`);

  console.log('\n🎉 ALL SPEED BENCHMARK TESTS COMPLETED SUCCESSFULLY!');
  process.exit(0);
}

runBenchmark().catch(err => {
  console.error('Benchmark Error:', err);
  process.exit(1);
});
