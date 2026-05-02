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
      path: "/media/input/nexora_demo_broadcast.mp4",
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
      type: "transcode",
      status: "pending",
      payload: { assetId: asset.id, profile: "broadcast_hd" }
    }
  });

  console.log("Asset criado:", asset.id);
  console.log("Job criado:", job.id);
  console.log("Seed concluido!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });