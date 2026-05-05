# Changelog

## [1.1.2] - 2026-05-06

### Added
- feat: Optimizing Nexora CLI Scripting



## [1.1.1] - 2026-05-05

### Added
- feat: System Versioning And Performance Optimization



## [1.1.0] - 2026-05-05

### Added
- feat: Reviewing Project Configuration Assets



## [1.0.1] - 2026-05-05

### Added
- fix: final sync script test



All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] â€” 2026-05-05

### Added

#### Core Pipeline
- Complete 10-stage media processing pipeline: Ingest â†’ QC Pre â†’ Transcode â†’ Audio â†’ Subtitle â†’ QC Post â†’ Delivery
- BullMQ job queues with dead-letter queue, exponential retry, and Redis persistence
- Temporal.io workflow orchestration with durable retry, quarantine signals, and human approval
- SHA-256 stream checksums on ingest (MD5 prohibited â€” ADR-003)
- GPU auto-detection (NVIDIA NVENC / Intel QSV / AMD AMF) with automatic CPU fallback (ADR-007)

#### Quality & Compliance
- VMAF scoring via libvmaf for all transcoded outputs (ADR-010) â€” thresholds: archive â‰¥93, broadcast â‰¥90, OTT â‰¥85, proxy â‰¥70
- Two-pass EBU R128 loudness normalisation with BS1770GAIN independent verification (ADR-005 / ADR-009)
- MediaConch policy validation for AS-11 UK DPP and IMF Basic (SMPTE ST 2067-2)
- Subtitle conversion SRT â†’ TTML/WebVTT with timing validation (CPS, overlap, sync offset)

#### Encoding Profiles
- `broadcast-hd` â€” MXF OP1a + H.264 8 Mbps, Closed GOP, 0 B-frames, yuv420p (ADR-004 / ADR-006)
- `ott-premium` â€” CMAF + H.265 5 Mbps, 2-pass
- `streaming-web` â€” MP4 + H.264 2 Mbps, 720p
- `proxy` â€” MP4 480p 800 kbps, fast preset
- `archive` â€” MXF + ProRes lossless

#### Diagnostics & Observability
- `NexoraPatternMatcher` â€” 24 error patterns across FFmpeg, MediaInfo, MediaConch, BullMQ, BS1770GAIN
  - New in v1.0.0: 8 corrupted video stream patterns (CORRUPTED_HEADER, TRUNCATED_FILE, CORRUPTED_FRAMES, MISSING_REFERENCE_FRAMES, BITSTREAM_CORRUPTION, AUDIO_SYNC_DRIFT, INTERLACE_MISMATCH, CONTAINER_CORRUPTION)
- `NexoraFixSuggester` â€” 13 automated fix suggestions with FFmpeg flag aggregation
  - New in v1.0.0: FIX_ERR_DETECT, FIX_COPY_UNKNOWN, FIX_ASYNC_AUDIO, FIX_DEINTERLACE
- `NexoraAnomalyDetector` â€” z-score with Welford algorithm, 6 metrics, ring buffer 100 values
- `NexoraDailyDigest` â€” automated 24h aggregate report with recommendations at 06:00 UTC
- Prometheus metrics â€” 25+ counters/histograms/gauges (http, pipeline, quality, infra, tools)
- Grafana dashboards â€” nexora-overview, nexora-quality, nexora-infra
- Real-time SSE log streaming with rule-based diagnostic engine

#### API & Security
- REST API v1 â€” 20+ endpoints under `/api/v1` (Fastify + Swagger/OpenAPI)
- JWT RS256 4096-bit authentication â€” access 15min + refresh 7 days with rotation
- Replay attack detection â€” revokes all tokens on re-use of refresh token
- Rate limiting â€” Redis-backed, per-user, granular per-route limits
- Upload validation â€” magic bytes (10 formats) + MIME + size
- `NexoraPathSanitizer` â€” path traversal guard (ADR-002 compliant)
- `NexoraSSRFGuard` â€” blocklist RFC 1918, loopback, cloud metadata (169.254.169.254)
- Append-only audit trail in PostgreSQL with RLS (UPDATE/DELETE blocked â€” ADR-007)
- Security headers via Helmet (CSP, HSTS, X-Frame-Options: DENY)

#### Storage
- MinIO/S3-compatible cloud storage with bucket auto-init
- Local disk storage with configurable path (admin-only)
- Automatic backup rotation â€” `GET /system/backup`, `GET /system/backups`, `DELETE /system/backups/:filename`
  - Configurable: `NEXORA_BACKUP_MAX_COUNT` (default: 10), `NEXORA_BACKUP_MAX_AGE_DAYS` (default: 30), `NEXORA_BACKUP_MAX_SIZE_MB` (default: 500)

#### Frontend
- Next.js 14 dashboard with real-time Prometheus metrics charts
- Asset management (upload, list, detail, soft delete, quarantine review)
- Queue monitoring with BullMQ stats per worker
- Encoding profile management with resolution configuration
- User management with RBAC
- HTML5 video player preview in asset detail
- Real-time log terminal with diagnostic highlighting
- **User Manual popup** â€” in-header Dialog with 6 sections: Dashboard, Assets, Upload, Encoding, HOW-TO, Security
- Dark/light mode

#### Infrastructure
- Docker Compose â€” 9 services: nexora-api, nexora-worker, postgres, redis, minio, temporal, node-exporter, cAdvisor, alertmanager
- GitHub Actions CI/CD â€” test.yml, build.yml, deploy-staging.yml, deploy-prod.yml
- Prometheus + Alertmanager â€” 9 alert rules (pipeline + quality + infra)
- PowerShell CLI â€” `nexora.ps1` with start, stop, status, logs, reset commands

#### Testing
- 22 unit tests (QC rules, diagnostic engine, FFmpeg builder)
- Integration tests with Testcontainers (PostgreSQL + Redis)
- Playwright E2E tests (upload flow, dashboard)
- k6 performance/load tests (100 VUs)
- Vitest with 80% coverage threshold

#### Open Source Adapters
- `mediainfoAdapter` â€” type-safe MediaInfo JSON (VideoMetadata, AudioMetadata, ContainerMetadata)
- `mediaconchAdapter` â€” AS-11 UK DPP and IMF Basic policy validation
- `bs1770gainAdapter` â€” EBU R128 measurement, single XML parsing source
- `handbrakeAdapter` â€” proxy generation with Nexora presets
- `toolRegistry` â€” availability check for 7 external tools on startup

---

## [0.1.0] â€” 2026-05-03

> Initial development â€” internal only, not publicly released.

- 10/10 development prompts completed
- Core architecture established
- All ADRs defined (ADR-001 through ADR-010)

---

[1.0.0]: https://github.com/ideiasestrondosas-ctrl/Nexora-Media-Processing/releases/tag/v1.0.0
[0.1.0]: https://github.com/ideiasestrondosas-ctrl/Nexora-Media-Processing/compare/v0.1.0...v1.0.0




