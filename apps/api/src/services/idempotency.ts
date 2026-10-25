import { createHash, randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { canonicalJSON, type JsonValue } from './hash-chain';
import { config } from '../config';
import { ApiError } from '../errors';

interface StoredResult {
  state: 'processing' | 'completed';
  fingerprint: string;
  owner?: string;
  statusCode?: number;
  body?: unknown;
}

export interface IdempotencyLease {
  redisKey: string;
  owner: string;
  fingerprint: string;
}

export type IdempotencyStart =
  | { replay: true; statusCode: number; body: unknown }
  | { replay: false; lease: IdempotencyLease };

export function fingerprintRequest(value: JsonValue): string {
  return createHash('sha256').update(canonicalJSON(value), 'utf8').digest('hex');
}

function parseRecord(value: string): StoredResult {
  try {
    const record = JSON.parse(value) as StoredResult;
    if ((record.state !== 'processing' && record.state !== 'completed') || !record.fingerprint) {
      throw new Error('Invalid idempotency record');
    }
    return record;
  } catch {
    throw new ApiError(503, 'Could not read the idempotency record; retry with the same key');
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function beginIdempotentRequest(
  client: Redis,
  scope: string,
  requestKey: string,
  fingerprint: string
): Promise<IdempotencyStart> {
  const keyHash = createHash('sha256').update(`${scope}:${requestKey}`).digest('hex');
  const redisKey = `vishanti:idempotency:v1:${keyHash}`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const current = await client.get(redisKey);
    if (current) {
      const record = parseRecord(current);
      if (record.fingerprint !== fingerprint) {
        throw new ApiError(409, 'This Idempotency-Key was already used with different request data');
      }
      if (record.state === 'completed') {
        return { replay: true, statusCode: record.statusCode ?? 201, body: record.body };
      }

      await wait(100);
      continue;
    }

    const owner = randomUUID();
    const record: StoredResult = { state: 'processing', fingerprint, owner };
    const created = await client.set(
      redisKey,
      JSON.stringify(record),
      'EX',
      config.idempotencyLockSeconds,
      'NX'
    );

    if (created === 'OK') {
      return { replay: false, lease: { redisKey, owner, fingerprint } };
    }
  }

  throw new ApiError(409, 'A request with this Idempotency-Key is still processing; retry shortly');
}

const finishScript = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
local record = cjson.decode(current)
if record.owner ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;

const releaseScript = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
local record = cjson.decode(current)
if record.owner ~= ARGV[1] then return 0 end
return redis.call('DEL', KEYS[1])
`;

export async function finishIdempotentRequest(
  client: Redis,
  lease: IdempotencyLease,
  statusCode: number,
  body: unknown
): Promise<void> {
  // Keep the successful response briefly so a network retry gets the same ticket and receipt.
  // The durable database record still contains only the receipt hash.
  const record: StoredResult = {
    state: 'completed',
    fingerprint: lease.fingerprint,
    statusCode,
    body
  };
  const saved = await client.eval(
    finishScript,
    1,
    lease.redisKey,
    lease.owner,
    JSON.stringify(record),
    String(config.idempotencyResultSeconds)
  );

  if (saved !== 1) throw new ApiError(503, 'Could not save the idempotency result; retry shortly');
}

export async function releaseIdempotentRequest(client: Redis, lease: IdempotencyLease): Promise<void> {
  try {
    await client.eval(releaseScript, 1, lease.redisKey, lease.owner);
  } catch {
    // The lock has a short expiry, so a Redis outage cannot block the key forever.
  }
}
