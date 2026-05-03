-- Nexora Media Processing — Row Level Security para audit_logs
-- ADR-007: audit trail append-only — UPDATE e DELETE bloqueados por RLS
-- Aplicado por: Prompt 7 — Segurança (2026-05-03)

-- 1. Activar RLS na tabela audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Policy: permitir INSERT irrestrito (qualquer utilizador pode escrever)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs' AND policyname = 'audit_insert_only'
  ) THEN
    CREATE POLICY audit_insert_only ON audit_logs
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- 3. Policy: permitir SELECT irrestrito (leitura total)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs' AND policyname = 'audit_select'
  ) THEN
    CREATE POLICY audit_select ON audit_logs
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- UPDATE e DELETE ficam bloqueados por omissão (sem policy = denied com RLS activo)
