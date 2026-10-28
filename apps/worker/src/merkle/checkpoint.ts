import { createHash } from 'node:crypto';
import { prisma } from '../db';

export interface MerkleCheckpoint {
  merkleRoot: string;
  leafCount: number;
  timestamp: string;
}

/**
 * Computes a standard binary SHA-256 Merkle Root from an array of leaf hashes.
 */
export function computeMerkleRoot(leafHashes: string[]): string {
  if (leafHashes.length === 0) {
    return '0'.repeat(64);
  }

  let currentLevel = [...leafHashes];

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      // If odd number of leaves, duplicate the last leaf
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;

      const combined = createHash('sha256')
        .update(left + right, 'utf8')
        .digest('hex');

      nextLevel.push(combined);
    }

    currentLevel = nextLevel;
  }

  return currentLevel[0];
}

/**
 * Generates and publishes the daily Merkle Root checkpoint across all AuditEntry
 * records in the cryptographic ledger.
 */
export async function generateDailyMerkleCheckpoint(): Promise<MerkleCheckpoint> {
  console.log('[Merkle Checkpoint] Computing cryptographic Merkle Root over audit ledger...');

  const entries = await prisma.auditEntry.findMany({
    select: { hash: true },
    orderBy: { timestamp: 'asc' }
  });

  const leafHashes = entries.map((e) => e.hash);
  const merkleRoot = computeMerkleRoot(leafHashes);
  const checkpoint: MerkleCheckpoint = {
    merkleRoot,
    leafCount: leafHashes.length,
    timestamp: new Date().toISOString()
  };

  console.log(`[Merkle Checkpoint] Checkpoint Generated: Root=${merkleRoot} (${leafHashes.length} audit entries)`);
  return checkpoint;
}
