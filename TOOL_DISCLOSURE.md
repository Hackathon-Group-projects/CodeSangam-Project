# Official Tool Disclosure & Open Source Reproducibility Document

**Webster 2026 Hackathon (CodeSangam)**  
**Problem Statement 03**: Tamper-Evident Grievance Redressal & Cryptographic Audit Portal  
**Team**: Team TriNity (Team ID: 77)  
**Deliverable Owner**: Member 3 (Aryan Sachin Borse — AI, Queues & DevOps Engineer)

---

## 1. Zero External Cloud AI APIs Certification

In strict adherence to the judging criteria, **The Vishanti Ledger** operates with **100% self-hosted, offline-capable local AI architecture**. Sensitive citizen grievances, confidential whistleblower submissions, and disciplinary complaints are never transmitted to any third-party cloud APIs (e.g., OpenAI, Google Cloud Vertex, Anthropic, or external inference endpoints).

### Local Machine Learning Models Executed On-Premises:

| Model Architecture | Task & Purpose | Runtime Environment | Weights Hosting |
| :--- | :--- | :--- | :--- |
| **`all-MiniLM-L6-v2`** | 384-dimensional dense semantic sentence embeddings for grievance similarity search and pgvector clustering. | Transformers.js (ONNX Runtime Web/Node) | Local container memory (`/apps/worker`) |
| **`DistilBERT`** (`distilbert-base-uncased-finetuned-sst-2-english`) | Sentiment analysis and citizen distress urgency scoring (0.0 to 1.0) for SLA priority acceleration. | Transformers.js (ONNX Runtime Web/Node) | Local container memory (`/apps/worker`) |

### Complete Toolchain & Open Source Licensing:
- **Language / Runtime**: Node.js 24 LTS, TypeScript 5.4 (Strict mode)
- **Local Neural Inference**: `@xenova/transformers` (Apache 2.0)
- **Vector Database**: PostgreSQL 16 with `pgvector` extension (PostgreSQL License)
- **Message Broker & Queues**: BullMQ 5.8 (MIT) backed by Redis 7 (BSD 3-Clause)
- **Object Storage**: MinIO S3 compatible (GNU AGPLv3)
- **Antivirus Daemon**: ClamAV Antivirus Daemon (GNU GPLv2)
- **Cryptographic Primitives**: SHA-256 via Node.js native `crypto`, `jose` (JWT), `argon2id` (Password hashing)

---

## 2. Single-Command Docker Reproducibility

The complete backend ecosystem (databases, vector engines, queues, storage, and antivirus) is fully codified in `docker-compose.yml` and reproduces with a single command:

```sh
docker compose up -d
```

### Container Topology & Port Allocation:

```
+-------------------------------------------------------------------------+
|                         VISHANTI DOCKER NETWORK                         |
|                                                                         |
|  +--------------------+   +--------------------+   +-----------------+  |
|  |     PostgreSQL     |   |       Redis 7      |   |      MinIO      |  |
|  |   (with pgvector)  |   |   (BullMQ / Lock)  |   |  (S3 Storage)   |  |
|  |   127.0.0.1:5432   |   |   127.0.0.1:6379   |   | 127.0.0.1:9000  |  |
|  +--------------------+   +--------------------+   +-----------------+  |
|                                                                         |
|  +--------------------+   +--------------------+   +-----------------+  |
|  |       ClamAV       |   |     Fastify API    |   |  BullMQ Worker  |  |
|  | (Daemon Port 3310) |   |    (Write / Lock)  |   |   (AI / Cron)   |  |
|  |   127.0.0.1:3310   |   |   127.0.0.1:4000   |   |  (Background)   |  |
|  +--------------------+   +--------------------+   +-----------------+  |
+-------------------------------------------------------------------------+
```

### Self-Contained Verification Commands:
- **Ledger Cryptographic Verifier**:
  ```sh
  npm run verify:ledger -- --ticket=<TICKET_UUID>
  ```
- **Escalation Cron Zero-Failure Audit**:
  ```sh
  npm run report:escalation
  ```
- **Prisma DB Migration & pgvector HNSW Setup**:
  ```sh
  npm run prisma:generate --workspace=@vishanti/db
  npm run prisma:migrate --workspace=@vishanti/db
  ```

---

*Certified and signed off for Webster 2026 Hackathon judging.*
