import { describe, it, expect } from 'vitest';
import { ffmpegBuilder } from '../../src/pipeline/ffmpeg/builder';
import type { GPUCapability } from '../../src/pipeline/ffmpeg/gpu-detector';

describe('NexoraFFmpegCommandBuilder', () => {
  const input = '/tmp/input.mp4';
  const output = '/tmp/output.mp4';

  describe('ADR-004: Pixel Format', () => {
    it('deve forçar yuv420p em todos os profiles (CPU)', () => {
      const profiles = ['broadcast-hd', 'ott-hd', 'web-sd', 'proxy'];
      
      for (const profile of profiles) {
        const { cpu } = ffmpegBuilder.build(profile, input, output);
        const pixFmtIndex = cpu.args.indexOf('-pix_fmt');
        expect(pixFmtIndex).toBeGreaterThan(-1);
        expect(cpu.args[pixFmtIndex + 1]).toBe('yuv420p');
      }
    });

    it('deve forçar yuv420p em todos os profiles (GPU)', () => {
      const gpu: GPUCapability = { available: true, type: 'nvenc', name: 'NVIDIA', memoryMb: 8000 };
      const { gpu: gpuCmd } = ffmpegBuilder.build('broadcast-hd', input, output, gpu);
      
      expect(gpuCmd).toBeDefined();
      const pixFmtIndex = gpuCmd!.args.indexOf('-pix_fmt');
      expect(pixFmtIndex).toBeGreaterThan(-1);
      expect(gpuCmd!.args[pixFmtIndex + 1]).toBe('yuv420p');
    });
  });

  describe('ADR-006: Broadcast Requirements', () => {
    it('deve definir GOP fechado e 0 B-frames no profile broadcast-hd (CPU)', () => {
      const { cpu } = ffmpegBuilder.build('broadcast-hd', input, output);
      
      // Closed GOP via flags
      const flagsIndex = cpu.args.indexOf('-flags');
      expect(flagsIndex).toBeGreaterThan(-1);
      expect(cpu.args[flagsIndex + 1]).toContain('+cgop');

      // 0 B-frames
      const bfIndex = cpu.args.indexOf('-bf');
      expect(bfIndex).toBeGreaterThan(-1);
      expect(cpu.args[bfIndex + 1]).toBe('0');

      // Parâmetros estritos x264
      const x264ParamsIndex = cpu.args.indexOf('-x264-params');
      expect(x264ParamsIndex).toBeGreaterThan(-1);
      expect(cpu.args[x264ParamsIndex + 1]).toContain('open-gop=0');
      expect(cpu.args[x264ParamsIndex + 1]).toContain('bframes=0');
      expect(cpu.args[x264ParamsIndex + 1]).toContain('force-cfr=1');

      // vsync cfr
      const vsyncIndex = cpu.args.indexOf('-vsync');
      expect(vsyncIndex).toBeGreaterThan(-1);
      expect(cpu.args[vsyncIndex + 1]).toBe('cfr');
    });

    it('deve definir idr forçado no NVENC para broadcast-hd', () => {
      const gpu: GPUCapability = { available: true, type: 'nvenc', name: 'NVIDIA', memoryMb: 8000 };
      const { gpu: gpuCmd } = ffmpegBuilder.build('broadcast-hd', input, output, gpu);
      
      expect(gpuCmd).toBeDefined();
      
      const forcedIdrIndex = gpuCmd!.args.indexOf('-forced-idr');
      expect(forcedIdrIndex).toBeGreaterThan(-1);
      expect(gpuCmd!.args[forcedIdrIndex + 1]).toBe('1');
    });

    it('deve permitir B-frames em OTT (nao broadcast)', () => {
      const { cpu } = ffmpegBuilder.build('ott-hd', input, output);
      
      const bfIndex = cpu.args.indexOf('-bf');
      expect(bfIndex).toBeGreaterThan(-1);
      expect(Number(cpu.args[bfIndex + 1])).toBeGreaterThan(0);
      
      // Não deve ter os x264-params estritos de broadcast
      const x264ParamsIndex = cpu.args.indexOf('-x264-params');
      expect(x264ParamsIndex).toBe(-1);
    });
  });

  describe('Audio Loudnorm', () => {
    it('deve construir filtro para Pass 1 (análise) quando loudnorm não tem medições', () => {
      const { cpu } = ffmpegBuilder.build('broadcast-hd', input, output, null, {
        targetLufs: 23,
        truePeakLimit: 1.0
      });

      const afIndex = cpu.args.indexOf('-af');
      expect(afIndex).toBeGreaterThan(-1);
      const filter = cpu.args[afIndex + 1];
      expect(filter).toContain('loudnorm=I=-23:TP=-1');
      expect(filter).toContain('print_format=json');
    });

    it('deve construir filtro para Pass 2 (linear) quando recebe medições', () => {
      const { cpu } = ffmpegBuilder.build('broadcast-hd', input, output, null, {
        targetLufs: 23,
        truePeakLimit: 1.0,
        measuredI: '-20.5',
        measuredTp: '2.0',
        measuredLra: '10',
        measuredThresh: '-30',
        offset: '0.5'
      });

      const afIndex = cpu.args.indexOf('-af');
      expect(afIndex).toBeGreaterThan(-1);
      const filter = cpu.args[afIndex + 1];
      expect(filter).toContain('measured_I=-20.5');
      expect(filter).toContain('measured_TP=2.0');
      expect(filter).toContain('linear=true');
    });
  });

  describe('Geral', () => {
    it('nunca deve retornar uma string inteira, apenas array', () => {
      const { cpu } = ffmpegBuilder.build('broadcast-hd', input, output);
      expect(Array.isArray(cpu.args)).toBe(true);
      expect(cpu.args.length).toBeGreaterThan(10);
      
      // Verifica se o array tem os inputs mapeados correctamente
      expect(cpu.args[0]).toBe('-y');
      expect(cpu.args[1]).toBe('-i');
      expect(cpu.args[2]).toBe(input);
    });
  });
});
