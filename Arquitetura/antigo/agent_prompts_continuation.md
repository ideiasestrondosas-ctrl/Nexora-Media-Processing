# Media Processing Hub
## Prompts Finais + Arquitectura Multi-Agente Completa

> Continuação do documento de prompts. Cobre: Segurança, Testes, 
> Integração Open Source, Protocolo de Comunicação entre Agentes e README final.

---

# ═══════════════════════════════════════════
# PROMPT 7 — CLAUDE CODE
# Segurança · Auth · Hardening · Compliance
# ═══════════════════════════════════════════

```
ROLE: Security Engineer — Media Processing Hub

Implement the complete security layer for a production broadcast-grade 
media processing platform. This system handles proprietary media assets 
that may include unpublished content, DRM-protected material, and 
commercially sensitive files.

THREAT MODEL:
- Unauthorized access to media assets (pre-release content)
- Replay attacks on the processing API
- Path traversal in file handling
- SSRF via URL ingest endpoint
- FFmpeg command injection via malicious filenames
- Resource exhaustion (file bomb, zip bomb, oversized uploads)
- Credential theft via logs
- Insider threat (audit trail tampering)

═══════════════════
TASK 1: AUTH SYSTEM
═══════════════════

Implement RS256 JWT authentication with key rotation:

interface JWTPayload {
  sub: string;          // user ID (UUID)
  org: string;          // organisation ID
  roles: Role[];        // ['admin', 'operator', 'viewer', 'api']
  permissions: string[]; // ['assets:read', 'assets:write', 'jobs:submit', ...]
  iat: number;
  exp: number;          // 1h for user tokens, 24h for API tokens
  jti: string;          // JWT ID for revocation
}

type Role = 'admin' | 'operator' | 'viewer' | 'api';

Permission matrix:
  admin     → all permissions
  operator  → assets:*, jobs:*, queue:read, profiles:read
  viewer    → assets:read, jobs:read
  api       → assets:write, jobs:submit (for system integrations)

Implement:
1. RSA key pair generation (2048-bit minimum, 4096 preferred)
2. Key rotation (new key generated every 30 days, old key valid 7 days grace)
3. JWT issuance + validation middleware (Fastify plugin)
4. Token revocation list in Redis (by jti)
5. API key management (hash+salt, never store plaintext)
6. Rate limiting per identity (not just per IP):
   - User tokens: 1000 req/min
   - API keys: 5000 req/min
   - Anonymous: 10 req/min (health checks only)

═════════════════════════
TASK 2: FILE SECURITY
═════════════════════════

Implement multi-layer file validation BEFORE any processing:

Layer 1 — MIME type validation:
- Never trust Content-Type header
- Read file magic bytes (first 16 bytes)
- Validate against allowlist:
  ALLOWED_MAGIC_BYTES = {
    mp4:  ['00 00 00 ?? 66 74 79 70'],  // ftyp box
    mov:  ['00 00 00 ?? 66 74 79 70'],
    mxf:  ['06 0E 2B 34 02 05 01 01'],  // MXF UL
    ts:   ['47'],                         // MPEG-TS sync byte
    mkv:  ['1A 45 DF A3'],               // EBML header
    wav:  ['52 49 46 46'],               // RIFF
    mp3:  ['49 44 33', 'FF FB'],         // ID3 or sync word
    aac:  ['FF F1', 'FF F9'],            // ADTS sync
  }
- Reject anything not in allowlist BEFORE touching the file

Layer 2 — Size limits:
- Max upload size: configurable (default 50GB)
- Min size: 1KB (reject empty or near-empty files)
- Max filename length: 255 chars
- Reject filenames with: ../ ./ null bytes \0 | & ; ` $ ( ) { }

Layer 3 — Filename sanitisation:
- Strip all path components (use path.basename only)
- Sanitize to: [a-zA-Z0-9._-] only
- Generate internal UUID-based filename immediately on ingest
- Never use original filename in any shell command

Layer 4 — Archive bomb detection:
- If zip/tar detected → reject immediately (not a media format)
- File entropy check: if Shannon entropy > 7.9 → flag as potentially encrypted

Layer 5 — SSRF prevention (URL ingest):
- Validate URL is http/https only (no file://, ftp://, etc.)
- Resolve DNS and check resolved IP is NOT:
  - 127.0.0.0/8 (loopback)
  - 10.0.0.0/8 (RFC1918)
  - 172.16.0.0/12 (RFC1918)
  - 192.168.0.0/16 (RFC1918)
  - 169.254.0.0/16 (link-local)
  - ::1/128 (IPv6 loopback)
- Re-check after each redirect (follow max 3 redirects)
- Set download timeout: 30min max
- Set download size limit: same as upload limit

═══════════════════════════════
TASK 3: FFmpeg COMMAND SAFETY
═══════════════════════════════

Implement a command sanitizer that prevents injection:

class FFmpegCommandBuilder {
  // NEVER accept user input directly in command strings
  // ALL params are typed — no raw string interpolation
  
  private validateInputPath(p: string): string {
    // Must be absolute path within allowed directories only
    const allowed = [process.env.MEDIA_INPUT_DIR, process.env.MEDIA_TEMP_DIR];
    const resolved = path.resolve(p);
    if (!allowed.some(dir => resolved.startsWith(path.resolve(dir!)))) {
      throw new SecurityError('Path outside allowed directories');
    }
    // Must exist and be a file
    if (!fs.statSync(resolved).isFile()) {
      throw new SecurityError('Not a regular file');
    }
    return resolved;
  }
  
  private validateBitrate(kbps: number): number {
    if (kbps < 100 || kbps > 100000) throw new RangeError('Bitrate out of range');
    return Math.floor(kbps);
  }
  
  // All build methods return string[] (argument array)
  // NEVER return a shell string — always use execFile, never exec
  buildTranscodeCommand(params: TranscodeParams): string[] {
    return [
      '-y',
      '-i', this.validateInputPath(params.inputPath),
      '-c:v', this.validateCodec(params.videoCodec),
      '-b:v', `${this.validateBitrate(params.bitrateKbps)}k`,
      // ... all params validated individually
      this.validateOutputPath(params.outputPath)
    ];
  }
}

// ALWAYS use execFile or spawn with argument array — NEVER exec() with string
import { execFile } from 'child_process';
execFile('ffmpeg', commandBuilder.buildTranscodeCommand(params), options, callback);
// NOT: exec(`ffmpeg ${someString}`) ← NEVER

═══════════════════════════════
TASK 4: SECRETS MANAGEMENT
═══════════════════════════════

Rules for secrets in this codebase:
1. Zero secrets in environment variables for production
   - Use HashiCorp Vault or AWS Secrets Manager
   - Fallback to env vars only for local dev
2. Database passwords rotated every 90 days (automated)
3. JWT private keys stored encrypted at rest
4. MinIO credentials: separate read-only and read-write keys
5. Webhook secrets: HMAC-SHA256 signatures on all outbound payloads

Implement secrets loader with fallback chain:
  1. Vault (if VAULT_ADDR set)
  2. AWS Secrets Manager (if AWS_REGION set)
  3. Environment variables (dev only, warn in logs)
  4. Error if none available in production

═══════════════════════════════
TASK 5: AUDIT TRAIL INTEGRITY
═══════════════════════════════

The audit trail must be tamper-evident:
1. Each audit log entry has a hash chain:
   entry_hash = SHA256(previous_entry_hash + entry_content)
2. Store entry_hash in the record
3. Periodic verification: re-compute chain and compare
4. If chain broken → CRITICAL ALERT → escalate immediately
5. Optional: replicate audit logs to immutable S3 bucket (object lock)

Implement:
- AuditChainVerifier: verify integrity of full chain or range
- AuditWriter: appends entry with hash chain automatically
- ScheduledVerifier: runs every 6h, alerts on broken chain

═══════════════════════════════
TASK 6: GDPR + DATA GOVERNANCE
═══════════════════════════════

For each asset stored:
- Data retention policy: configurable per organisation (default: 90 days)
- Automated deletion job: runs daily, removes assets past retention
- Deletion is cryptographic: overwrite file with zeros before delete
- Deletion logged in audit trail (cannot be undone)
- Export: organisation can export all metadata as JSON (no raw media)
- Right to erasure: API endpoint to delete all data for a user

DELIVERABLES:
1. Auth middleware (JWT + API key) with full test coverage
2. File validation pipeline (magic bytes + SSRF + sanitizer)
3. FFmpegCommandBuilder with injection prevention
4. Secrets loader with Vault + env fallback
5. Audit chain integrity system
6. Security test suite: injection tests, auth bypass attempts, SSRF tests
7. Security checklist document (OWASP Top 10 mapped to implementation)
```

---

---

# ═══════════════════════════════════════════
# PROMPT 8 — CLAUDE CODE / OPENAI CODEX
# Testes Completos · QA · E2E · Performance
# ═══════════════════════════════════════════

```
ROLE: QA & Test Engineer — Media Processing Hub

Build a comprehensive testing strategy and implementation for 
a broadcast-grade media processing platform.

TEST STACK:
- Unit/Integration: Vitest + Testcontainers (real Docker containers)
- E2E API: Supertest + Vitest
- E2E Frontend: Playwright
- Performance: k6
- Contract testing: Pact (if external API consumers exist)
- Mutation testing: Stryker (target: 75% mutation score)
- Test fixtures: real media files (generated, not copyrighted)

═══════════════════════════
FIXTURE MEDIA FILES
═══════════════════════════

Generate test fixture files using FFmpeg (no copyright issues):

// scripts/generate-fixtures.sh

# 1. Reference file — perfect H.264 broadcast-safe
ffmpeg -f lavfi -i "testsrc2=duration=30:size=1920x1080:rate=25" \
  -f lavfi -i "sine=frequency=1000:duration=30:sample_rate=48000" \
  -c:v libx264 -profile:v high -level:v 4.1 \
  -pix_fmt yuv420p \
  -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 0 \
  -b:v 8000k -maxrate 8000k -bufsize 16000k \
  -c:a pcm_s24le -ar 48000 \
  -movflags +faststart \
  fixtures/reference_broadcast_hd.mp4

# 2. Problem file — Open GOP (should trigger re-encode)
ffmpeg -f lavfi -i "testsrc2=duration=10:size=1920x1080:rate=25" \
  -c:v libx264 -g 50 \
  -x264-params "open-gop=1:bframes=3" \
  fixtures/problem_open_gop.mp4

# 3. Problem file — VFR (variable frame rate)
ffmpeg -f lavfi -i "testsrc2=duration=10:size=1920x1080:rate=25" \
  -c:v libx264 -vsync vfr \
  fixtures/problem_vfr.mp4

# 4. Problem file — Wrong loudness (-6 LUFS, too loud)
ffmpeg -f lavfi -i "testsrc2=duration=10:size=1920x1080:rate=25" \
  -f lavfi -i "sine=frequency=440:duration=10" \
  -af "volume=10dB" \
  fixtures/problem_loud.mp4

# 5. Problem file — Corrupt (truncated)
head -c 1000000 fixtures/reference_broadcast_hd.mp4 \
  > fixtures/problem_corrupt_truncated.mp4

# 6. Problem file — Wrong pixel format (yuv422p)
ffmpeg -f lavfi -i "testsrc2=duration=5:size=1920x1080:rate=25" \
  -c:v libx264 -pix_fmt yuv422p \
  fixtures/problem_wrong_pixfmt.mp4

# 7. Large file (10 minutes, for performance tests)
ffmpeg -f lavfi -i "testsrc2=duration=600:size=1920x1080:rate=25" \
  -f lavfi -i "anoisesrc=duration=600:sample_rate=48000" \
  -c:v libx264 -preset ultrafast -c:a aac \
  fixtures/large_10min.mp4

═══════════════════════════
UNIT TESTS
═══════════════════════════

QC Rules (100% coverage required — these are safety-critical):

describe('VideoQCRules', () => {
  describe('gopRule', () => {
    it('passes closed GOP with IDR frames', () => {
      const meta = buildMeta({ gopType: 'CLOSED', hasIdrFrames: true });
      expect(gopRule(meta)).toMatchObject({ pass: true });
    });
    it('fails open GOP with severity critical', () => {
      const meta = buildMeta({ gopType: 'OPEN' });
      const result = gopRule(meta);
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.code).toBe('ERR_GOP_OPEN');
    });
    it('fails when sc_threshold not 0 (variable keyframes detected)', () => {
      const meta = buildMeta({ keyframeInterval: 'variable' });
      expect(gopRule(meta).pass).toBe(false);
    });
  });

  describe('cfrRule', () => {
    it('passes constant frame rate', () => {
      expect(cfrRule(buildMeta({ frameRateMode: 'CFR' }))).toMatchObject({ pass: true });
    });
    it('fails VFR with severity critical', () => {
      const result = cfrRule(buildMeta({ frameRateMode: 'VFR' }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
    });
  });

  describe('pixelFormatRule', () => {
    it('passes yuv420p', () => {
      expect(pixelFormatRule(buildMeta({ pixelFormat: 'yuv420p' }))).toMatchObject({ pass: true });
    });
    it('fails yuv422p with severity critical', () => {
      expect(pixelFormatRule(buildMeta({ pixelFormat: 'yuv422p' })).pass).toBe(false);
    });
    it('passes yuv420p10le for HDR profile', () => {
      const meta = buildMeta({ pixelFormat: 'yuv420p10le', profile: 'ott_premium' });
      expect(pixelFormatRule(meta)).toMatchObject({ pass: true });
    });
  });
});

describe('AudioQCRules', () => {
  describe('sampleRateRule', () => {
    it('passes 48000 Hz', () => {
      expect(sampleRateRule(buildAudioMeta({ sampleRate: 48000 }))).toMatchObject({ pass: true });
    });
    it('fails 44100 Hz with severity warning', () => {
      const result = sampleRateRule(buildAudioMeta({ sampleRate: 44100 }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('warning');
    });
  });

  describe('truePeakRule', () => {
    it('passes -1.5 dBTP', () => {
      expect(truePeakRule(buildAudioMeta({ truePeakDbtp: -1.5 }))).toMatchObject({ pass: true });
    });
    it('fails -0.5 dBTP (above limit)', () => {
      expect(truePeakRule(buildAudioMeta({ truePeakDbtp: -0.5 })).pass).toBe(false);
    });
    it('fails 0.0 dBTP with severity critical', () => {
      const result = truePeakRule(buildAudioMeta({ truePeakDbtp: 0.0 }));
      expect(result.pass).toBe(false);
      expect(result.severity).toBe('critical');
    });
  });
});

FFmpeg Command Builder tests:
describe('FFmpegCommandBuilder', () => {
  it('always includes -sc_threshold 0', () => {
    const cmd = builder.buildBroadcastHD(validParams);
    expect(cmd).toContain('-sc_threshold');
    expect(cmd[cmd.indexOf('-sc_threshold') + 1]).toBe('0');
  });
  it('always includes -flags +cgop', () => {
    const cmd = builder.buildBroadcastHD(validParams);
    expect(cmd.join(' ')).toMatch(/-flags.*\+cgop/);
  });
  it('GOP size equals fps * 2', () => {
    const cmd = builder.buildBroadcastHD({ ...validParams, fps: 25 });
    const gIndex = cmd.indexOf('-g');
    expect(cmd[gIndex + 1]).toBe('50');
  });
  it('rejects path traversal in input', () => {
    expect(() => builder.buildBroadcastHD({
      ...validParams, inputPath: '../../../etc/passwd'
    })).toThrow(SecurityError);
  });
  it('rejects pipe character in filename', () => {
    expect(() => builder.buildBroadcastHD({
      ...validParams, inputPath: '/media/input/file|cmd.mp4'
    })).toThrow(SecurityError);
  });
});

═══════════════════════════
INTEGRATION TESTS
═══════════════════════════

Using Testcontainers (real PostgreSQL + Redis in Docker):

describe('QC Pipeline Integration', () => {
  let db: PostgresContainer;
  let redis: RedisContainer;
  
  beforeAll(async () => {
    db = await new PostgresContainer('postgres:15').start();
    redis = await new RedisContainer('redis:7').start();
    await runMigrations(db.getConnectionUri());
  });

  it('rejects corrupt file and creates audit entry', async () => {
    const asset = await ingestFile('fixtures/problem_corrupt_truncated.mp4');
    await runQCPipeline(asset.id);
    
    const updated = await getAsset(asset.id);
    expect(updated.status).toBe('QC_REJECT');
    
    const auditLogs = await getAuditLogs(asset.id);
    expect(auditLogs).toContainEqual(
      expect.objectContaining({ eventType: 'qc_rejected' })
    );
  });

  it('quarantines file with open GOP and notifies', async () => {
    const asset = await ingestFile('fixtures/problem_open_gop.mp4');
    await runQCPipeline(asset.id);
    expect((await getAsset(asset.id)).status).toBe('QC_REJECT');
    // Open GOP is critical → REJECT (not quarantine)
  });

  it('normalises loud audio to -23 LUFS within ±0.5 LU', async () => {
    const asset = await ingestFile('fixtures/problem_loud.mp4');
    await runFullPipeline(asset.id, 'broadcast_hd');
    
    const result = await getAsset(asset.id);
    expect(result.loudnessLufs).toBeGreaterThanOrEqual(-23.5);
    expect(result.loudnessLufs).toBeLessThanOrEqual(-22.5);
    expect(result.truePeakDbtp).toBeLessThanOrEqual(-1.0);
  });
});

═══════════════════════════
E2E API TESTS
═══════════════════════════

describe('POST /api/v1/assets', () => {
  it('returns 202 for valid MP4 upload', async () => {
    const response = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer ${validToken}`)
      .attach('file', 'fixtures/reference_broadcast_hd.mp4')
      .field('profile', 'broadcast_hd');
    
    expect(response.status).toBe(202);
    expect(response.body.data).toMatchObject({
      id: expect.any(String),
      status: 'INGESTED'
    });
  });

  it('returns 422 for disallowed MIME type', async () => {
    const response = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer ${validToken}`)
      .attach('file', 'fixtures/not_a_video.exe');
    
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INVALID_FILE_TYPE');
  });

  it('returns 401 without token', async () => {
    const response = await request(app).post('/api/v1/assets');
    expect(response.status).toBe(401);
  });

  it('rate limits after 1000 requests', async () => {
    // Make 1001 requests, last should be 429
    const responses = await Promise.all(
      Array(1001).fill(null).map(() =>
        request(app).get('/api/v1/assets').set('Authorization', `Bearer ${validToken}`)
      )
    );
    expect(responses.at(-1)!.status).toBe(429);
  });
});

═══════════════════════════
PERFORMANCE TESTS (k6)
═══════════════════════════

// k6/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // ramp up
    { duration: '5m', target: 50 },   // sustained load
    { duration: '2m', target: 100 },  // spike
    { duration: '2m', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% requests < 500ms
    http_req_failed: ['rate<0.01'],     // < 1% error rate
    'http_req_duration{endpoint:status}': ['p(99)<200'], // status checks fast
  },
};

export default function () {
  // Asset status polling (most frequent operation)
  const statusRes = http.get(`${BASE_URL}/api/v1/assets/${ASSET_ID}/status`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    tags: { endpoint: 'status' },
  });
  check(statusRes, { 'status 200': (r) => r.status === 200 });
  
  // Asset list with filters
  const listRes = http.get(`${BASE_URL}/api/v1/assets?status=READY&page=1&pageSize=25`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(listRes, { 'list 200': (r) => r.status === 200 });
  
  sleep(1);
}

PERFORMANCE TARGETS:
- API p95 response time < 500ms (excluding transcode jobs)
- Status endpoint p99 < 200ms
- Asset list (100 items) < 300ms
- Concurrent transcode jobs: 4 simultaneously without degradation
- Queue throughput: 100 jobs/hour minimum
- System recovers from worker crash in < 30 seconds

DELIVERABLES:
1. Complete unit test suite (QC rules, command builder, decision engine)
2. Integration test suite with Testcontainers
3. E2E API test suite (all endpoints)
4. E2E Frontend tests (Playwright — upload flow, asset detail, status updates)
5. Performance test suite (k6 scripts)
6. Fixture generator script (generates all test media files via FFmpeg)
7. CI configuration: run unit + integration in GitHub Actions
8. Coverage report target: 80% lines, 75% branches
9. Test README: how to run each test suite, what fixtures are needed
```

---

---

# ═══════════════════════════════════════════
# PROMPT 9 — QUALQUER IDE
# Integração Open Source: HandBrake + Shutter Encoder + VLC
# ═══════════════════════════════════════════

```
ROLE: Open Source Integration Engineer — Media Processing Hub

Integrate the best open-source media tools as optional workers 
within the existing BullMQ pipeline. These tools complement FFmpeg 
for specific use cases.

TOOLS TO INTEGRATE:

════════════════════════════════
1. HandBrake CLI — Batch Encoding & Presets
════════════════════════════════

USE CASE: Proxy generation and web-optimised outputs.
HandBrakeCLI is faster than raw FFmpeg for these cases because 
its built-in presets are well-optimised and GPU acceleration 
(NVENC/QSV/VCE) is well-tested.

WHEN TO USE HandBrake (decision logic):
  - Profile is 'proxy_lowres' → HandBrake (faster, good enough quality)
  - Profile is 'streaming_web' AND content_type is 'animation' → HandBrake
  - Profile requires broadcast compliance → ALWAYS FFmpeg (HandBrake cannot 
    guarantee Closed GOP + IDR enforcement at same level)

Custom HandBrake presets file (presets/media-hub-presets.json):
{
  "PresetList": [
    {
      "PresetName": "MediaHub_ProxyLowRes",
      "Type": 1,
      "VideoEncoder": "x264",
      "VideoPreset": "veryfast",
      "VideoProfile": "high",
      "VideoLevel": "3.1",
      "VideoQualityType": 1,
      "VideoAvgBitrate": 800,
      "VideoTwoPass": true,
      "VideoTurboTwoPass": true,
      "PictureWidth": 1280,
      "PictureHeight": 720,
      "PictureKeepRatio": true,
      "AudioList": [{
        "AudioEncoder": "copy:aac",
        "AudioBitrate": 128,
        "AudioSamplerate": "48",
        "AudioMixdown": "stereo"
      }],
      "Mp4HttpOptimize": true,
      "Mp4iPodCompatible": false
    },
    {
      "PresetName": "MediaHub_WebOptimized_1080p",
      "Type": 1,
      "VideoEncoder": "x264",
      "VideoPreset": "slow",
      "VideoProfile": "high",
      "VideoLevel": "4.0",
      "VideoQualityType": 1,
      "VideoAvgBitrate": 4000,
      "VideoTwoPass": true,
      "PictureWidth": 1920,
      "PictureHeight": 1080,
      "Mp4HttpOptimize": true
    }
  ]
}

HandBrake worker implementation:
class HandBrakeWorker {
  async encodeProxy(inputPath: string, outputPath: string): Promise<HandBrakeResult> {
    const cmd = [
      '--input', this.sanitizePath(inputPath),
      '--output', this.sanitizePath(outputPath),
      '--preset-import-file', PRESETS_FILE,
      '--preset', 'MediaHub_ProxyLowRes',
      '--json',   // machine-readable progress output
    ];
    
    const result = await this.executor.run('HandBrakeCLI', cmd, {
      timeout: 3600000,  // 1h
      parseProgress: this.parseHandBrakeProgress
    });
    
    // HandBrake does NOT guarantee Closed GOP — verify output with FFprobe
    const verification = await this.verifyGOP(outputPath);
    if (!verification.closedGop) {
      // For proxy, GOP compliance is less critical — log warning only
      this.logger.warn({ assetId: result.assetId }, 
        'Proxy output has open GOP — acceptable for proxy use');
    }
    
    return result;
  }
  
  parseHandBrakeProgress(line: string): Progress | null {
    // HandBrake JSON output: {"Progress": {"State": "WORKING", "Working": {"Progress": 0.45}}}
    try {
      const json = JSON.parse(line);
      if (json.Progress?.State === 'WORKING') {
        return { percent: Math.round(json.Progress.Working.Progress * 100) };
      }
    } catch { return null; }
    return null;
  }
}

════════════════════════════════
2. BS1770GAIN — Standalone Loudness Analysis
════════════════════════════════

USE CASE: Independent loudness measurement to verify FFmpeg 
loudness normalization results. Never rely solely on FFmpeg's 
own measurement of its own output.

bs1770gain \
  --ebu \              # EBU R128 mode
  --integrated \       # Integrated loudness
  --range \            # Loudness range  
  --truepeak \         # True Peak (4x oversampling)
  --xml \              # Machine-parseable XML output
  {input_file}

Parse XML output:
interface BS1770GainResult {
  integratedLufs: number;   // e.g. -23.1
  loudnessRange: number;    // LRA in LU
  truePeakDbtp: number;     // e.g. -1.2
  samplepeak: number;       // Sample peak dBFS
}

Validation logic:
function validateLoudness(result: BS1770GainResult, target: LoudnessTarget): LoudnessQC {
  const lufsDeviation = Math.abs(result.integratedLufs - target.lufs);
  return {
    pass: lufsDeviation <= 0.5 && result.truePeakDbtp <= target.truePeak,
    integratedPass: lufsDeviation <= 0.5,
    truePeakPass: result.truePeakDbtp <= target.truePeak,
    deviation: lufsDeviation,
    measured: result,
    target,
  };
}

════════════════════════════════
3. MediaInfo — Container Analysis
════════════════════════════════

Use MediaInfo for container-level analysis (better than FFprobe 
for container parsing):

mediainfo --Output=JSON {input_file}

Key fields to extract:
- General: Format, Duration, FileSize, OverallBitRate
- Video: Format, Format_Profile, Format_Level, Width, Height,
         FrameRate, FrameRate_Mode (CFR/VFR), BitDepth,
         colour_primaries, transfer_characteristics, matrix_coefficients,
         Stored_Height vs Display_Height (detect anamorphic)
- Audio: Format, SamplingRate, BitDepth, Channels, ChannelLayout,
         Format_Settings_Mode (CBR/VBR)

Build a MediaInfoParser that normalises the JSON output into 
the MediaAnalysis interface used by the Decision Engine.

════════════════════════════════
4. VLC (libvlc) — Playback Verification
════════════════════════════════

USE CASE: Headless playback test of processed output. 
If VLC cannot play a file cleanly, it will likely fail in 
consumer players.

Implementation (server-side headless):
vlc \
  --intf dummy \           # No UI
  --no-video-display \     # No render output
  --play-and-exit \        # Exit when done
  --no-loop \
  --run-time 10 \          # Check first 10 seconds only
  --verbose 2 \            # Log errors
  {output_file} 2>&1

Parse VLC output for:
- "main error" or "main warning" lines → flag issues
- Successful play without errors → PASS
- Use as sanity check after VMAF scoring

NOTE: VLC playback test is optional in the pipeline — run only for 
broadcast_hd and ott_premium profiles as final sanity check.

════════════════════════════════
5. Avidemux (CLI mode) — Frame-accurate Editing
════════════════════════════════

USE CASE: Lossless stream copy for trimming without re-encode,
when ingest point needs trimming but codec is already compliant.

avidemux3_cli \
  --load {input} \
  --set-video-codec copy \
  --set-audio-codec copy \
  --output-format MKV_V \
  --save {output} \
  --quit

USE CASE: Only when action = 'COPY' or 'REMUX' and frame-accurate 
trim is requested. FFmpeg handles the general case.

TOOL SELECTION MATRIX (decision logic):

| Job Type              | Primary Tool  | Fallback      | Notes                     |
|-----------------------|---------------|---------------|---------------------------|
| Broadcast transcode   | FFmpeg        | —             | Only FFmpeg for compliance|
| OTT premium transcode | FFmpeg        | —             | Only FFmpeg for CMAF/DRM  |
| Web/proxy encode      | HandBrakeCLI  | FFmpeg        | HandBrake faster for web  |
| Thumbnail sprites     | FFmpeg        | —             | ffmpeg -vf tile           |
| Loudness measure      | BS1770GAIN    | FFmpeg ebur128| Independent verification  |
| Container analysis    | MediaInfo     | FFprobe       | Both for cross-check      |
| Conformance check     | MediaConch    | —             | No fallback — hard check  |
| VMAF scoring          | FFmpeg libvmaf| —             | libvmaf only              |
| Playback sanity       | VLC headless  | —             | Optional final check      |
| Lossless trim/remux   | FFmpeg        | Avidemux CLI  | FFmpeg preferred          |

DELIVERABLES:
1. HandBrakeWorker with preset management and progress parsing
2. BS1770GainAnalyzer with XML parser and validation logic
3. MediaInfoParser normalising to MediaAnalysis interface
4. VLC headless playback tester
5. ToolSelector: given profile + job type → returns optimal tool
6. Tool availability checker (run at startup, warn if tools missing)
7. Integration tests for each tool adapter (using fixture files)
```

---

---

# ═══════════════════════════════════════════
# PROMPT 10 — TODOS OS AGENTES (Coordenação)
# Protocolo de Comunicação Multi-Agente
# ═══════════════════════════════════════════

```
ROLE: Multi-Agent Coordination Protocol

This document defines how each AI agent should communicate and 
coordinate within the Media Processing Hub development.
Every agent MUST follow this protocol.

═══════════════════════════════════
INTER-AGENT CONTRACT (shared types)
═══════════════════════════════════

All agents share these TypeScript types via a shared package
(@media-hub/shared-types):

// Asset state machine — all agents must respect state transitions
type AssetStatus = 
  | 'INGESTED'          // File received, not yet validated
  | 'QC_PENDING'        // In QC queue
  | 'QC_PASS'           // QC passed, ready for analysis
  | 'QC_QUARANTINE'     // Needs human review
  | 'QC_REJECT'         // Hard rejected, processing stops
  | 'ANALYZING'         // Content analysis in progress
  | 'TRANSCODING'       // Encoding in progress
  | 'AUDIO_PROCESSING'  // Loudness normalization
  | 'POST_QC'           // Post-encode quality check
  | 'DELIVERING'        // Upload in progress
  | 'READY'             // All done, delivered
  | 'FAILED';           // Terminal failure after max retries

// Valid state transitions only (reject invalid transitions):
const VALID_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  INGESTED:         ['QC_PENDING', 'QC_REJECT'],
  QC_PENDING:       ['QC_PASS', 'QC_QUARANTINE', 'QC_REJECT'],
  QC_PASS:          ['ANALYZING'],
  QC_QUARANTINE:    ['QC_PASS', 'QC_REJECT'],  // human resolves
  QC_REJECT:        [],                          // terminal
  ANALYZING:        ['TRANSCODING'],
  TRANSCODING:      ['AUDIO_PROCESSING', 'POST_QC', 'FAILED'],
  AUDIO_PROCESSING: ['POST_QC', 'FAILED'],
  POST_QC:          ['DELIVERING', 'TRANSCODING', 'FAILED'], // TRANSCODING = re-encode
  DELIVERING:       ['READY', 'FAILED'],
  READY:            [],                          // terminal success
  FAILED:           ['QC_PENDING'],              // retry resets to beginning
};

// Every agent emits events in this format
interface AgentEvent {
  event_id: string;      // UUID v4
  timestamp: string;     // ISO 8601 UTC
  asset_id: string;      // UUID v4
  agent: AgentName;
  event_type: string;
  payload: Record<string, unknown>;
  correlation_id?: string; // for request-response tracing
}

type AgentName = 
  | 'ingest_worker'
  | 'qc_worker'
  | 'analyzer_worker'
  | 'transcode_worker'
  | 'audio_worker'
  | 'subtitle_worker'
  | 'proxy_worker'
  | 'post_qc_worker'
  | 'delivery_worker'
  | 'log_analyzer'       // Kimi
  | 'orchestrator';      // Temporal

═══════════════════════════════════
AGENT RESPONSIBILITY MAP
═══════════════════════════════════

AGENT: Claude Code instances
OWNS:
  - All TypeScript source code
  - QC rules engine (video + audio)
  - FFmpeg command builder
  - Security layer (auth, file validation)
  - Audit trail implementation
NEVER DOES:
  - Frontend React components
  - Infrastructure YAML
  - FFmpeg GPU optimization formulas

AGENT: OpenAI Codex / O1
OWNS:
  - Temporal.io workflow definitions
  - Decision Engine logic
  - REST API OpenAPI spec + Fastify routes
  - Integration test suite
NEVER DOES:
  - Frontend styling
  - FFmpeg command generation
  - Security implementation

AGENT: Google Gemini / AI Studio
OWNS:
  - Next.js 14 frontend (App Router)
  - React components
  - Recharts dashboards
  - Playwright E2E tests
NEVER DOES:
  - Backend TypeScript
  - FFmpeg commands
  - Database schema changes

AGENT: DeepSeek Coder
OWNS:
  - FFmpeg command optimization
  - GPU detection and fallback
  - Two-pass loudness implementation
  - VMAF scoring logic
  - Performance benchmarks
NEVER DOES:
  - API design
  - Frontend
  - Security policy

AGENT: Kimi (Long Context)
OWNS:
  - Log parsing and analysis
  - Error pattern matching
  - Debug intelligence
  - Daily digest reports
  - Anomaly detection
NEVER DOES:
  - Source code generation
  - API routes
  - FFmpeg commands (only analyses them)

═══════════════════════════════════
HANDOFF PROTOCOL
═══════════════════════════════════

When one agent completes a component that another depends on:

1. COMMIT: Push to feature branch with clear commit message
   Format: feat(agent): description
   Example: feat(deepseek): add GPU detection with nvenc fallback

2. INTERFACE FIRST: Any new shared interface must be added to
   @media-hub/shared-types BEFORE implementation begins
   No agent may change a shared type unilaterally

3. TEST GATE: No handoff without tests passing:
   npx vitest run src/path/to/component.test.ts
   All tests green before marking as ready

4. DOCUMENT THE CONTRACT: For every function that crosses agent 
   boundaries, document:
   - Input type (exact TypeScript type)
   - Output type
   - Error conditions (what exceptions can it throw)
   - Side effects (DB writes, file writes, events emitted)

═══════════════════════════════════
CONFLICT RESOLUTION
═══════════════════════════════════

If two agents generate conflicting implementations:
1. The implementation with more test coverage wins
2. If equal coverage: the implementation closer to industry standard wins
   (EBU, SMPTE, Apple HLS Authoring Spec take precedence over custom)
3. If still tied: escalate to human architect

Code style conflicts: ESLint + Prettier config is authoritative.
Architecture conflicts: ADR (Architecture Decision Record) required.

═══════════════════════════════════
ADR TEMPLATE (Architecture Decision Record)
═══════════════════════════════════

When any agent makes a significant architectural decision, 
document it in docs/adr/ADR-NNN-title.md:

# ADR-001: Use Temporal.io over BullMQ for workflow orchestration

## Status: ACCEPTED

## Context
[What situation led to this decision]

## Decision
[What was decided and why]

## Consequences
Positive:
- [benefit 1]
Negative:
- [tradeoff 1]

## Alternatives considered
- [Option A]: rejected because [reason]
- [Option B]: rejected because [reason]

Existing ADRs that CANNOT be overridden:
- ADR-001: Temporal.io for workflow orchestration (not BullMQ alone)
- ADR-002: FFmpeg child_process isolation (never inline exec)
- ADR-003: SHA-256 for all checksums (never MD5)
- ADR-004: yuv420p as mandatory pixel format for distribution
- ADR-005: Two-pass EBU R128 with True Peak verification
- ADR-006: Closed GOP + IDR frames mandatory in all broadcast outputs
- ADR-007: Append-only audit trail (no UPDATE/DELETE)
- ADR-008: RS256 JWT with key rotation (not HS256)
```

---

---

# ARQUITECTURA DE COMUNICAÇÃO MULTI-AGENTE

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (Temporal.io)                        │
│          Único ponto de verdade sobre estado de cada asset           │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────────────┘
       │          │          │          │          │
       ↓          ↓          ↓          ↓          ↓
  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
  │  QC    │ │Analyzer│ │Transc. │ │ Audio  │ │Delivery│
  │Worker  │ │Worker  │ │Worker  │ │Worker  │ │Worker  │
  │        │ │        │ │        │ │        │ │        │
  │ Claude │ │Gemini  │ │DeepSeek│ │DeepSeek│ │ Claude │
  │  Code  │ │(Analysis│ │Coder  │ │Coder  │ │  Code  │
  └────┬───┘ └───┬────┘ └───┬────┘ └───┬───┘ └───┬────┘
       │         │          │          │          │
       └────────────────────┴──────────┴──────────┘
                            │
                     ┌──────▼──────┐
                     │  EVENT BUS  │
                     │  (Redis     │
                     │  Streams)   │
                     └──────┬──────┘
                            │
              ┌─────────────┴──────────────┐
              ↓                            ↓
       ┌─────────────┐             ┌──────────────┐
       │  LOG AGENT  │             │  API + FRONT │
       │    (Kimi)   │             │   (Codex +   │
       │             │             │   Gemini)    │
       │ Analisa logs│             │              │
       │ de todos os │             │ Dashboard    │
       │ workers     │             │ Asset mgmt   │
       └─────────────┘             └──────────────┘
```

---

# README DE ARRANQUE RÁPIDO (< 10 comandos)

```bash
# 1. Clonar e instalar dependências
git clone https://github.com/your-org/media-hub && cd media-hub
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com as tuas credenciais

# 3. Gerar fixtures de teste (media files via FFmpeg)
npm run fixtures:generate

# 4. Iniciar infra (PostgreSQL, Redis, MinIO, Temporal)
docker compose up -d postgres redis minio temporal temporal-ui

# 5. Executar migrações e seed
npm run db:migrate && npm run db:seed

# 6. Iniciar backend API
npm run dev

# 7. Iniciar workers (em separado ou com concurrently)
npm run worker

# 8. Iniciar frontend
cd frontend && npm run dev

# 9. Executar testes
npm run test

# 10. Abrir dashboard
open http://localhost:3000        # App
open http://localhost:8080        # Temporal UI
open http://localhost:3001        # Grafana (admin/admin)
open http://localhost:9001        # MinIO console
```

---

# CHECKLIST FINAL DE ACEITAÇÃO

```
INFRAESTRUTURA:
[ ] Docker Compose sobe sem erros com: docker compose up -d
[ ] Todos os health checks passam: GET /health/ready
[ ] Prometheus scraping métricas: GET /metrics
[ ] Grafana dashboard com dados reais visível
[ ] Temporal UI mostra workflows

SEGURANÇA:
[ ] JWT RS256 funciona (gerar token, usar em request, expirar)
[ ] Path traversal rejeitado com 422
[ ] SSRF bloqueado para IPs privados
[ ] FFmpeg nunca chamado com exec() — sempre execFile()
[ ] Audit trail imutável verificado (sem UPDATE/DELETE no DB)
[ ] SHA-256 calculado e verificado em todos os assets

PIPELINE MEDIA:
[ ] Ingest de ficheiro MP4 → status INGESTED em < 5s
[ ] QC de ficheiro conforme → status QC_PASS
[ ] QC rejeita ficheiro corrompido → status QC_REJECT + audit entry
[ ] Transcode broadcast_hd:
    [ ] GOP = fps × 2 verificado com FFprobe pós-encode
    [ ] Closed GOP verificado
    [ ] 0 B-frames verificado
    [ ] sc_threshold = 0 nos parâmetros
    [ ] yuv420p no output
    [ ] moov atom no início (Fast Start)
[ ] Áudio normalizado:
    [ ] Loudness dentro de ±0.5 LU do target
    [ ] True Peak ≤ -1.0 dBTP (verificado com BS1770GAIN)
[ ] VMAF score calculado e guardado no DB
[ ] Proxy LowRes gerado (720p, 800kbps)
[ ] Thumbnail sprite sheet gerado com VTT

OBSERVABILIDADE:
[ ] Métrica media_assets_ingested_total incrementa no Prometheus
[ ] Alerta MediaPipelineStalled configurado no Alertmanager
[ ] Logs em JSON estruturado com asset_id em cada linha
[ ] Temporal UI mostra histórico de workflow completo

QUALIDADE DE CÓDIGO:
[ ] npx tsc --noEmit sem erros
[ ] npx eslint src sem erros
[ ] vitest coverage > 80% linhas
[ ] Todas as QC rules com 100% de coverage de branch
[ ] Nenhum any implícito no TypeScript
[ ] Nenhum secret hardcoded no código

FRONTEND:
[ ] Upload flow completo funcional (drag-drop → progress → asset detail)
[ ] Status updates em tempo real (SSE)
[ ] Dashboard com métricas reais
[ ] QC report visível e exportável
[ ] WCAG 2.1 AA: axe-core sem violations críticas
```

---

*Sistema desenhado para execução distribuída entre agentes AI especializados.*  
*Cada agente tem ownership claro, interfaces definidas e critérios de aceitação mensuráveis.*  
*Stack 100% open-source. Pronto para produção broadcast e OTT.*
