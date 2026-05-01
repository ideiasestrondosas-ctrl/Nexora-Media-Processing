# Graph Report - Nexora Media Processing  (2026-05-01)

## Corpus Check
- 12 files · ~963,423 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 151 nodes · 207 edges · 10 communities detected
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]

## God Nodes (most connected - your core abstractions)
1. `executeFFmpeg()` - 9 edges
2. `NexoraFFmpegCommandBuilder` - 9 edges
3. `writeFile()` - 8 edges
4. `transcodeAsset()` - 7 edges
5. `runQCRules()` - 5 edges
6. `normalizeAudio()` - 4 edges
7. `verifyWithBS1770GAIN()` - 4 edges
8. `detectGPU()` - 4 edges
9. `log()` - 4 edges
10. `write()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `normalizeAudio()` --calls--> `executeFFmpeg()`  [INFERRED]
  nexora_audio_worker.ts → nexora_ffmpeg_executor.ts
- `verifyWithFFmpegEbur128()` --calls--> `executeFFmpeg()`  [INFERRED]
  nexora_audio_worker.ts → nexora_ffmpeg_executor.ts
- `transcodeAsset()` --calls--> `executeFFmpeg()`  [INFERRED]
  nexora_audio_worker.ts → nexora_ffmpeg_executor.ts
- `createK6Script()` --calls--> `writeFile()`  [INFERRED]
  nexora_integration_test.ts → nexora_deploy_files_script.js
- `generateSpriteVTT()` --calls--> `writeFile()`  [INFERRED]
  nexora_qc_worker.ts → nexora_deploy_files_script.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (11): buildQCInput(), computeFileSHA256(), DeliveryWorker, generateSpriteVTT(), getAssetDuration(), getMediaInfoJSON(), IngestWorker, ProxyWorker (+3 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (7): getAudioRules(), getContainerRules(), getVideoRules(), gopSizeRule(), integratedLoudnessRule(), runQCRules(), truePeakRule()

### Community 2 - "Community 2"
Cohesion: 0.17
Nodes (7): executeFFmpeg(), QCPostWorker, burnInSubtitles(), convertSRTtoTTML(), convertSRTtoWebVTT(), extractEmbeddedSubtitles(), SubtitleWorker

### Community 3 - "Community 3"
Cohesion: 0.21
Nodes (8): ensureDir(), fail(), log(), ok(), warn(), writeFile(), createK6Script(), createPresetsFile()

### Community 4 - "Community 4"
Cohesion: 0.28
Nodes (12): buildArchiveCommand(), buildBroadcastHDCommand(), buildOTTPremiumCommand(), buildStreamingWebCommand(), checkNvidiaSmi(), detectGPU(), normalizeAudio(), parseLoudnormJSON() (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.2
Nodes (4): authMiddleware(), getPublicKey(), registerPlugins(), registerRateLimiter()

### Community 6 - "Community 6"
Cohesion: 0.27
Nodes (7): executeFFprobe(), analyzeComplexity(), AnalyzerWorker, classifyContent(), decideProcessing(), estimateDuration(), getBitrateMultiplier()

### Community 8 - "Community 8"
Cohesion: 0.22
Nodes (3): NexoraFFmpegError, NexoraFFmpegTimeout, NexoraSecurityError

### Community 9 - "Community 9"
Cohesion: 0.42
Nodes (1): NexoraFFmpegCommandBuilder

### Community 10 - "Community 10"
Cohesion: 0.67
Nodes (5): ensureDir(), log(), ok(), warn(), write()

## Knowledge Gaps
- **Thin community `Community 9`** (9 nodes): `NexoraFFmpegCommandBuilder`, `.buildBroadcastHD()`, `.buildLoudnessAnalysis()`, `.buildProxyLowRes()`, `.buildThumbnailSprites()`, `.buildVMAFScore()`, `.calcGopSize()`, `.validateBitrate()`, `.validateInputPath()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `executeFFmpeg()` connect `Community 2` to `Community 8`, `Community 0`, `Community 4`?**
  _High betweenness centrality (0.228) - this node is a cross-community bridge._
- **Why does `executeFFprobe()` connect `Community 6` to `Community 8`, `Community 0`?**
  _High betweenness centrality (0.206) - this node is a cross-community bridge._
- **Why does `runQCRules()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.189) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `executeFFmpeg()` (e.g. with `normalizeAudio()` and `verifyWithFFmpegEbur128()`) actually correct?**
  _`executeFFmpeg()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `writeFile()` (e.g. with `createK6Script()` and `generateSpriteVTT()`) actually correct?**
  _`writeFile()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._