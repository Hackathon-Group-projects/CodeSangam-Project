-- Give the runtime role normal application access while keeping migration
-- metadata and the tamper-evident audit ledger protected.
GRANT USAGE ON SCHEMA public TO app_user;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.users,
            public.cluster_groups,
            public.sla_policies,
            public.tickets,
            public.attachments
  TO app_user;

-- The audit ledger is append-only, so its runtime role can only read or append.
GRANT SELECT, INSERT ON TABLE public.audit_entries TO app_user;

GRANT USAGE, SELECT, UPDATE
  ON ALL SEQUENCES IN SCHEMA public
  TO app_user;

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_entries FROM app_user;

-- New application tables created by the migration owner inherit the same
-- runtime permissions. Audit entries remain restricted by the migration above.
ALTER DEFAULT PRIVILEGES FOR ROLE vishanti_admin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE vishanti_admin IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO app_user;
