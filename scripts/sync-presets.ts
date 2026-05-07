// Nexora Media Processing — Sincronização de Presets para a Base de Dados
// Ficheiro: scripts/sync-presets.ts

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function sync() {
  console.log('🚀 A iniciar sincronização de presets HandBrake...');

  const presetsPath = path.join(__dirname, '../nexora-presets.json');
  if (!fs.existsSync(presetsPath)) {
    console.error('❌ Ficheiro nexora-presets.json não encontrado!');
    process.exit(1);
  }

  const rawData = fs.readFileSync(presetsPath, 'utf8');
  const dataWrapper = JSON.parse(rawData);
  const presets = dataWrapper.PresetList || [];

  let createdCount = 0;
  let updatedCount = 0;

  for (const p of presets) {
    const name = p.PresetName;
    const description = `Preset HandBrake: ${p.VideoCodec || 'H.264'} @ ${p.VideoBitrate || 'Auto'}`;
    
    // Mapear campos para o modelo EncodingProfile
    const data = {
      name,
      description,
      container: p.OutputFormat || 'mp4',
      videoCodec: p.VideoCodec || 'h264',
      audioCodec: p.AudioCodec || 'aac',
      isSystem: true,
      settings: p, // Guardar o preset completo como JSON
    };

    const existing = await prisma.encodingProfile.findUnique({
      where: { name }
    });

    if (existing) {
      await prisma.encodingProfile.update({
        where: { name },
        data
      });
      updatedCount++;
    } else {
      await prisma.encodingProfile.create({
        data
      });
      createdCount++;
    }
  }

  console.log(`✅ Sincronização concluída! Criados: ${createdCount}, Atualizados: ${updatedCount}`);
}

sync()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
