import { createHash } from 'node:crypto';

export interface HashChainInput {
  prevHash: string; // H_{n-1}
  seq: number;
  ticketId: string;
  actorRef: string;
  type: string;
  payload: Record<string, any>;
  timestamp: string | Date;
}

/**
 * Deterministic JSON stringify ensuring key ordering is identical
 * across all platforms (Canonical JSON)
 */
export function canonicalJSON(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalJSON).join(',')}]`;
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJSON(obj[key])}`
  );
  return `{${pairs.join(',')}}`;
}

/**
 * Cryptographic Hash Chain Computation
 * H_n = SHA-256( H_{n-1} || seq || ticketId || actorRef || type || canonicalJSON(payload) || timestamp )
 */
export function computeAuditHash(input: HashChainInput): string {
  const ts = typeof input.timestamp === 'string' 
    ? input.timestamp 
    : input.timestamp.toISOString();

  const payloadStr = canonicalJSON(input.payload);
  const rawString = `${input.prevHash}||${input.seq}||${input.ticketId}||${input.actorRef}||${input.type}||${payloadStr}||${ts}`;

  return createHash('sha256').update(rawString, 'utf8').digest('hex');
}
