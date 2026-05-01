# Nexora — Prisma Schema Real + Migration Inicial

> Copia estes conteúdos exactamente para os ficheiros indicados.
> O schema.prisma NÃO tem extensão .ts — é um ficheiro Prisma puro.

---

## prisma/schema.prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Asset {
  id              String      @id @default(uuid())
  originalName    String
  sha256Input     String
  sha256Output    String?
  status          AssetStatus @default(INGESTED)
  profile         String
  durationMs      Int?
  frameRate       Float?
  resolution      String?
  codec           String?
  pixelFormat     String?
  colorSpace      String?
  bitrate         Int?
  vmafScore       Float?
  loudnessLufs    Float?
  truePeakDbtp    Float?
  loudnessRange   Float?
  deliveryUrl     String?
  proxyUrl        String?
  thumbnailUrl    String?
  webhookUrl      String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  jobs            Job[]
  auditLogs       AuditLog[]
  processingSteps ProcessingStep[]

  @@index([status])
  @@index([createdAt])
  @@index([profile])
}

enum AssetStatus {
  INGESTED
  QC_PENDING
  QC_PASS
  QC_QUARANTINE
  QC_REJECT
  ANALYZING
  TRANSCODING
  AUDIO_PROCESSING
  POST_QC
  DELIVERING
  READY
  FAILED
}

model Job {
  id          String    @id @default(uuid())
  assetId     String
  type        JobType
  status      JobStatus @default(PENDING)
  attempts    Int       @default(0)
  maxAttempts Int       @default(3)
  priority    String    @default("normal")
  payload     Json?
  result      Json?
  error       String?
  errorCode   String?
  startedAt   DateTime?
  finishedAt  DateTime?
  createdAt   DateTime  @default(now())

  asset       Asset     @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@index([assetId])
  @@index([status])
  @@index([type])
}

enum JobType {
  INGEST
  QC_PRE
  ANALYZE
  TRANSCODE
  AUDIO_NORMALIZE
  SUBTITLE_PROCESS
  PROXY_GENERATE
  THUMBNAIL_GENERATE
  DRM_PACKAGE
  QC_POST
  DELIVER
}

enum JobStatus {
  PENDING
  ACTIVE
  COMPLETED
  FAILED
  CANCELLED
}

model AuditLog {
  id          String   @id @default(uuid())
  assetId     String
  eventType   String
  operator    String
  payload     Json?
  entryHash   String
  createdAt   DateTime @default(now())

  asset       Asset    @relation(fields: [assetId], references: [id])

  @@index([assetId, createdAt])
  @@index([eventType])
}

model ProcessingStep {
  id          String    @id @default(uuid())
  assetId     String
  stepName    String
  status      String    @default("pending")
  startedAt   DateTime?
  completedAt DateTime?
  metadata    Json?

  asset       Asset     @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@unique([assetId, stepName])
  @@index([assetId])
}

model Settings {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt
}
```

---

## Como criar a migration inicial

Depois de ter o Docker Compose a correr, executa:

```bash
# Criar a migration inicial (só uma vez)
npx prisma migrate dev --name init

# Em produção, aplicar migrations:
npx prisma migrate deploy

# Gerar o Prisma Client (após cada alteração ao schema):
npx prisma generate

# Ver a base de dados graficamente:
npx prisma studio
```

---

## Script SQL para audit trail append-only (opcional mas recomendado)

Após a migration, podes enforçar que a tabela audit_logs é append-only
a nível de base de dados. Cria o ficheiro `prisma/migrations/audit_rls.sql`:

```sql
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
```

Executar após a migration:
```bash
psql $DATABASE_URL -f prisma/migrations/audit_rls.sql
```

---

## Variáveis necessárias no .env para a base de dados

```bash
# Para desenvolvimento local (Docker Compose)
DATABASE_URL=postgresql://nexora:nexora_password@localhost:5432/nexora_media

# Para staging/produção — usar password segura
DATABASE_URL=postgresql://nexora:SUA_PASSWORD_SEGURA@postgres:5432/nexora_media

# Pool de ligações
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

---

## Verificar que a migration correu bem

```bash
# Ver todas as migrations aplicadas
npx prisma migrate status

# Contar registos nas tabelas principais
psql $DATABASE_URL -c "
  SELECT 
    (SELECT COUNT(*) FROM \"Asset\")    AS assets,
    (SELECT COUNT(*) FROM \"Job\")      AS jobs,
    (SELECT COUNT(*) FROM \"AuditLog\") AS audit_logs;
"
```

Deves ver algo como:
```
 assets | jobs | audit_logs
--------+------+------------
      1 |    0 |          1
```
(1 asset de seed + 1 audit log do seed)
