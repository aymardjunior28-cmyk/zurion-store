'use strict';

const autocannon = require('autocannon');

const url = process.env.BENCHMARK_URL || 'http://127.0.0.1:4173';
const duration = Number(process.env.BENCHMARK_DURATION || 10);
const connections = Number(process.env.BENCHMARK_CONNECTIONS || 10);
const endpoints = ['/health', '/', '/catalogue', '/api/products'];

async function run(endpoint) {
  return new Promise((resolve, reject) => {
    const instance = autocannon({ url: `${url}${endpoint}`, duration, connections });
    instance.on('done', resolve);
    instance.on('error', reject);
  });
}

(async () => {
  console.log(`Benchmark: ${url} (${connections} connexions, ${duration}s par route)`);
  for (const endpoint of endpoints) {
    const result = await run(endpoint);
    console.log(`${endpoint}: ${result.requests.average} req/s, p99 ${result.latency.p99}ms, erreurs ${result.errors}`);
  }
})().catch((error) => {
  console.error('[benchmark] échec:', error.message);
  process.exit(1);
});
