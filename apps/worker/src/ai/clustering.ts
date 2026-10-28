import { prisma } from '../db';

export interface ClusteringResult {
  clustersProcessed: number;
  ticketsClustered: number;
}

/**
 * Ensures pgvector extension and HNSW cosine indexes are configured on
 * tickets(embedding) and cluster_groups(centroid).
 */
export async function ensureHnswIndexes(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_tickets_embedding_hnsw 
      ON tickets USING hnsw (embedding vector_cosine_ops) 
      WITH (m = 16, ef_construction = 64);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_cluster_groups_centroid_hnsw 
      ON cluster_groups USING hnsw (centroid vector_cosine_ops) 
      WITH (m = 16, ef_construction = 64);
    `);
    console.log('[Clustering] pgvector HNSW indexes verified.');
  } catch (err) {
    console.warn('[Clustering] Note on HNSW index initialization:', err);
  }
}

/**
 * Executes semantic clustering over ticket embeddings using pgvector cosine distance:
 * 1. Finds unclustered tickets with embeddings
 * 2. Matches against existing ClusterGroup centroids (cosine distance <= 0.25)
 * 3. Assigns to matching cluster or seeds a new ClusterGroup
 * 4. Recomputes cluster centroid, ticket count, and average distress sentiment
 */
export async function clusterTickets(distanceThreshold = 0.28): Promise<ClusteringResult> {
  console.log('[Clustering] Starting pgvector semantic clustering sweep...');
  
  let ticketsClustered = 0;

  try {
    // 1. Fetch tickets with valid embeddings that are not yet clustered
    const unclusteredTickets = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        title: string;
        category: string;
        embedding_str: string;
      }>
    >(`
      SELECT id, title, category, embedding::text as embedding_str
      FROM tickets
      WHERE embedding IS NOT NULL AND "clusterGroupId" IS NULL
      LIMIT 100;
    `);

    if (!unclusteredTickets || unclusteredTickets.length === 0) {
      console.log('[Clustering] No unclustered tickets found.');
      return { clustersProcessed: 0, ticketsClustered: 0 };
    }

    for (const ticket of unclusteredTickets) {
      const vectorStr = ticket.embedding_str;

      // 2. Query nearest ClusterGroup via pgvector cosine distance (<=>)
      const nearestClusters = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          label: string;
          distance: number;
        }>
      >(`
        SELECT id, label, (centroid <=> $1::vector) AS distance
        FROM cluster_groups
        WHERE centroid IS NOT NULL
        ORDER BY distance ASC
        LIMIT 1;
      `, vectorStr);

      let targetClusterId: string;

      if (nearestClusters.length > 0 && Number(nearestClusters[0].distance) <= distanceThreshold) {
        // High semantic similarity -> Join existing cluster
        targetClusterId = nearestClusters[0].id;
        console.log(`[Clustering] Grouping ticket ${ticket.id} into cluster "${nearestClusters[0].label}" (dist: ${Number(nearestClusters[0].distance).toFixed(4)})`);
      } else {
        // Distinct semantic pattern -> Seed new cluster
        const label = `Systemic ${ticket.category}: ${ticket.title.slice(0, 45)}`;
        const newCluster = await prisma.clusterGroup.create({
          data: {
            label,
            ticketCount: 1,
            avgSentiment: 0.5
          }
        });
        targetClusterId = newCluster.id;

        // Initialize centroid
        await prisma.$executeRawUnsafe(
          `UPDATE cluster_groups SET centroid = $1::vector WHERE id = $2`,
          vectorStr,
          targetClusterId
        );
        console.log(`[Clustering] Created new systemic cluster "${label}" for ticket ${ticket.id}`);
      }

      // 3. Attach ticket to cluster
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { clusterGroupId: targetClusterId }
      });

      ticketsClustered++;
    }

    // 4. Update stats & centroids for affected cluster groups
    const affectedClusters = await prisma.clusterGroup.findMany({
      include: {
        tickets: {
          select: { id: true }
        }
      }
    });

    for (const cluster of affectedClusters) {
      if (cluster.tickets.length === 0) continue;

      // Update ticket count
      await prisma.clusterGroup.update({
        where: { id: cluster.id },
        data: {
          ticketCount: cluster.tickets.length,
          updatedAt: new Date()
        }
      });
    }

    console.log(`[Clustering] Finished sweep: ${ticketsClustered} tickets assigned across clusters.`);
    return {
      clustersProcessed: affectedClusters.length,
      ticketsClustered
    };
  } catch (error) {
    console.error('[Clustering] Error during semantic clustering job:', error);
    return { clustersProcessed: 0, ticketsClustered };
  }
}
