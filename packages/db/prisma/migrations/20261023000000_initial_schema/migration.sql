-- Initial PostgreSQL schema for The Vishanti Ledger.
-- The vector extension is provided by the pgvector/pgvector:pg16 image.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "Role" AS ENUM (
  'PETITIONER',
  'OFFICER_TIER_1',
  'COMMITTEE_TIER_2',
  'OMBUDSMAN_TIER_3',
  'AUDITOR',
  'ADMIN'
);

CREATE TYPE "Category" AS ENUM (
  'ACADEMIC',
  'HOSTEL_MESS',
  'FINANCIAL_FEES',
  'HARASSMENT_DISCIPLINARY',
  'INFRASTRUCTURE',
  'ADMINISTRATION'
);

CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "Status" AS ENUM ('FILED', 'ASSIGNED', 'IN_REVIEW', 'RESOLVED', 'ESCALATED');
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED');

CREATE TABLE public.users (
  "id" TEXT NOT NULL,
  "email" TEXT,
  "passwordHash" TEXT,
  "name" TEXT,
  "role" "Role" NOT NULL DEFAULT 'PETITIONER',
  "tier" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE public.cluster_groups (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "centroid" vector(384),
  "ticketCount" INTEGER NOT NULL DEFAULT 0,
  "avgSentiment" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cluster_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE public.sla_policies (
  "id" TEXT NOT NULL,
  "priority" "Priority" NOT NULL,
  "tier" INTEGER NOT NULL,
  "responseMins" INTEGER NOT NULL,
  "resolveMins" INTEGER NOT NULL,
  CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE public.tickets (
  "id" TEXT NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" TEXT NOT NULL,
  "category" "Category" NOT NULL,
  "priority" "Priority" NOT NULL,
  "status" "Status" NOT NULL DEFAULT 'FILED',
  "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
  "receiptHash" VARCHAR(64),
  "petitionerRef" VARCHAR(64),
  "petitionerId" TEXT,
  "currentTier" INTEGER NOT NULL DEFAULT 1,
  "version" INTEGER NOT NULL DEFAULT 1,
  "slaDueAt" TIMESTAMP(3),
  "assignedToId" TEXT,
  "clusterGroupId" TEXT,
  "embedding" vector(384),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE public.audit_entries (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "type" VARCHAR(32) NOT NULL,
  "actorRef" VARCHAR(128) NOT NULL,
  "payload" JSONB NOT NULL,
  "prevHash" VARCHAR(64) NOT NULL,
  "hash" VARCHAR(64) NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE public.attachments (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "storageKey" TEXT NOT NULL,
  "sha256Hash" VARCHAR(64) NOT NULL,
  "mimeType" VARCHAR(128) NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "scanStatus" "ScanStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON public.users("email");
CREATE UNIQUE INDEX "sla_policies_priority_key" ON public.sla_policies("priority");
CREATE UNIQUE INDEX "tickets_receiptHash_key" ON public.tickets("receiptHash");
CREATE INDEX "tickets_status_idx" ON public.tickets("status");
CREATE INDEX "tickets_category_idx" ON public.tickets("category");
CREATE INDEX "tickets_slaDueAt_idx" ON public.tickets("slaDueAt");
CREATE INDEX "tickets_petitionerId_idx" ON public.tickets("petitionerId");
CREATE UNIQUE INDEX "audit_entries_ticketId_seq_key" ON public.audit_entries("ticketId", "seq");
CREATE INDEX "audit_entries_ticketId_idx" ON public.audit_entries("ticketId");
CREATE UNIQUE INDEX "attachments_storageKey_key" ON public.attachments("storageKey");
CREATE INDEX "attachments_ticketId_idx" ON public.attachments("ticketId");

ALTER TABLE public.tickets
  ADD CONSTRAINT "tickets_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES public.users("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.tickets
  ADD CONSTRAINT "tickets_petitionerId_fkey"
  FOREIGN KEY ("petitionerId") REFERENCES public.users("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.tickets
  ADD CONSTRAINT "tickets_clusterGroupId_fkey"
  FOREIGN KEY ("clusterGroupId") REFERENCES public.cluster_groups("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.audit_entries
  ADD CONSTRAINT "audit_entries_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES public.tickets("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public.attachments
  ADD CONSTRAINT "attachments_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES public.tickets("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
