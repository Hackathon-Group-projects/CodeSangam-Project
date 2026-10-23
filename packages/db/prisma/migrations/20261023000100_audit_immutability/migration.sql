-- The runtime database role must exist before applying this hardening migration.
-- It must not own these tables or have superuser privileges.
DO $role_check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    RAISE EXCEPTION 'Create the non-superuser app_user role before applying the audit immutability migration';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user' AND rolsuper) THEN
    RAISE EXCEPTION 'app_user must not be a PostgreSQL superuser';
  END IF;
END;
$role_check$;

-- Keep status values aligned with the state machine in the application.
-- This intentionally mirrors the PostgreSQL enum to make the invariant explicit.
ALTER TABLE public.tickets
  ADD CONSTRAINT "tickets_status_check"
  CHECK ("status" IN ('FILED', 'ASSIGNED', 'IN_REVIEW', 'RESOLVED', 'ESCALATED'));

-- Anonymous tickets retain only a receipt hash and per-ticket HMAC pseudonym;
-- signed-in tickets link to an account and do not carry anonymous credentials.
ALTER TABLE public.tickets
  ADD CONSTRAINT "tickets_petitioner_identity_check"
  CHECK (
    ("isAnonymous" AND "receiptHash" IS NOT NULL AND "petitionerRef" IS NOT NULL AND "petitionerId" IS NULL)
    OR
    (NOT "isAnonymous" AND "receiptHash" IS NULL AND "petitionerRef" IS NULL AND "petitionerId" IS NOT NULL)
  ),
  ADD CONSTRAINT "tickets_receiptHash_check"
  CHECK ("receiptHash" IS NULL OR "receiptHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "tickets_petitionerRef_check"
  CHECK ("petitionerRef" IS NULL OR "petitionerRef" ~ '^[0-9a-f]{64}$');

ALTER TABLE public.tickets
  ADD CONSTRAINT "tickets_currentTier_check"
  CHECK ("currentTier" BETWEEN 1 AND 3),
  ADD CONSTRAINT "tickets_version_check"
  CHECK ("version" >= 1);

ALTER TABLE public.users
  ADD CONSTRAINT "users_tier_check"
  CHECK ("tier" BETWEEN 0 AND 3);

ALTER TABLE public.audit_entries
  ADD CONSTRAINT "audit_entries_seq_check"
  CHECK ("seq" >= 0),
  ADD CONSTRAINT "audit_entries_prevHash_check"
  CHECK ("prevHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "audit_entries_hash_check"
  CHECK ("hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE public.attachments
  ADD CONSTRAINT "attachments_sha256Hash_check"
  CHECK ("sha256Hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "attachments_fileSize_check"
  CHECK ("fileSize" BETWEEN 0 AND 10485760);

ALTER TABLE public.sla_policies
  ADD CONSTRAINT "sla_policies_tier_check"
  CHECK ("tier" BETWEEN 1 AND 3),
  ADD CONSTRAINT "sla_policies_responseMins_check"
  CHECK ("responseMins" > 0),
  ADD CONSTRAINT "sla_policies_resolveMins_check"
  CHECK ("resolveMins" > 0);

-- Trigger rejection is the database-level backstop for ordinary table owners.
CREATE OR REPLACE FUNCTION public.prevent_audit_entry_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_entries is append-only; % is not allowed', TG_OP
    USING ERRCODE = '55000';
  RETURN NULL;
END;
$$;

CREATE TRIGGER "audit_entries_block_update_delete"
BEFORE UPDATE OR DELETE ON public.audit_entries
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_entry_mutation();

-- TRUNCATE does not fire row-level triggers, so guard it separately.
CREATE TRIGGER "audit_entries_block_truncate"
BEFORE TRUNCATE ON public.audit_entries
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_audit_entry_mutation();

-- App code can read and append ledger entries, but cannot rewrite or remove them.
GRANT USAGE ON SCHEMA public TO app_user;
REVOKE CREATE ON SCHEMA public FROM app_user;
GRANT SELECT, INSERT ON TABLE public.audit_entries TO app_user;
REVOKE UPDATE, DELETE ON TABLE public.audit_entries FROM app_user;
REVOKE TRUNCATE ON TABLE public.audit_entries FROM app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_entries FROM PUBLIC;
