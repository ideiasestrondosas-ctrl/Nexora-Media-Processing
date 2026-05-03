import { describe, it, expect } from 'vitest';
import {
  gopTypeRule,
  idrFramesRule,
  cfrRule,
  pixelFormatRule,
  bFramesRule,
  codecRule,
  gopSizeRule,
  colorSpaceRule,
  resolutionRule,
  durationRule,
  sampleRateRule,
  truePeakRule,
  integratedLoudnessRule,
  avSyncRule,
  audioChannelsRule,
  fastStartRule,
  editListRule,
  fileSizeRule,
  runQCRules,
  NexoraQCInput,
} from '../../src/qc/rules/index';

describe('QC Rules Engine', () => {
  describe('Video Rules', () => {
    it('gopTypeRule', () => {
      expect(gopTypeRule({ gopType: 'CLOSED' } as any).pass).toBe(true);
      expect(gopTypeRule({ gopType: 'OPEN' } as any).severity).toBe('critical');
    });

    it('idrFramesRule', () => {
      expect(idrFramesRule({ hasIdrFrames: true } as any).pass).toBe(true);
      expect(idrFramesRule({ hasIdrFrames: false } as any).severity).toBe('critical');
    });

    it('cfrRule', () => {
      expect(cfrRule({ frameRateMode: 'CFR', frameRate: 25 } as any).pass).toBe(true);
      expect(cfrRule({ frameRateMode: 'VFR' } as any).severity).toBe('critical');
    });

    it('pixelFormatRule', () => {
      expect(pixelFormatRule({ pixelFormat: 'yuv420p' } as any).pass).toBe(true);
      expect(pixelFormatRule({ pixelFormat: 'yuv422p' } as any).severity).toBe('critical');
    });

    it('bFramesRule', () => {
      expect(bFramesRule({ bFrameCount: 0 } as any).pass).toBe(true);
      expect(bFramesRule({ bFrameCount: 2 } as any).severity).toBe('critical');
    });

    it('codecRule', () => {
      expect(codecRule({ codec: 'h264' } as any).pass).toBe(true);
      expect(codecRule({ codec: 'vp9' } as any).severity).toBe('critical');
    });

    it('gopSizeRule', () => {
      const rule = gopSizeRule(50);
      expect(rule({ frameRate: 25 } as any).pass).toBe(true);
      // Measured was 50 (from closure), expected was 50 (fps * 2 -> 25*2).
      
      const ruleFail = gopSizeRule(60);
      expect(ruleFail({ frameRate: 25 } as any).severity).toBe('warning');
    });

    it('colorSpaceRule', () => {
      expect(colorSpaceRule({ colorSpace: 'bt709' } as any).pass).toBe(true);
      expect(colorSpaceRule({ colorSpace: 'smpte170m' } as any).severity).toBe('warning');
    });

    it('resolutionRule', () => {
      expect(resolutionRule({ width: 1280, height: 720 } as any).pass).toBe(true);
      expect(resolutionRule({ width: 320, height: 240 } as any).severity).toBe('warning');
    });

    it('durationRule', () => {
      expect(durationRule({ duration: 10 } as any).pass).toBe(true);
      expect(durationRule({ duration: 0.5 } as any).severity).toBe('critical');
    });
  });

  describe('Audio Rules', () => {
    it('sampleRateRule', () => {
      expect(sampleRateRule({ sampleRate: 48000 } as any).pass).toBe(true);
      expect(sampleRateRule({ sampleRate: 44100 } as any).severity).toBe('warning');
      expect(sampleRateRule({ sampleRate: 22050 } as any).severity).toBe('critical');
    });

    it('truePeakRule', () => {
      const rule = truePeakRule(-1.0);
      expect(rule({ truePeakDbtp: -1.5 } as any).pass).toBe(true);
      expect(rule({ truePeakDbtp: -0.5 } as any).severity).toBe('warning');
      expect(rule({ truePeakDbtp: +1.0 } as any).severity).toBe('critical');
      expect(rule({ truePeakDbtp: null } as any).severity).toBe('warning');
    });

    it('integratedLoudnessRule', () => {
      const rule = integratedLoudnessRule(-23, 2.0);
      expect(rule({ integratedLufs: -24 } as any).pass).toBe(true);
      expect(rule({ integratedLufs: -20 } as any).severity).toBe('warning');
      expect(rule({ integratedLufs: null } as any).severity).toBe('warning');
    });

    it('avSyncRule', () => {
      expect(avSyncRule({ audioVideoSyncMs: 10 } as any).pass).toBe(true);
      expect(avSyncRule({ audioVideoSyncMs: 30 } as any).severity).toBe('warning');
      expect(avSyncRule({ audioVideoSyncMs: 100 } as any).severity).toBe('critical');
      expect(avSyncRule({ audioVideoSyncMs: null } as any).pass).toBe(true);
    });

    it('audioChannelsRule', () => {
      expect(audioChannelsRule({ channels: 2 } as any).pass).toBe(true);
      expect(audioChannelsRule({ channels: 1 } as any).severity).toBe('warning');
    });
  });

  describe('Container Rules', () => {
    it('fastStartRule', () => {
      expect(fastStartRule({ moovPosition: 'start' } as any).pass).toBe(true);
      expect(fastStartRule({ moovPosition: 'end' } as any).severity).toBe('warning');
      expect(fastStartRule({ moovPosition: 'unknown' } as any).pass).toBe(true);
    });

    it('editListRule', () => {
      expect(editListRule({ hasEditLists: false } as any).pass).toBe(true);
      expect(editListRule({ hasEditLists: true } as any).severity).toBe('warning');
    });

    it('fileSizeRule', () => {
      expect(fileSizeRule({ size: 10240 } as any).pass).toBe(true);
      expect(fileSizeRule({ size: 500 } as any).severity).toBe('critical');
    });
  });

  describe('runQCRules Engine', () => {
    const buildInput = (overrides: Partial<NexoraQCInput> = {}): NexoraQCInput => ({
      assetId: 'asset-1',
      profile: 'broadcast-hd',
      video: {
        codec: 'h264',
        profile: 'high',
        level: '4.1',
        pixelFormat: 'yuv420p',
        frameRate: 25,
        frameRateMode: 'CFR',
        gopType: 'CLOSED',
        hasIdrFrames: true,
        bFrameCount: 0,
        bitrate: 5000000,
        width: 1920,
        height: 1080,
        bitDepth: 8,
        colorSpace: 'bt709',
        colorPrimaries: 'bt709',
        transferCharacteristics: 'bt709',
        duration: 30,
        hasFastStart: true,
        ...overrides.video,
      },
      audio: {
        codec: 'aac',
        sampleRate: 48000,
        bitDepth: 16,
        channels: 2,
        channelLayout: 'stereo',
        integratedLufs: -23,
        truePeakDbtp: -2,
        loudnessRange: 5,
        audioVideoSyncMs: 0,
        ...overrides.audio,
      },
      container: {
        format: 'mp4',
        duration: 30,
        size: 50000000,
        hasEditLists: false,
        hasTimecodeTrack: false,
        moovPosition: 'start',
        ...overrides.container,
      },
    });

    it('deve retornar PASS para um ficheiro perfeito', async () => {
      const input = buildInput();
      const result = await runQCRules(input);
      expect(result.decision).toBe('PASS');
      expect(result.results.filter(r => !r.pass)).toHaveLength(0);
    });

    it('deve retornar REJECT se houver um erro crítico (ex: VFR)', async () => {
      const input = buildInput({ video: { frameRateMode: 'VFR' } as any });
      const result = await runQCRules(input);
      expect(result.decision).toBe('REJECT');
      expect(result.results.find(r => r.code === 'ERR_VFR')).toBeDefined();
    });

    it('deve retornar QUARANTINE se houver 3 ou mais warnings', async () => {
      const input = buildInput({
        audio: { sampleRate: 44100, integratedLufs: null, truePeakDbtp: null } as any,
        container: { moovPosition: 'end' } as any
      });
      const result = await runQCRules(input);
      expect(result.decision).toBe('QUARANTINE');
      expect(result.results.filter(r => r.severity === 'warning').length).toBeGreaterThanOrEqual(3);
    });

    it('deve retornar PASS (com avisos) se houver 1-2 warnings', async () => {
      const input = buildInput({
        container: { moovPosition: 'end' } as any // 1 warning
      });
      const result = await runQCRules(input);
      expect(result.decision).toBe('PASS');
      expect(result.results.filter(r => r.severity === 'warning').length).toBe(1);
    });
  });
});
