-- Activar Row Level Security na tabela de audit
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- Política: apenas INSERT é permitido (sem UPDATE, sem DELETE)
CREATE POLICY audit_insert_only ON "AuditLog"
  FOR INSERT
  WITH CHECK (true);

-- Bloquear UPDATE
CREATE POLICY audit_no_update ON "AuditLog"
  FOR UPDATE
  USING (false);

-- Bloquear DELETE
CREATE POLICY audit_no_delete ON "AuditLog"
  FOR DELETE
  USING (false);

-- Permitir SELECT
CREATE POLICY audit_select_all ON "AuditLog"
  FOR SELECT
  USING (true);

-- Comentário para documentação
COMMENT ON TABLE "AuditLog" IS 
  'ADR-007: Tabela append-only. UPDATE e DELETE proibidos por RLS.';
