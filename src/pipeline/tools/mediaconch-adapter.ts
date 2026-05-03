// Nexora Media Processing — MediaConch Adapter
// Ficheiro: src/pipeline/tools/mediaconch-adapter.ts
//
// Validação de conformidade de ficheiros de media contra policies XML.
// Suporta AS-11 UK DPP, IMF, e policies custom.
//
// ADR-002: execFile com array — nunca string concatenada.

import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';
import { logger } from '../../observability/logger';
import { mediaconchValidations } from '../../observability/metrics';
import { toolRegistry } from './availability-checker';
import { MediaConchValidationError } from '../../common/errors';

const execFileAsync = promisify(execFile);

// ── Tipos ────────────────────────────────────────────────────────

export interface MediaConchRuleResult {
  ruleName: string;
  outcome: 'pass' | 'fail' | 'warn';
  actual?: string;
  expected?: string;
}

export interface MediaConchReport {
  overallOutcome: 'pass' | 'fail' | 'warn';
  rules: MediaConchRuleResult[];
  policyName: string;
  filePath: string;
  timestamp: string;
  rawXml: string;
}

// ── Constantes ───────────────────────────────────────────────────

const MEDIACONCH_TIMEOUT_MS = 60_000; // 60s

const POLICY_DIR = resolve(__dirname, '../../../config/mediaconch');

// ── Adapter ──────────────────────────────────────────────────────

export class NexoraMediaConchAdapter {

  /**
   * Valida um ficheiro contra uma policy XML personalizada.
   * @param filePath   - Path do ficheiro de media
   * @param policyPath - Path absoluto ou relativo ao ficheiro XML de policy
   */
  async validate(filePath: string, policyPath: string): Promise<MediaConchReport> {
    toolRegistry.requireTool('mediaconch');
    const mediaconchPath = toolRegistry.getPath('mediaconch');

    const { stdout } = await execFileAsync(
      mediaconchPath,
      ['-p', policyPath, '--Format=XML', filePath],
      { timeout: MEDIACONCH_TIMEOUT_MS }
    );

    const report = this.parseReport(stdout, filePath, this.extractPolicyName(policyPath));

    // Prometheus
    mediaconchValidations.inc({
      policy: report.policyName,
      outcome: report.overallOutcome,
    });

    logger.info(
      {
        filePath,
        policy: report.policyName,
        outcome: report.overallOutcome,
        ruleCount: report.rules.length,
        failCount: report.rules.filter(r => r.outcome === 'fail').length,
      },
      `MediaConch: ${report.overallOutcome.toUpperCase()} (${report.rules.length} regras)`
    );

    return report;
  }

  /**
   * Valida contra a policy AS-11 UK DPP bundled.
   */
  async validateAS11(filePath: string): Promise<MediaConchReport> {
    const policyPath = resolve(POLICY_DIR, 'as11-uk-dpp.xml');
    return this.validate(filePath, policyPath);
  }

  /**
   * Valida contra a policy IMF bundled.
   */
  async validateIMF(filePath: string): Promise<MediaConchReport> {
    const policyPath = resolve(POLICY_DIR, 'imf-basic.xml');
    return this.validate(filePath, policyPath);
  }

  /**
   * Corre o ImplementationReport genérico (sem policy custom).
   */
  async validateImplementation(filePath: string): Promise<MediaConchReport> {
    toolRegistry.requireTool('mediaconch');
    const mediaconchPath = toolRegistry.getPath('mediaconch');

    const { stdout } = await execFileAsync(
      mediaconchPath,
      ['--ImplementationReport', '--Format=XML', filePath],
      { timeout: MEDIACONCH_TIMEOUT_MS }
    );

    const report = this.parseReport(stdout, filePath, 'ImplementationReport');

    mediaconchValidations.inc({
      policy: 'implementation',
      outcome: report.overallOutcome,
    });

    return report;
  }

  /**
   * Valida e lança MediaConchValidationError se falhar.
   * Útil para verificação obrigatória no pipeline.
   */
  async requirePass(filePath: string, policyPath: string): Promise<MediaConchReport> {
    const report = await this.validate(filePath, policyPath);

    if (report.overallOutcome === 'fail') {
      const failedRules = report.rules
        .filter(r => r.outcome === 'fail')
        .map(r => `${r.ruleName}: expected=${r.expected ?? '?'}, actual=${r.actual ?? '?'}`)
        .join('; ');

      throw new MediaConchValidationError(
        `MediaConch policy "${report.policyName}" falhou: ${failedRules}`,
        {
          policy: report.policyName,
          failedRules: report.rules.filter(r => r.outcome === 'fail'),
        }
      );
    }

    return report;
  }

  // ── Parsing ───────────────────────────────────────────────────

  private parseReport(xml: string, filePath: string, policyName: string): MediaConchReport {
    const rules: MediaConchRuleResult[] = [];

    // Extrair resultado global
    const globalOutcome = this.extractOutcome(xml);

    // Parsear cada regra individual
    // Formato: <rule name="..." outcome="pass|fail" ...>
    const ruleRegex = /<rule[^>]*name\s*=\s*["']([^"']+)["'][^>]*outcome\s*=\s*["']([^"']+)["'][^>]*/gi;
    let match: RegExpExecArray | null;

    while ((match = ruleRegex.exec(xml)) !== null) {
      const ruleName = match[1] ?? 'unknown';
      const outcome = (match[2] ?? 'pass').toLowerCase() as 'pass' | 'fail' | 'warn';

      // Tentar extrair valor actual vs esperado
      const ruleBlock = xml.slice(match.index, match.index + 500);
      const actualM = ruleBlock.match(/<actual[^>]*>(.*?)<\/actual>/is);
      const expectedM = ruleBlock.match(/<expected[^>]*>(.*?)<\/expected>/is);

      rules.push({
        ruleName,
        outcome,
        actual: actualM?.[1]?.trim(),
        expected: expectedM?.[1]?.trim(),
      });
    }

    return {
      overallOutcome: globalOutcome,
      rules,
      policyName,
      filePath,
      timestamp: new Date().toISOString(),
      rawXml: xml,
    };
  }

  private extractOutcome(xml: string): 'pass' | 'fail' | 'warn' {
    const m = xml.match(/outcome\s*=\s*["']?(pass|fail|warn)["']?/i);
    return (m?.[1]?.toLowerCase() as 'pass' | 'fail' | 'warn') ?? 'fail';
  }

  private extractPolicyName(policyPath: string): string {
    const parts = policyPath.replace(/\\/g, '/').split('/');
    const filename = parts[parts.length - 1] ?? 'unknown';
    return filename.replace(/\.xml$/i, '');
  }
}

// ── Singleton ────────────────────────────────────────────────────

export const mediaconchAdapter = new NexoraMediaConchAdapter();
