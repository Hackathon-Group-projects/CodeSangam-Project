import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * k6 Concurrency & SLA Stress Test for The Vishanti Ledger
 * Tests high-concurrency ticket intake and idempotency locks.
 */

export const options = {
  stages: [
    { duration: '10s', target: 20 },  // Ramp up to 20 virtual users
    { duration: '30s', target: 50 },  // Hold at 50 virtual users
    { duration: '10s', target: 0 }    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01']     // Less than 1% errors allowed
  }
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000';

export default function () {
  const vuId = __VU;
  const iterId = __ITER;
  const idempotencyKey = `k6-test-key-${vuId}-${iterId}-${Date.now()}`;

  const payload = JSON.stringify({
    title: `Concurrent Grievance Load Test VU-${vuId} Iter-${iterId}`,
    description: 'This is an automated performance stress test payload evaluating database row locks and BullMQ queuing under high load conditions.',
    category: 'INFRASTRUCTURE',
    priority: 'HIGH',
    isAnonymous: true,
    attachments: []
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    }
  };

  const res = http.post(`${BASE_URL}/api/tickets`, payload, params);

  check(res, {
    'status is 201': (r) => r.status === 201,
    'has ticket id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true && body.data.ticket.id !== undefined;
      } catch {
        return false;
      }
    }
  });

  sleep(0.5);
}
