import WebSocket from 'ws';
global.WebSocket = WebSocket;

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://xenohljxgogwcvugisgg.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_WR8_2naCb8qJXm0KBHkq5w_OHX4kcgZ';

const CONCURRENT_CLIENTS = 100;
const CHANNEL_NAME = `cricket-load-test-${Date.now()}`;
const TEST_ROUNDS = 3;

console.log('================================================================');
console.log('🏏 KAPL 3.0 Realtime Concurrency Benchmark (100 Clients)');
console.log(`Endpoint: ${SUPABASE_URL}`);
console.log(`Target: ${CONCURRENT_CLIENTS} concurrent WebSocket connections`);
console.log('================================================================\n');

async function runBenchmark() {
  const clients = [];
  const channels = [];
  const connectionTimes = [];
  
  console.log(`[1/3] Establishing ${CONCURRENT_CLIENTS} simultaneous WebSocket connections...`);
  const connStartTime = Date.now();

  const connectPromises = Array.from({ length: CONCURRENT_CLIENTS }, async (_, idx) => {
    const clientStartTime = Date.now();
    const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: {
        heartbeatIntervalMs: 15000,
      },
    });
    clients.push(client);

    return new Promise((resolve) => {
      const channel = client.channel(CHANNEL_NAME);
      channels.push(channel);

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          connectionTimes.push(Date.now() - clientStartTime);
          resolve(true);
        }
      });
    });
  });

  await Promise.all(connectPromises);
  const totalConnTime = Date.now() - connStartTime;
  const avgConnTime = Math.round(connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length);
  
  console.log(`✅ All ${CONCURRENT_CLIENTS} clients connected in ${totalConnTime}ms (avg handshake: ${avgConnTime}ms)\n`);

  console.log(`[2/3] Simulating live match scoring broadcast across all ${CONCURRENT_CLIENTS} subscribers...`);

  // Broadcaster client (e.g. Scorer)
  const broadcastChannel = channels[0];
  const roundLatencies = [];

  for (let round = 1; round <= TEST_ROUNDS; round++) {
    // Settle pause between deliveries
    await new Promise((r) => setTimeout(r, 400));

    const roundPromise = new Promise((resolve) => {
      const receivedLatencies = [];
      const testBallPayload = {
        ballNumber: round,
        runs: round === 1 ? 4 : round === 2 ? 6 : 1,
        score: `84/${round}`,
        timestamp: Date.now(),
      };

      // Set up listeners on all clients
      channels.forEach((ch) => {
        ch.on('broadcast', { event: `test_event_round_${round}` }, (envelope) => {
          const receiveTime = Date.now();
          const latency = receiveTime - envelope.payload.timestamp;
          receivedLatencies.push(latency);

          if (receivedLatencies.length === CONCURRENT_CLIENTS) {
            resolve(receivedLatencies);
          }
        });
      });

      // Transmit broadcast
      setTimeout(() => {
        broadcastChannel.send({
          type: 'broadcast',
          event: `test_event_round_${round}`,
          payload: testBallPayload,
        });
      }, 50);

      // Safety timeout
      setTimeout(() => {
        if (receivedLatencies.length < CONCURRENT_CLIENTS) {
          resolve(receivedLatencies);
        }
      }, 3500);
    });

    const latencies = await roundPromise;
    roundLatencies.push(...latencies);

    const roundAvg = latencies.length > 0 
      ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1) 
      : '0';
    console.log(`   Ball #${round} event received by ${latencies.length}/${CONCURRENT_CLIENTS} clients (Avg latency: ${roundAvg}ms)`);
  }

  console.log('\n[3/3] Compiling Performance Metrics...');
  
  if (roundLatencies.length > 0) {
    roundLatencies.sort((a, b) => a - b);
    const minLatency = roundLatencies[0];
    const maxLatency = roundLatencies[roundLatencies.length - 1];
    const avgLatency = (roundLatencies.reduce((a, b) => a + b, 0) / roundLatencies.length).toFixed(1);
    const p95Latency = roundLatencies[Math.floor(roundLatencies.length * 0.95)];
    const p99Latency = roundLatencies[Math.floor(roundLatencies.length * 0.99)];
    const deliveryRate = ((roundLatencies.length / (CONCURRENT_CLIENTS * TEST_ROUNDS)) * 100).toFixed(1);

    console.log('\n================================================================');
    console.log('📊 BENCHMARK TEST RESULTS:');
    console.log(`• Active WebSocket Clients:   ${CONCURRENT_CLIENTS}`);
    console.log(`• Total Delivered Messages:   ${roundLatencies.length} / ${CONCURRENT_CLIENTS * TEST_ROUNDS}`);
    console.log(`• Packet Delivery Rate:       ${deliveryRate}%`);
    console.log(`• Min Latency:                ${minLatency} ms`);
    console.log(`• Average Latency:            ${avgLatency} ms`);
    console.log(`• p95 Latency:                ${p95Latency} ms`);
    console.log(`• p99 Latency:                ${p99Latency} ms`);
    console.log(`• Max Latency:                ${maxLatency} ms`);
    console.log(`• Target:                     < 250 ms`);
    console.log(`• Status:                     ${Number(avgLatency) < 250 ? '✅ PASSED (< 250ms target met)' : '⚠️ WARNING'}`);
    console.log('================================================================\n');
  }

  // Teardown connections
  console.log('Cleaning up 100 benchmark connections...');
  channels.forEach((ch) => {
    try { ch.unsubscribe(); } catch (_) {}
  });
  console.log('Benchmark completed successfully.\n');
  process.exit(0);
}

runBenchmark().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});

