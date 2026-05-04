import { spawn } from 'child_process';
import { logger } from '../../observability/logger';
import path from 'path';
import fs from 'fs';

export async function extractThumbnail(
  inputPath: string,
  outputPath: string,
  timeInSeconds: number = 5
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Garantir que a directoria de saída existe
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // ffmpeg -ss [time] -i [input] -frames:v 1 -q:v 2 [output]
    // -q:v 2 define alta qualidade para o JPEG
    const args = [
      '-ss', timeInSeconds.toString(),
      '-i', inputPath,
      '-frames:v', '1',
      '-q:v', '2',
      '-y', // Sobrescrever se existir
      outputPath
    ];

    logger.debug({ inputPath, outputPath, timeInSeconds }, 'A extrair thumbnail com FFmpeg');

    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'Thumbnail extraída com sucesso');
        resolve();
      } else {
        logger.error({ code, stderr }, 'Erro FFmpeg ao extrair thumbnail');
        // Tentar extrair aos 0 segundos se aos 5 falhar (vídeo muito curto?)
        if (timeInSeconds > 0) {
           extractThumbnail(inputPath, outputPath, 0)
             .then(resolve)
             .catch(reject);
        } else {
          reject(new Error(`FFmpeg exit code ${code}: ${stderr}`));
        }
      }
    });

    ffmpeg.on('error', (err) => {
      logger.error({ err }, 'Falha fatal ao iniciar FFmpeg para thumbnail');
      reject(err);
    });
  });
}
