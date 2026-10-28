import { createHash } from 'node:crypto';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface HashChainInput {
  prevHash: string;
  seq: number;
  ticketId: string;
  actorRef: string;
  type: string;
  payload: JsonValue;
  timestamp: string | Date;
}

/** The first audit entry has no earlier entry, so it uses 64 zeroes. */
export const GENESIS_HASH = '0'.repeat(64);

/** Sort object keys so equivalent JSON data always produces the exact same text. */
export function canonicalJSON(value: JsonValue): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError('JSON numbers must be finite');
    }
    const result = JSON.stringify(value);
    if (result === undefined) throw new TypeError('Value is not valid JSON');
    return result;
  }

  if (Array.isArray(value)) {
    return `[${Array.from(value, (item) => canonicalJSON(item)).join(',')}]`;
  }

  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`);
  return `{${entries.join(',')}}`;
}

/**
 * Hash this entry's fields, including the previous entry's hash.
 * Hn = SHA-256( Hn-1 || seq || ticketId || actorRef || type || canonicalJSON(payload) || timestamp )
 */
export function computeAuditHash(input: HashChainInput): string {
  if (!Number.isSafeInteger(input.seq) || input.seq < 0) {
    throw new RangeError('Audit sequence must be a non-negative integer');
  }

  if (!/^[0-9a-f]{64}$/.test(input.prevHash)) {
    throw new TypeError('Previous hash must be a 64-character SHA-256 hex value');
  }

  if (!input.ticketId || !input.actorRef || !input.type) {
    throw new TypeError('ticketId, actorRef, and type are required');
  }

  const timestamp =
    input.timestamp instanceof Date ? input.timestamp.toISOString() : input.timestamp;

  if (!timestamp.trim() || !Number.isFinite(Date.parse(timestamp))) {
    throw new TypeError('Timestamp must be a valid date');
  }

  const source = [
    input.prevHash,
    input.seq,
    input.ticketId,
    input.actorRef,
    input.type,
    canonicalJSON(input.payload),
    timestamp
  ].join('||');

  return createHash('sha256').update(source, 'utf8').digest('hex');
}
