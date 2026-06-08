// k6 load test for the dashboard endpoint.
//
// Prereqs: have k6 installed (https://k6.io). Run a local instance of
// the API with a known admin/user account and an access token.
//
//   API_BASE=http://localhost:3000 ACCESS_TOKEN=eyJhbGc... \
//     k6 run scripts/loadtest/dashboard.js
//
// Adjust the stages below to taste. Targets:
//   p(95) latency < 300ms
//   error rate < 1%

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // warm-up
    { duration: '1m',  target: 50 },   // ramp
    { duration: '1m',  target: 50 },   // sustain
    { duration: '30s', target: 0 },    // ramp-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
  },
};

const BASE = __ENV.API_BASE || 'http://localhost:3000';
const TOKEN = __ENV.ACCESS_TOKEN;

if (!TOKEN) {
  throw new Error('Set ACCESS_TOKEN env var before running this script');
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

export default function () {
  const r = http.get(`${BASE}/api/v1/dashboard`, { headers });
  check(r, {
    'status is 200':        (res) => res.status === 200,
    'envelope success':     (res) => res.json('success') === true,
    'totals.month present': (res) => res.json('data.totals.month') !== undefined,
  });
  sleep(1);
}
