import { parseFrame, encodeFrame, pingFrame } from '../../shared/src/protocol';

const usage = `
Usage: bun run scripts/ws-probe.ts <wss-url> <token> [--expect-reject]

Connects to the Vole WS control plane and verifies the frame protocol:
  - HELLO -> READY
  - PING  -> PONG (twice), then exits 0
  - --expect-reject: token must be rejected (WS closes within 5s), exits 0 if so
`;

const url = process.argv[2];
const token = process.argv[3];
const expectReject = process.argv.includes('--expect-reject');

if (!url || !token) {
  console.log(usage);
  process.exit(2);
}

const ws = new WebSocket(`${url.replace(/^http/, 'ws')}?token=${encodeURIComponent(token)}`);
let pongs = 0;
const timer = setTimeout(() => {
  console.error('TIMEOUT: no expected traffic');
  process.exit(1);
}, 30_000);

ws.onopen = () => {
  if (expectReject) {
    setTimeout(() => {
      console.error('FAIL: connection accepted despite --expect-reject');
      process.exit(1);
    }, 5000);
    return;
  }
  console.log('OPEN, sending HELLO');
  ws.send(encodeFrame('hello', 'probe-hello', { version: 1 }));
};

ws.onmessage = (ev: any) => {
  const frame = parseFrame(String(ev.data));
  console.log('FRAME:', JSON.stringify(frame));
  if (frame.t === 'ready') {
    const ping = pingFrame();
    console.log('READY received, sending PING', ping.id);
    ws.send(encodeFrame(ping.t, ping.id));
  } else if (frame.t === 'pong') {
    pongs += 1;
    if (pongs >= 2) {
      clearTimeout(timer);
      console.log('2 PONGs received — PASS');
      ws.close();
      process.exit(0);
    }
    const ping = pingFrame();
    ws.send(encodeFrame(ping.t, ping.id));
  }
};

ws.onclose = () => {
  if (expectReject) {
    clearTimeout(timer);
    console.log('Connection closed as expected — PASS');
    process.exit(0);
  }
  console.error('FAIL: connection closed unexpectedly');
  process.exit(1);
};

ws.onerror = (err: any) => {
  console.error('WS error', err?.message ?? err);
  if (!expectReject) {
    clearTimeout(timer);
    process.exit(1);
  }
};
