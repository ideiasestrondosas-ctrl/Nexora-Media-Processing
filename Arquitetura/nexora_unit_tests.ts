// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — Testes Unitários das QC Rules
// Ficheiro: tests/unit/qc-rules.test.ts
//
// OBJECTIVO: 100% de cobertura de branches nas QC rules.
// São safety-critical — uma regra errada pode passar conteúdo
// não-conforme para broadcast.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  gopTypeRule,
  idrFramesRule,
  cfrRule,
  pixelFormatRule,
  bFramesRule,
  codecRule,
  colorSpaceRule,
  resolutionRule,
  durationRule,
  gopSizeRule,
  type VideoMetadata,
} from '../../src/qc/rules/index';

import {
  sampleRateRule,
  truePeakRule,
  integratedLoudnessRule,
  avSyncRule,
  audioChannelsRule,
  type AudioMetadata,
} from '../../src/qc/rules/index';

import {
  fastStartRule,
  editListRule,
  fileSizeRule,
  type ContainerMetadata,
} from '../../src/qc/rules/index';

import {
  NexoraFFmpegCommandBuilder,
  NexoraSecurityError,
} from '../../src/pipeline/ffmpeg/builder';

// ── Factories de metadata de teste ───────────────────────────

function makeVideoMeta(overrides: Partial<VideoMetadata> = {}): VideoMetadata {
  return {
    codec: 'h264',
    profile: 'high',
    level: '4.1',
    pixelFormat: 'yuv420p',
    frameRate: 25,
    frameRateMode: 'CFR',
    gopType: 'CLOSED',
    hasIdrFrames: true,
    bFrameCount: 0,
    bitrate: 8000,
    width: 1920,
    height: 1080,
    bitDepth: 8,
    colorSpace: 'bt709',
    colorPrimaries: 'bt709',
    transferCharacteristics: 'bt709',
    duration: 3600,
    hasFastStart: true,
    ...overrides,
  };
}

function makeAudioMeta(overrides: Partial<AudioMetadata> = {}): AudioMetadata {
  return {
    codec: 'aac',
    sampleRate: 48000,
    bitDepth: 16,
    channels: 2,
    channelLayout: 'stereo',
    integratedLufs: -23.1,
    truePeakDbtp: -1.5,
    loudnessRange: 9.2,
    audioVideoSyncMs: 0,
    ...overrides,
  };
}

function makeContainerMeta(overrides: Partial<ContainerMetadata> = {}): ContainerMetadata {
  return {
    format: 'mp4',
    duration: 3600,
    size: 3 * 1024 * 1024 * 1024, // 3 GB
    hasEditLists: false,
    hasTimecodeTrack: false,
    moovPosition: 'start',
    ...overrides,
  };
}

// ══════════════════════════════════════════
// TESTES DE VÍDEO
// ══════════════════════════════════════════

