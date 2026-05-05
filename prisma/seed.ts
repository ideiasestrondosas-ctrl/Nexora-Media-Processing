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
      name: "Broadcast HD (EBU R128)",
      description: "Alta qualidade para TV — conformidade SMPTE/EBU",
      container: "mp4",
      videoCodec: "h264",
      audioCodec: "pcm_s24le",
      isDefault: true,
      isSystem: true,
      settings: {
        preset: "slow",
        profile: "high",
        level: "4.1",
        bitrateKbps: 8000,
        gop: 25,
      },
    },
    {
      id: "00000000-0000-0000-0000-000000000011",
      name: "Web HD 1080p",
      description: "Ideal para YouTube/Vimeo em alta resolução",
      container: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      isDefault: false,
      isSystem: true,
      settings: {
        preset: "medium",
        profile: "main",
        level: "4.0",
        bitrateKbps: 5000,
      },
    },
    {
      id: "00000000-0000-0000-0000-000000000012",
      name: "Mobile SD 480p",
      description: "Baixo consumo de dados para redes móveis",
      container: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      isDefault: false,
      isSystem: true,
      settings: {
        preset: "fast",
        profile: "baseline",
        level: "3.0",
        bitrateKbps: 800,
      },
    },
    {
      id: "00000000-0000-0000-0000-000000000013",
      name: "4K UHD Professional",
      description: "Máxima fidelidade visual para grandes ecrãs",
      container: "mp4",
      videoCodec: "hevc",
      audioCodec: "aac",
      isDefault: false,
      isSystem: true,
      settings: {
        preset: "slow",
        bitrateKbps: 25000,
      },
    },
    {
      id: "00000000-0000-0000-0000-000000000014",
      name: "Proxy Editing",
      description: "Baixa resolução para edição offline ultra rápida",
      container: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      isDefault: false,
      isSystem: true,
      settings: {
        preset: "ultrafast",
        bitrateKbps: 400,
        resolution: "640x360",
      },
    },
  ];

  for (const p of profiles) {
    await prisma.encodingProfile.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        description: p.description,
        container: p.container,
        videoCodec: p.videoCodec,
        audioCodec: p.audioCodec,
        isSystem: p.isSystem,
        settings: p.settings,
      },
      create: p,
    });
  }
  console.log("✓ Perfis de encoding (Standard) criados/actualizados");

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