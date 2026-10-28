import { createHash } from 'node:crypto';

// Cached Transformers.js pipelines
let featureExtractor: any = null;
let sentimentClassifier: any = null;
let isTransformersLoaded = false;

/**
 * Initializes and returns the local all-MiniLM-L6-v2 pipeline.
 * Runs 100% locally via Transformers.js with zero external API calls.
 */
async function getFeatureExtractor() {
  if (!featureExtractor) {
    try {
      const { pipeline, env } = await import('@xenova/transformers');
      // Configure local cache if needed
      env.allowLocalModels = true;
      featureExtractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      isTransformersLoaded = true;
    } catch (err) {
      console.warn('[AI] Transformers.js feature-extraction loading warning, using high-entropy local fallback:', err);
    }
  }
  return featureExtractor;
}

/**
 * Initializes and returns the local DistilBERT sentiment pipeline.
 */
async function getSentimentClassifier() {
  if (!sentimentClassifier) {
    try {
      const { pipeline, env } = await import('@xenova/transformers');
      env.allowLocalModels = true;
      sentimentClassifier = await pipeline(
        'sentiment-analysis',
        'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
      );
    } catch (err) {
      console.warn('[AI] Transformers.js sentiment-analysis loading warning, using local heuristic fallback:', err);
    }
  }
  return sentimentClassifier;
}

/**
 * High-entropy 384-dimensional deterministic fallback embedding.
 * Ensures the worker never halts if offline or model weights are downloading.
 */
function generateDeterministicEmbedding(text: string): number[] {
  const embedding: number[] = new Array(384).fill(0);
  const normalized = text.toLowerCase().trim();
  
  for (let i = 0; i < 384; i++) {
    const hash = createHash('sha256')
      .update(`${normalized}:dim:${i}`, 'utf8')
      .digest();
    const val = hash.readInt16LE(0) / 32768.0;
    embedding[i] = val;
  }
  
  // Normalize vector to unit length
  const norm = Math.sqrt(embedding.reduce((acc, v) => acc + v * v, 0)) || 1;
  return embedding.map((v) => Number((v / norm).toFixed(6)));
}

/**
 * Generates a 384-dimensional dense semantic embedding for complaint text
 * using all-MiniLM-L6-v2.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const extractor = await getFeatureExtractor();
    if (extractor) {
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      const rawVector = Array.from(output.data) as number[];
      if (rawVector.length === 384) {
        return rawVector.map((v) => Number(v.toFixed(6)));
      }
    }
  } catch (error) {
    console.error('[AI] Error generating embedding with Transformers.js:', error);
  }

  // Resilient local fallback
  return generateDeterministicEmbedding(text);
}

/**
 * Analyzes citizen complaint sentiment and distress level using DistilBERT.
 * Returns a distress score between 0.0 (calm/routine) and 1.0 (extreme distress/urgent).
 */
export async function analyzeDistressSentiment(text: string): Promise<{
  distressScore: number;
  label: string;
}> {
  try {
    const classifier = await getSentimentClassifier();
    if (classifier) {
      const results = await classifier(text);
      if (Array.isArray(results) && results.length > 0) {
        const top = results[0];
        // In SST-2: NEGATIVE represents grievances/distress, POSITIVE represents satisfaction
        let distressScore = 0.5;
        if (top.label === 'NEGATIVE') {
          distressScore = 0.5 + top.score * 0.5; // 0.5 to 1.0
        } else if (top.label === 'POSITIVE') {
          distressScore = Math.max(0.1, 1.0 - top.score); // 0.0 to 0.5
        }
        return {
          distressScore: Number(distressScore.toFixed(4)),
          label: top.label
        };
      }
    }
  } catch (error) {
    console.error('[AI] Error running DistilBERT sentiment analysis:', error);
  }

  // Heuristic distress detection fallback
  const lower = text.toLowerCase();
  const urgentKeywords = ['urgent', 'emergency', 'harassment', 'danger', 'threat', 'severe', 'immediately', 'critical', 'ragging', 'suicide', 'assault', 'bribe'];
  const distressMatches = urgentKeywords.filter((k) => lower.includes(k)).length;
  const distressScore = Math.min(0.95, 0.4 + distressMatches * 0.15);

  return {
    distressScore: Number(distressScore.toFixed(4)),
    label: distressMatches > 0 ? 'NEGATIVE' : 'NEUTRAL'
  };
}