describe('NexoraVideoQCRules', () => {

  describe('gopTypeRule', () => {
    it('deve passar com GOP fechado', () => {
      const result = gopTypeRule(makeVideoMeta({ gopType: 'CLOSED' }));
      expect(result.pass).toBe(true);
      expect(result.code).toBe('GOP_OK');
    });

    it('deve falhar com GOP aberto — severity critical', () => {
      const result = gopTypeRule(makeVideoMeta({ gopType: 'OPEN' }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.code).toBe('ERR_GOP_OPEN');
      expect(result.measuredValue).toBe('OPEN');
    });

    it('deve falhar com GOP desconhecido — severity critical', () => {
      const result = gopTypeRule(makeVideoMeta({ gopType: 'UNKNOWN' }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.code).toBe('ERR_GOP_OPEN');
    });
  });

  describe('idrFramesRule', () => {
    it('deve passar quando IDR frames presentes', () => {
      const result = idrFramesRule(makeVideoMeta({ hasIdrFrames: true }));
      expect(result.pass).toBe(true);
      expect(result.code).toBe('IDR_OK');
    });

    it('deve falhar quando sem IDR frames', () => {
      const result = idrFramesRule(makeVideoMeta({ hasIdrFrames: false }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.code).toBe('ERR_NO_IDR');
    });
  });

  describe('cfrRule', () => {
    it('deve passar com CFR', () => {
      const result = cfrRule(makeVideoMeta({ frameRateMode: 'CFR' }));
      expect(result.pass).toBe(true);
    });

    it('deve falhar com VFR — severity critical', () => {
      const result = cfrRule(makeVideoMeta({ frameRateMode: 'VFR' }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.code).toBe('ERR_VFR');
    });

    it('deve falhar com modo desconhecido', () => {
      const result = cfrRule(makeVideoMeta({ frameRateMode: 'UNKNOWN' }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
    });
  });

  describe('pixelFormatRule', () => {
    it('deve passar com yuv420p', () => {
      const result = pixelFormatRule(makeVideoMeta({ pixelFormat: 'yuv420p' }));
      expect(result.pass).toBe(true);
      expect(result.code).toBe('PIXFMT_OK');
    });

    it('deve passar com yuv420p10le (HDR)', () => {
      const result = pixelFormatRule(makeVideoMeta({ pixelFormat: 'yuv420p10le' }));
      expect(result.pass).toBe(true);
    });

    it('deve falhar com yuv422p — severity critical', () => {
      const result = pixelFormatRule(makeVideoMeta({ pixelFormat: 'yuv422p' }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.code).toBe('ERR_PIXEL_FORMAT');
    });

    it('deve falhar com yuv444p — severity critical', () => {
      const result = pixelFormatRule(makeVideoMeta({ pixelFormat: 'yuv444p' }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
    });
  });

  describe('bFramesRule', () => {
    it('deve passar com 0 B-frames', () => {
      const result = bFramesRule(makeVideoMeta({ bFrameCount: 0 }));
      expect(result.pass).toBe(true);
      expect(result.code).toBe('BFRAMES_OK');
    });

    it('deve falhar com 2 B-frames — severity critical', () => {
      const result = bFramesRule(makeVideoMeta({ bFrameCount: 2 }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.code).toBe('ERR_BFRAMES');
      expect(result.measuredValue).toBe(2);
    });

    it('deve falhar com 3 B-frames', () => {
      const result = bFramesRule(makeVideoMeta({ bFrameCount: 3 }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
    });
  });

  describe('codecRule', () => {
    it('deve passar com h264', () => {
      expect(codecRule(makeVideoMeta({ codec: 'h264' })).pass).toBe(true);
    });

    it('deve passar com hevc', () => {
      expect(codecRule(makeVideoMeta({ codec: 'hevc' })).pass).toBe(true);
    });

    it('deve passar com prores', () => {
      expect(codecRule(makeVideoMeta({ codec: 'prores' })).pass).toBe(true);
    });

    it('deve falhar com codec não suportado', () => {
      const result = codecRule(makeVideoMeta({ codec: 'vp9' }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.code).toBe('ERR_CODEC_UNSUPPORTED');
    });
  });

  describe('gopSizeRule', () => {
    it('deve passar com GOP exactamente fps×2 a 25fps', () => {
      const result = gopSizeRule(50)(makeVideoMeta({ frameRate: 25 }));
      expect(result.pass).toBe(true);
    });

    it('deve passar com GOP dentro da tolerância (±2 frames)', () => {
      const result = gopSizeRule(51)(makeVideoMeta({ frameRate: 25 }));
      expect(result.pass).toBe(true);
    });

    it('deve falhar com GOP muito diferente — warning', () => {
      const result = gopSizeRule(30)(makeVideoMeta({ frameRate: 25 }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('warning');
      expect(result.code).toBe('WARN_GOP_SIZE');
    });
  });

  describe('durationRule', () => {
    it('deve passar com duração normal', () => {
      expect(durationRule(makeVideoMeta({ duration: 3600 })).pass).toBe(true);
    });

    it('deve falhar com duração zero — critical', () => {
      const result = durationRule(makeVideoMeta({ duration: 0 }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.code).toBe('ERR_DURATION_TOO_SHORT');
    });

    it('deve falhar com duração muito curta', () => {
      const result = durationRule(makeVideoMeta({ duration: 0.5 }));
      expect(result.pass).toBe(false);
    });
  });
});

// ══════════════════════════════════════════
// TESTES DE ÁUDIO
// ══════════════════════════════════════════

describe('NexoraAudioQCRules', () => {

  describe('sampleRateRule', () => {
    it('deve passar com 48000 Hz', () => {
      const result = sampleRateRule(makeAudioMeta({ sampleRate: 48000 }));
      expect(result.pass).toBe(true);
      expect(result.code).toBe('SAMPLE_RATE_OK');
    });

    it('deve falhar com 44100 Hz — severity warning', () => {
      const result = sampleRateRule(makeAudioMeta({ sampleRate: 44100 }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('warning');
      expect(result.code).toBe('WARN_SAMPLE_RATE_44100');
    });

    it('deve falhar com sample rate não standard — severity critical', () => {
      const result = sampleRateRule(makeAudioMeta({ sampleRate: 22050 }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
    });
  });

  describe('truePeakRule', () => {
    const rule = truePeakRule(-1.0);

    it('deve passar com True Peak -1.5 dBTP', () => {
      const result = rule(makeAudioMeta({ truePeakDbtp: -1.5 }));
      expect(result.pass).toBe(true);
      expect(result.code).toBe('TRUE_PEAK_OK');
    });

    it('deve passar com True Peak exactamente no limite (-1.0 dBTP)', () => {
      const result = rule(makeAudioMeta({ truePeakDbtp: -1.0 }));
      expect(result.pass).toBe(true);
    });

    it('deve falhar com True Peak -0.5 dBTP (acima do limite) — warning', () => {
      const result = rule(makeAudioMeta({ truePeakDbtp: -0.5 }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('warning');
      expect(result.code).toBe('ERR_TRUE_PEAK_HIGH');
    });

    it('deve falhar com True Peak 0.0 dBTP (clipping) — critical', () => {
      const result = rule(makeAudioMeta({ truePeakDbtp: 0.0 }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.code).toBe('ERR_TRUE_PEAK_CLIP');
    });

    it('deve falhar com True Peak positivo (+1.0 dBTP) — critical', () => {
      const result = rule(makeAudioMeta({ truePeakDbtp: 1.0 }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
    });

    it('deve retornar warning quando True Peak não foi medido (null)', () => {
      const result = rule(makeAudioMeta({ truePeakDbtp: null }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('warning');
      expect(result.code).toBe('WARN_TRUE_PEAK_UNMEASURED');
    });
  });

  describe('integratedLoudnessRule', () => {
    const rule = integratedLoudnessRule(-23, 2.0);

    it('deve passar com -23.1 LUFS (dentro da tolerância)', () => {
      const result = rule(makeAudioMeta({ integratedLufs: -23.1 }));
      expect(result.pass).toBe(true);
      expect(result.code).toBe('LUFS_OK');
    });

    it('deve passar no limite da tolerância (-21 LUFS = desvio 2 LU)', () => {
      const result = rule(makeAudioMeta({ integratedLufs: -21.0 }));
      expect(result.pass).toBe(true);
    });

    it('deve falhar com desvio > 2 LU — warning', () => {
      const result = rule(makeAudioMeta({ integratedLufs: -18.0 }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('warning');
      expect(result.code).toBe('WARN_LUFS_DEVIATION');
      expect(result.measuredValue).toBe(-18.0);
    });

    it('deve retornar warning quando LUFS não foi medido', () => {
      const result = rule(makeAudioMeta({ integratedLufs: null }));
      expect(result.pass).toBe(false);
      expect(result.code).toBe('WARN_LUFS_UNMEASURED');
    });
  });

  describe('avSyncRule', () => {
    it('deve passar com sync 0ms', () => {
      const result = avSyncRule(makeAudioMeta({ audioVideoSyncMs: 0 }));
      expect(result.pass).toBe(true);
    });

    it('deve passar com sync dentro de ±20ms', () => {
      expect(avSyncRule(makeAudioMeta({ audioVideoSyncMs: 20 })).pass).toBe(true);
      expect(avSyncRule(makeAudioMeta({ audioVideoSyncMs: -20 })).pass).toBe(true);
    });

    it('deve falhar com sync 30ms — warning', () => {
      const result = avSyncRule(makeAudioMeta({ audioVideoSyncMs: 30 }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('warning');
    });

    it('deve falhar com sync 50ms — critical', () => {
      const result = avSyncRule(makeAudioMeta({ audioVideoSyncMs: 50 }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.code).toBe('ERR_AV_SYNC');
    });
  });

  describe('audioChannelsRule', () => {
    it('deve passar com 2 canais (stereo)', () => {
      expect(audioChannelsRule(makeAudioMeta({ channels: 2 })).pass).toBe(true);
    });

    it('deve passar com 6 canais (5.1)', () => {
      expect(audioChannelsRule(makeAudioMeta({ channels: 6 })).pass).toBe(true);
    });

    it('deve falhar com 1 canal (mono) — warning', () => {
      const result = audioChannelsRule(makeAudioMeta({ channels: 1 }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('warning');
      expect(result.code).toBe('WARN_MONO_AUDIO');
    });
  });
});

// ══════════════════════════════════════════
// TESTES DE CONTAINER
// ══════════════════════════════════════════

describe('NexoraContainerQCRules', () => {

  describe('fastStartRule', () => {
    it('deve passar com moov no início', () => {
      const result = fastStartRule(makeContainerMeta({ moovPosition: 'start' }));
      expect(result.pass).toBe(true);
    });

    it('deve passar quando posição desconhecida (não bloquear)', () => {
      const result = fastStartRule(makeContainerMeta({ moovPosition: 'unknown' }));
      expect(result.pass).toBe(true);
    });

    it('deve falhar com moov no final — warning', () => {
      const result = fastStartRule(makeContainerMeta({ moovPosition: 'end' }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('warning');
      expect(result.code).toBe('WARN_NO_FAST_START');
    });
  });

  describe('fileSizeRule', () => {
    it('deve passar com ficheiro de tamanho normal', () => {
      expect(fileSizeRule(makeContainerMeta({ size: 1024 * 1024 })).pass).toBe(true);
    });

    it('deve falhar com ficheiro vazio — critical', () => {
      const result = fileSizeRule(makeContainerMeta({ size: 0 }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.code).toBe('ERR_FILE_TOO_SMALL');
    });

    it('deve falhar com ficheiro de 100 bytes — critical', () => {
      const result = fileSizeRule(makeContainerMeta({ size: 100 }));
      expect(result.pass).toBe(false);
    });
  });
});

// ══════════════════════════════════════════
// TESTES DO FFMPEG COMMAND BUILDER (Segurança)
// ══════════════════════════════════════════

describe('NexoraFFmpegCommandBuilder', () => {
  const builder = new NexoraFFmpegCommandBuilder();

  describe('validateInputPath — Segurança (ADR-002)', () => {
    it('deve rejeitar path com ../ (path traversal)', () => {
      expect(() => builder.validateInputPath('../../../etc/passwd'))
        .toThrow(NexoraSecurityError);
    });

    it('deve rejeitar path com | (pipe injection)', () => {
      expect(() => builder.validateInputPath('/media/input/file|rm -rf /.mp4'))
        .toThrow(NexoraSecurityError);
    });

    it('deve rejeitar path com ; (command injection)', () => {
      expect(() => builder.validateInputPath('/media/input/file;rm -rf /.mp4'))
        .toThrow(NexoraSecurityError);
    });

    it('deve rejeitar path com ` (backtick injection)', () => {
      expect(() => builder.validateInputPath('/media/input/`rm -rf /`.mp4'))
        .toThrow(NexoraSecurityError);
    });

    it('deve rejeitar path com $ (variável shell)', () => {
      expect(() => builder.validateInputPath('/media/input/$HOME/.mp4'))
        .toThrow(NexoraSecurityError);
    });

    it('deve rejeitar path vazio', () => {
      expect(() => builder.validateInputPath(''))
        .toThrow(NexoraSecurityError);
    });
  });

  describe('buildBroadcastHD — Parâmetros obrigatórios (ADR-006)', () => {
    // Usar path dentro das directorias permitidas
    const params = {
      inputPath: './tests/fixtures/test_input.mp4',
      outputPath: './tests/output/test_output.mp4',
      fps: 25,
    };

    it('deve sempre incluir -sc_threshold 0', () => {
      const cmd = builder.buildBroadcastHD(params);
      const idx = cmd.indexOf('-sc_threshold');
      expect(idx).toBeGreaterThan(-1);
      expect(cmd[idx + 1]).toBe('0');
    });

    it('deve sempre incluir -flags +cgop (Closed GOP)', () => {
      const cmd = builder.buildBroadcastHD(params);
      expect(cmd.join(' ')).toMatch(/-flags.*\+cgop/);
    });

    it('deve sempre incluir open-gop=0 nos x264-params', () => {
      const cmd = builder.buildBroadcastHD(params);
      const x264Idx = cmd.indexOf('-x264-params');
      expect(x264Idx).toBeGreaterThan(-1);
      expect(cmd[x264Idx + 1]).toContain('open-gop=0');
    });

    it('deve sempre incluir bframes=0 nos x264-params', () => {
      const cmd = builder.buildBroadcastHD(params);
      const x264Idx = cmd.indexOf('-x264-params');
      expect(cmd[x264Idx + 1]).toContain('bframes=0');
    });

    it('deve calcular GOP = fps × 2 correctamente (25fps → GOP 50)', () => {
      const cmd = builder.buildBroadcastHD({ ...params, fps: 25 });
      const gIdx = cmd.indexOf('-g');
      expect(cmd[gIdx + 1]).toBe('50');
    });

    it('deve calcular GOP = fps × 2 correctamente (29.97fps → GOP 60)', () => {
      const cmd = builder.buildBroadcastHD({ ...params, fps: 29.97 });
      const gIdx = cmd.indexOf('-g');
      expect(cmd[gIdx + 1]).toBe('60');
    });

    it('deve sempre incluir -movflags +faststart', () => {
      const cmd = builder.buildBroadcastHD(params);
      expect(cmd.join(' ')).toContain('+faststart');
    });

    it('deve sempre incluir -pix_fmt yuv420p (ADR-004)', () => {
      const cmd = builder.buildBroadcastHD(params);
      const idx = cmd.indexOf('-pix_fmt');
      expect(cmd[idx + 1]).toBe('yuv420p');
    });

    it('deve sempre usar -vsync cfr', () => {
      const cmd = builder.buildBroadcastHD(params);
      const idx = cmd.indexOf('-vsync');
      expect(cmd[idx + 1]).toBe('cfr');
    });

    it('deve retornar array de strings, NUNCA string única', () => {
      const cmd = builder.buildBroadcastHD(params);
      expect(Array.isArray(cmd)).toBe(true);
      expect(cmd.every(arg => typeof arg === 'string')).toBe(true);
    });

    it('deve incluir colorspace bt709 para HD', () => {
      const cmd = builder.buildBroadcastHD(params);
      expect(cmd).toContain('bt709');
    });
  });

  describe('buildLoudnessAnalysis', () => {
    it('deve usar -f null - para análise sem output', () => {
      const cmd = builder.buildLoudnessAnalysis('./tests/fixtures/test.mp4');
      expect(cmd).toContain('-f');
      expect(cmd).toContain('null');
      expect(cmd).toContain('-');
    });

    it('deve incluir loudnorm com parâmetros R128 correctos', () => {
      const cmd = builder.buildLoudnessAnalysis('./tests/fixtures/test.mp4');
      const afIdx = cmd.indexOf('-af');
      expect(cmd[afIdx + 1]).toContain('I=-23');
      expect(cmd[afIdx + 1]).toContain('TP=-1');
      expect(cmd[afIdx + 1]).toContain('print_format=json');
    });
  });
});
