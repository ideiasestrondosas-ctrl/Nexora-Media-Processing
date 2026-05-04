import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("A executar seed de configuração...");

  // ── Utilizador administrador por defeito ──────────────────────────
  const user = await prisma.user.upsert({
    where: { username: "user-123" },
    update: {},
    create: {
      username: "user-123",
      password: "changeme",
      role: "ADMIN",
    },
  });
  console.log("✓ Utilizador:", user.username);

  // ── Perfis de encoding ────────────────────────────────────────────
  const profiles = [
    {
      id: "00000000-0000-0000-0000-000000000010",
      name: "nexora_broadcast_hd",
      description: "Broadcast television — conformidade máxima EBU/SMPTE",
      container: "mp4",
      videoCodec: "h264",
      audioCodec: "pcm_s24le",
      isDefault: true,
      settings: {
        preset: "slow",
        profile: "high",
        level: "4.1",
        bitrateKbps: 8000,
      },
    },
    {
      id: "00000000-0000-0000-0000-000000000011",
      name: "nexora_web_sd",
      description: "Streaming web — compatibilidade máxima browsers",
      container: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      isDefault: false,
      settings: {
        preset: "fast",
        profile: "main",
        level: "3.1",
        bitrateKbps: 2000,
      },
    },
  ];

  for (const p of profiles) {
    await prisma.encodingProfile.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    });
  }
  console.log("✓ Perfis de encoding criados/actualizados");

  // ── Remover asset e job fictícios criados por seeds anteriores ────
  const demoAssetId = "00000000-0000-0000-0000-000000000001";
  const demoJobId   = "00000000-0000-0000-0000-000000000002";

  const demoJob = await prisma.job.findUnique({ where: { id: demoJobId } });
  if (demoJob) {
    await prisma.job.delete({ where: { id: demoJobId } });
    console.log("✓ Job fictício removido");
  }

  const demoAsset = await prisma.asset.findUnique({ where: { id: demoAssetId } });
  if (demoAsset) {
    await prisma.asset.delete({ where: { id: demoAssetId } });
    console.log("✓ Asset fictício removido");
  }

  console.log("Seed concluído!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });