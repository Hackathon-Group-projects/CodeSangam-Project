import { createHash } from 'node:crypto';

/** JSON values accepted by PostgreSQL's Json/JsonB fields. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface HashChainInput {
  prevHash: string; // H_{n-1}; 64 zeroes for the genesis entry
  seq: number;
  ticketId: string;
  actorRef: string; // Account ID or per-ticket HMAC pseudonym
  type: string;
  payload: JsonValue;
  timestamp: string | Date;
}

/** The previous-hash value used by each ticket's sequence-zero entry. */
export const GENESIS_HASH = '0'.repeat(64);

/**
 * Serialize JSON deterministically by sorting object keys recursively.
 * Rejecting non-JSON JavaScript values prevents different callers from
 * silently hashing different representations of the same input.
 */
export function canonicalJSON(value: JsonValue): string {
  return serializeJson(value, new WeakSet<object>());
}

function serializeJson(value: unknown, ancestors: WeakSet<object>): string {
  if (value === null) return 'null';

  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value) as string;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Canonical JSON does not support non-finite numbers');
    }
    return JSON.stringify(value) as string;
  }

  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw new TypeError('Canonical JSON does not support circular values');
    }

    ancestors.add(value);
    // Array.from visits sparse slots as undefined so they are rejected instead
    // of colliding with an empty array during canonicalization.
    const serialized = `[${Array.from(value, (item) => serializeJson(item, ancestors)).join(',')}]`;
    ancestors.delete(value);
    return serialized;
  }

  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Canonical JSON accepts only plain JSON objects');
    }

    if (ancestors.has(value)) {
      throw new TypeError('Canonical JSON does not support circular values');
    }

    ancestors.add(value);
    const sortedKeys = Object.keys(value).sort();
    const pairs = sortedKeys.map(
      (key) => `${JSON.stringify(key)}:${serializeJson((value as Record<string, unknown>)[key], ancestors)}`
    );
    ancestors.delete(value);
    return `{${pairs.join(',')}}`;
  }

  // This branch also protects JavaScript callers that bypass the TypeScript type.
  throw new TypeError('Canonical JSON accepts only JSON-compatible values');
}

/**
 * Compute the blueprint's chain value:
 * SHA-256(prevHash || seq || ticketId || actorRef || type ||
 *         canonicalJSON(payload) || timestamp)
 */
export function computeAuditHash(input: HashChainInput): string {
  if (!Number.isSafeInteger(input.seq) || input.seq < 0) {
    throw new RangeError('Audit sequence must be a non-negative safe integer');
  }

  if (!/^[0-9a-f]{64}$/.test(input.prevHash)) {
    throw new TypeError('Previous hash must be a lowercase 64-character SHA-256 hex value');
  }

  if (!input.ticketId || !input.actorRef || !input.type) {
    throw new TypeError('ticketId, actorRef, and type must be non-empty strings');
  }

  const timestamp =
    typeof input.timestamp === 'string'
      ? input.timestamp
      : input.timestamp.toISOString();

  if (!timestamp.trim() || !Number.isFinite(Date.parse(timestamp))) {
    throw new TypeError('Audit timestamp must be a valid ISO timestamp');
  }

  const canonicalPayload = canonicalJSON(input.payload);
  const source = [
    input.prevHash,
    String(input.seq),
    input.ticketId,
    input.actorRef,
    input.type,
    canonicalPayload,
    timestamp
  ].join('||');

  return createHash('sha256').update(source, 'utf8').digest('hex');
}
