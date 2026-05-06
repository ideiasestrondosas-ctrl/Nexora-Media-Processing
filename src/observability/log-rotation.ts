import * as fs from 'fs';
import * as path from 'path';
import { readConfig } from '../api/routes/settings';
import { logger } from './logger';

export class LogRotationManager {
  private logDir: string;
  private logFile: string;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, 'nexora.log');
    
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Verifica se o log atual excede o limite e rotaciona se necessário.
   */
  public async checkAndRotate(): Promise<void> {
    try {
      if (!fs.existsSync(this.logFile)) return;

      const config = readConfig();
      const stats = fs.statSync(this.logFile);
      const sizeMB = stats.size / (1024 * 1024);

      if (sizeMB >= config.logRotationSizeMB) {
        logger.info({ sizeMB, limit: config.logRotationSizeMB }, 'A iniciar rotação de logs por tamanho');
        this.rotate(config.logRotationCount);
      }
    } catch (err) {
      console.error('Erro na rotação de logs:', err);
    }
  }

  private rotate(maxFiles: number): void {
    // 1. Apagar o ficheiro mais antigo (ex: nexora.log.5)
    const oldest = path.join(this.logDir, `nexora.log.${maxFiles}`);
    if (fs.existsSync(oldest)) {
      fs.unlinkSync(oldest);
    }

    // 2. Renomear ficheiros existentes (4 -> 5, 3 -> 4, etc.)
    for (let i = maxFiles - 1; i >= 1; i--) {
      const current = path.join(this.logDir, `nexora.log.${i}`);
      const next = path.join(this.logDir, `nexora.log.${i + 1}`);
      if (fs.existsSync(current)) {
        fs.renameSync(current, next);
      }
    }

    // 3. Renomear o log actual para .1
    if (fs.existsSync(this.logFile)) {
      fs.renameSync(this.logFile, path.join(this.logDir, 'nexora.log.1'));
    }

    // 4. Criar novo ficheiro vazio (opcional, o logger criará se necessário)
    fs.writeFileSync(this.logFile, '', 'utf-8');
  }

  /** Inicia monitorização periódica */
  public start(intervalMs = 60000): void {
    setInterval(() => this.checkAndRotate(), intervalMs);
    logger.info({ intervalMs }, 'LogRotationManager iniciado');
  }
}

export const logRotationManager = new LogRotationManager();
