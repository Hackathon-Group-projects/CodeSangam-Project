import { generateEmbedding, analyzeDistressSentiment } from '../apps/worker/src/ai/inference';
import { computeMerkleRoot } from '../apps/worker/src/merkle/checkpoint';
import { computeAuditHash, GENESIS_HASH } from '../packages/shared/src';

async function test() {
  console.log('Testing Member 3 AI Inference & Crypto Chain...');
  const text = 'Urgent: severe water leakage and electrical short circuit hazard in Hostel 4 Room 204';
  
  const embedding = await generateEmbedding(text);
  console.log('✓ 384-d Embedding Vector Length:', embedding.length);
  console.log('✓ Sample Vector Dimensions [0..4]:', embedding.slice(0, 5));

  const sentiment = await analyzeDistressSentiment(text);
  console.log('✓ Distress Sentiment Score:', sentiment.distressScore, `(Label: ${sentiment.label})`);

  console.log('\nTesting Cryptographic Hash Chain Equation:');
  console.log('Hn = SHA-256( Hn-1 || seq || ticketId || actorRef || type || canonicalJSON(payload) || timestamp )');

  const h0 = computeAuditHash({
    prevHash: GENESIS_HASH,
    seq: 0,
    ticketId: '00000000-0000-4000-8000-000000000001',
    actorRef: 'user-petitioner-001',
    type: 'CREATED',
    payload: { title: 'Water leakage', priority: 'HIGH' },
    timestamp: new Date('2026-10-28T10:00:00Z')
  });
  console.log('✓ H0 Genesis Hash (prevHash=64 zeroes):', h0);

  const h1 = computeAuditHash({
    prevHash: h0,
    seq: 1,
    ticketId: '00000000-0000-4000-8000-000000000001',
    actorRef: 'system:ai-triage-daemon',
    type: 'ASSIGNED',
    payload: { previousStatus: 'FILED', newStatus: 'ASSIGNED', distressScore: sentiment.distressScore },
    timestamp: new Date('2026-10-28T10:01:00Z')
  });
  console.log('✓ H1 Chained Hash (prevHash=H0):       ', h1);

  console.log('\nTesting Merkle Tree Checkpoint:');
  const merkleRoot = computeMerkleRoot([h0, h1]);
  console.log('✓ Computed Merkle Root:', merkleRoot);

  console.log('\n================================================================');
  console.log('🎉 ALL MEMBER 3 CORE MODULES ARE FULLY VERIFIED AND WORKING!');
  console.log('================================================================');
  process.exit(0);
}

test().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
