import WebSocket from 'ws';
global.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xenohljxgogwcvugisgg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WR8_2naCb8qJXm0KBHkq5w_OHX4kcgZ';

const scorer = createClient(SUPABASE_URL, SUPABASE_KEY);
const viewer = createClient(SUPABASE_URL, SUPABASE_KEY);

const viewerChannel = viewer.channel('kapl-live-match-sync');
const scorerChannel = scorer.channel('kapl-live-match-sync');

let viewerReceivedDelta = null;

viewerChannel
  .on('broadcast', { event: 'live_score_delta' }, (envelope) => {
    console.log('⚡ Viewer received live_score_delta in realtime:', envelope.payload);
    viewerReceivedDelta = envelope.payload;
  })
  .subscribe(async (viewerStatus) => {
    console.log('Viewer status:', viewerStatus);
    if (viewerStatus === 'SUBSCRIBED') {
      scorerChannel.subscribe(async (scorerStatus) => {
        console.log('Scorer status:', scorerStatus);
        if (scorerStatus === 'SUBSCRIBED') {
          console.log('Scorer scoring ball: 4 runs...');
          const sendRes = await scorerChannel.send({
            type: 'broadcast',
            event: 'live_score_delta',
            payload: {
              currentMatch: {
                id: 'match-101',
                status: 'live',
                innings1: { runs: 25, wickets: 1, currentOver: 1, currentBall: 2 }
              },
              lastAction: { type: 'addBall' },
              timestamp: Date.now()
            }
          });
          console.log('Scorer send status:', sendRes);
        }
      });
    }
  });

setTimeout(() => {
  console.log('Verification finished. Viewer got update:', viewerReceivedDelta !== null);
  process.exit(viewerReceivedDelta ? 0 : 1);
}, 5000);

