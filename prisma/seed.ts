import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("A criar dados de teste...");

  const asset = await prisma.asset.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      filename: "nexora_demo_broadcast.mp4",
      originalPath: "/media/input/nexora_demo_broadcast.mp4",
      mimeType: "video/mp4",
      size: BigInt(1073741824),
      metadata: { resolution: "1920x1080", frameRate: 25, durationMs: 3600000 }
    }
  });

  const job = await prisma.job.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      type: "TRANSCODE",
      status: "PENDING",
      payload: { profile: "broadcast_hd" },
      asset: {
        connect: { id: asset.id }
      }
    }
  });

  // Criar utilizador default
  const user = await prisma.user.upsert({
    where: { username: "user-123" },
    update: {},
    create: {
      username: "user-123",
      // Em produção, isto deve ser um hash real do bcrypt (ex: "$2b$10$...")
      password: "changeme", 
      role: "ADMIN"
    }
  });
  console.log("Utilizador criado:", user.username);

  // Criar perfis default
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
        bitrateKbps: 8000
      }
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
        bitrateKbps: 2000
      }
    }
  ];

  for (const p of profiles) {
    await prisma.encodingProfile.upsert({
      where: { name: p.name },
      update: {},
      create: p
    });
  }
  console.log("Perfis default criados");

  console.log("Asset criado:", asset.id);
  console.log("Job criado:", job.id);
  console.log("Seed concluido!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });