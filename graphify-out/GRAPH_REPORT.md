# Graph Report - Nexora Media Processing  (2026-05-01)

## Corpus Check
- 144 files · ~1,443,757 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1753 nodes · 2674 edges · 76 communities detected
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 257 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]

## God Nodes (most connected - your core abstractions)
1. `DOCXSchemaValidator` - 69 edges
2. `RedliningValidator` - 62 edges
3. `XMLEditor` - 59 edges
4. `BaseSchemaValidator` - 48 edges
5. `Document` - 32 edges
6. `BaseSchemaValidator` - 21 edges
7. `DocxXMLEditor` - 20 edges
8. `NotebookLibrary` - 18 edges
9. `PPTXSchemaValidator` - 15 edges
10. `AuthManager` - 15 edges

## Surprising Connections (you probably didn't know these)
- `writeFile()` --calls--> `createK6Script()`  [INFERRED]
  Arquitetura\nexora_deploy_files_script.js → Arquitetura\nexora_integration_test.ts
- `writeFile()` --calls--> `createPresetsFile()`  [INFERRED]
  Arquitetura\nexora_deploy_files_script.js → Arquitetura\nexora_tool_availability.ts
- `Validator for Word document XML files against XSD schemas.` --uses--> `BaseSchemaValidator`  [INFERRED]
  skills\antigravity-skills-main\skills\pptx\ooxml\scripts\validation\docx.py → skills\antigravity-skills-main\skills\xlsx\scripts\office\validators\base.py
- `Run all validation checks and return True if all pass.` --uses--> `BaseSchemaValidator`  [INFERRED]
  skills\antigravity-skills-main\skills\pptx\ooxml\scripts\validation\docx.py → skills\antigravity-skills-main\skills\xlsx\scripts\office\validators\base.py
- `Validate that w:t elements with whitespace have xml:space='preserve'.` --uses--> `BaseSchemaValidator`  [INFERRED]
  skills\antigravity-skills-main\skills\pptx\ooxml\scripts\validation\docx.py → skills\antigravity-skills-main\skills\xlsx\scripts\office\validators\base.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (67): Document, DocxXMLEditor, _generate_hex_id(), _generate_rsid(), Add a single comment to comments.xml., Ensure w14 namespace is declared on the root element., Add a single comment to commentsExtended.xml., Add a single comment to commentsIds.xml. (+59 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (34): BaseSchemaValidator, _condense_xml(), pack(), Pack a directory into a DOCX, PPTX, or XLSX file.  Validates with auto-repair, c, _run_validation(), main(), Command line tool to validate Office document XML files against XSD schemas and, Base validator with common validation logic for document files. (+26 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (54): AgentSession, _demo(), ImageBuilder, Sandbox Manager for Hosted Agent Infrastructure.  Use when: building background, Read a file from the sandbox filesystem.          Use when: agent needs to inspe, Write a file to the sandbox filesystem.          Use when: agent needs to modify, Create a snapshot of current filesystem state.          Use when: preserving ses, Create snapshot (infrastructure-specific). (+46 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (40): Enum, ProbeType, Types of evaluation probes for compression quality assessment., AgentCommunication, AgentFailureHandler, AgentMessage, ConsensusManager, HandoffProtocol (+32 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (38): buildArchiveCommand(), buildBroadcastHDCommand(), buildOTTPremiumCommand(), buildStreamingWebCommand(), checkNvidiaSmi(), detectGPU(), normalizeAudio(), parseLoudnormJSON() (+30 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (41): calculate_overlap(), collect_shapes_with_absolute_positions(), detect_overlaps(), emu_to_inches(), extract_text_inventory(), get_default_font_size(), get_font_path(), get_inventory_as_dict() (+33 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (28): IntegratedMemorySystem, PropertyGraph, Memory System Implementation.  Provides composable building blocks for agent mem, Search within specific entity.          Use when: the agent needs all memories a, Generate embedding for text.          In production, replace with an actual embe, Create time key for indexing., Check if metadata matches filters., Simple property graph storage.      Use when: the agent needs to maintain entity (+20 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (36): Protocol, _BuiltToolSpec, ErrorMessageGenerator, _generate_errors(), _generate_parameters(), _generate_returns(), generate_tool_description(), generate_usage_context() (+28 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (29): CompressionEvaluator, CriterionResult, evaluate_compression_quality(), EvaluationResult, Probe, ProbeGenerator, Context Compression Evaluation  Public API for evaluating context compression qu, Generate typed probes from conversation history.      Use when: automatically de (+21 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (29): AgentEvaluator, EvaluationRunner, ProductionMonitor, Agent Evaluation Framework for context-engineered agent systems.  Use when: buil, Main evaluation engine for agent outputs.      Use when: scoring a single agent, Evaluate agent output against task requirements.          Use when: you have a s, Evaluate a single dimension.          Use when: extending the evaluator with cus, Check output against ground truth.          Use when: ground truth key_claims ar (+21 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (36): calculate_cache_metrics(), categorize_messages(), ContextBudget, design_stable_prompt(), estimate_message_tokens(), estimate_token_count(), generate_cache_recommendations(), ObservationStore (+28 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (32): ABC, create_connection(), MCPConnection, MCPConnectionHTTP, MCPConnectionSSE, MCPConnectionStdio, Lightweight connection handling for MCP servers., MCP connection using Streamable HTTP. (+24 more)

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (45): call_llm(), extract_field(), extract_list_items(), extract_score(), extract_section(), fetch_items_from_source(), generate_prompt(), get_batch_dir() (+37 more)

### Community 13 - "Community 13"
Cohesion: 0.07
Nodes (29): AgentPlan, _cleanup_demo(), _demo_plan_persistence(), _demo_scratch_pad(), _demo_tool_handler(), load(), PlanStep, Filesystem Context Manager -- composable utilities for filesystem-based context (+21 more)

### Community 14 - "Community 14"
Cohesion: 0.05
Nodes (38): Cursor(), getTypedText(), MyAnimation(), apply_squash_stretch(), calculate_arc_motion(), ease_back_in(), ease_back_in_out(), ease_back_out() (+30 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (19): BaseSchemaValidator, Base validator with common validation logic for document files., Run all validation checks and return True if all pass., Validate that all XML files are well-formed., Validate that namespace prefixes in Ignorable attributes are declared., Validate that specific IDs are unique according to OOXML requirements., Validate that all .rels files properly reference files and that all files are re, Validate that all r:id attributes in XML files reference existing IDs         in (+11 more)

### Community 16 - "Community 16"
Cohesion: 0.08
Nodes (26): build_agent_context(), ContextBuilder, count_tokens_by_type(), estimate_message_tokens(), estimate_token_count(), ProgressiveDisclosureManager, Context Management Utilities for Agent Systems.  Public API ---------- Functions, Build context with priority-aware budget management.      Use when: assembling c (+18 more)

### Community 17 - "Community 17"
Cohesion: 0.08
Nodes (23): analyze_agent_context(), analyze_context_structure(), ContextHealthAnalyzer, detect_lost_in_middle(), _estimate_attention(), measure_attention_distribution(), PoisoningDetector, Context Degradation Detection — Public API ===================================== (+15 more)

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (31): codex_meta_cwd(), codex_planning_update(), extract_messages_after(), find_current_codex_session(), find_last_planning_update(), get_claude_project_dir(), get_codex_sessions(), get_session_candidates() (+23 more)

### Community 19 - "Community 19"
Cohesion: 0.1
Nodes (19): BrowserSession, Get the current latest response text, Wait for and extract the new answer, Reset the chat by reloading the page, Represents a single persistent browser session for NotebookLM      Each session, Close this session and clean up resources, Get information about this session, Check if session has expired (default: 15 minutes) (+11 more)

### Community 20 - "Community 20"
Cohesion: 0.1
Nodes (16): main(), NotebookLibrary, Remove a notebook from the library          Args:             notebook_id: ID of, Update notebook metadata          Args:             notebook_id: ID of notebook, Manages a collection of NotebookLM notebooks with metadata, Get a specific notebook by ID, List all notebooks in the library, Search notebooks by query          Args:             query: Search query (search (+8 more)

### Community 21 - "Community 21"
Cohesion: 0.1
Nodes (11): executeFFprobe(), NexoraFFmpegCommandBuilder, NexoraFFmpegError, NexoraFFmpegTimeout, NexoraSecurityError, analyzeComplexity(), AnalyzerWorker, classifyContent() (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (18): ask_notebooklm(), main(), Ask a question to NotebookLM      Args:         question: Question to ask, AuthManager, main(), Save browser state to disk, Save authentication metadata, Clear all authentication data          Returns:             True if cleared succ (+10 more)

### Community 23 - "Community 23"
Cohesion: 0.1
Nodes (23): generate_html(), main(), Generate HTML report from loop output data. If auto_refresh is True, adds a meta, _call_claude(), improve_description(), main(), Run `claude -p` with the prompt on stdin and return the text response.      Prom, Call Claude to improve the description based on eval results. (+15 more)

### Community 24 - "Community 24"
Cohesion: 0.13
Nodes (14): get_bounding_box_messages(), RectAndField, Test that entry box height is checked against font size, Helper to create a JSON stream from data, Test that adequate entry box height passes, Test that default font size is used when not specified, Test case with no bounding box intersections, Test that missing entry_text doesn't cause height check (+6 more)

### Community 25 - "Community 25"
Cohesion: 0.14
Nodes (21): _ensure_shim(), get_soffice_env(), _needs_shim(), Helper for running LibreOffice (soffice) in environments where AF_UNIX sockets m, run_soffice(), accept_changes(), Accept all tracked changes in a DOCX file using LibreOffice.  Requires LibreOffi, _setup_libreoffice_macro() (+13 more)

### Community 26 - "Community 26"
Cohesion: 0.12
Nodes (20): ensureDir(), log(), ok(), warn(), write(), BM25, detect_domain(), _load_csv() (+12 more)

### Community 27 - "Community 27"
Cohesion: 0.11
Nodes (7): getAudioRules(), getContainerRules(), getVideoRules(), gopSizeRule(), integratedLoudnessRule(), runQCRules(), truePeakRule()

### Community 28 - "Community 28"
Cohesion: 0.13
Nodes (18): BaseHTTPRequestHandler, build_run(), embed_file(), find_runs(), _find_runs_recursive(), generate_html(), get_mime_type(), _kill_port() (+10 more)

### Community 29 - "Community 29"
Cohesion: 0.12
Nodes (4): Entity, initializeSeed(), regenerate(), setup()

### Community 30 - "Community 30"
Cohesion: 0.39
Nodes (16): _can_merge(), _consolidate_text(), _find_elements(), _first_child_run(), _get_child(), _get_children(), _is_adjacent(), _is_run() (+8 more)

### Community 31 - "Community 31"
Cohesion: 0.18
Nodes (10): CleanupManager, main(), Get size of file or directory in bytes, Format size in human-readable form, Manages cleanup of NotebookLM skill data      Features:     - Preview what will, Perform the actual cleanup          Args:             preserve_library: Keep lib, Print a preview of what will be cleaned, Command-line interface for cleanup management (+2 more)

### Community 32 - "Community 32"
Cohesion: 0.16
Nodes (16): apply_font_properties(), apply_paragraph_properties(), apply_replacements(), check_duplicate_keys(), clear_paragraph_bullets(), detect_frame_overflow(), main(), Apply font properties to a text run. (+8 more)

### Community 33 - "Community 33"
Cohesion: 0.14
Nodes (9): GIFBuilder, Remove duplicate or near-duplicate consecutive frames.          Args:, Save frames as optimized GIF for Slack.          Args:             output_path:, Builder for creating optimized GIFs from frames., Initialize GIF builder.          Args:             width: Frame width in pixels, Clear all frames (useful for creating multiple GIFs)., Add a frame to the GIF.          Args:             frame: Frame as numpy array o, Add multiple frames at once. (+1 more)

### Community 34 - "Community 34"
Cohesion: 0.17
Nodes (8): Validator for tracked changes in Word documents., Generate detailed word-level differences using git word diff., Validator for tracked changes in Word documents., Generate word diff using git with character-level precision., Remove tracked changes authored by Claude from the XML root., Main validation method that returns True if valid, False otherwise., Extract text content from Word XML, preserving paragraph structure.          Emp, RedliningValidator

### Community 35 - "Community 35"
Cohesion: 0.18
Nodes (9): main(), Get the correct Python executable to use, Run a script with the virtual environment, Get instructions for manual activation, Main entry point for environment setup, Manages skill-specific virtual environment, Ensure virtual environment exists and is set up, Check if we're already running in the skill's venv (+1 more)

### Community 36 - "Community 36"
Cohesion: 0.45
Nodes (11): _can_merge_tracked(), _find_elements(), _get_author(), _get_authors_from_docx(), get_tracked_change_authors(), infer_author(), _is_element(), _merge_tracked_changes_in() (+3 more)

### Community 37 - "Community 37"
Cohesion: 0.22
Nodes (8): broadcast(), computeAcceptKey(), encodeFrame(), getNewestScreen(), handleMessage(), handleRequest(), handleUpgrade(), touchActivity()

### Community 38 - "Community 38"
Cohesion: 0.2
Nodes (4): authMiddleware(), getPublicKey(), registerPlugins(), registerRateLimiter()

### Community 39 - "Community 39"
Cohesion: 0.3
Nodes (11): add_comment(), _append_xml(), _encode_smart_quotes(), _ensure_comment_content_types(), _ensure_comment_relationships(), _find_para_id(), _generate_hex_id(), _get_next_rid() (+3 more)

### Community 40 - "Community 40"
Cohesion: 0.24
Nodes (11): aggregate_results(), calculate_stats(), generate_benchmark(), generate_markdown(), load_run_results(), main(), Aggregate run results into summary statistics.      Returns run_summary with sta, Generate complete benchmark.json from run results. (+3 more)

### Community 41 - "Community 41"
Cohesion: 0.33
Nodes (10): clean_unused_files(), get_referenced_files(), get_slide_referenced_files(), get_slides_in_sldidlst(), Remove unreferenced files from an unpacked PPTX directory.  Usage: python clean., remove_orphaned_files(), remove_orphaned_rels_files(), remove_orphaned_slides() (+2 more)

### Community 42 - "Community 42"
Cohesion: 0.18
Nodes (10): create_blank_frame(), create_gradient_background(), draw_circle(), draw_star(), draw_text(), Create a vertical gradient background.      Args:         width: Frame width, Draw a 5-pointed star.      Args:         frame: PIL Image to draw on         ce, Create a blank frame with solid color background.      Args:         width: Fram (+2 more)

### Community 44 - "Community 44"
Cohesion: 0.29
Nodes (9): delete_slide(), duplicate_slide(), main(), Delete a slide from the presentation., Move a slide from one position to another., Create a new presentation with slides from template in specified order.      Arg, Duplicate a slide in the presentation., rearrange_presentation() (+1 more)

### Community 45 - "Community 45"
Cohesion: 0.39
Nodes (7): condense_xml(), main(), pack_document(), Strip unnecessary whitespace and remove comments., Pack a directory into an Office file (.docx/.pptx/.xlsx).      Args:         inp, Validate document by converting to HTML with soffice., validate_document()

### Community 46 - "Community 46"
Cohesion: 0.33
Nodes (6): get_field_info(), get_full_annotation_field_id(), make_field_dict(), write_field_info(), fill_pdf_fields(), validation_error_for_field_value()

### Community 47 - "Community 47"
Cohesion: 0.44
Nodes (7): _add_to_content_types(), _add_to_presentation_rels(), create_slide_from_layout(), duplicate_slide(), _get_next_slide_id(), get_next_slide_number(), Add a new slide to an unpacked PPTX directory.  Usage: python add_slide.py <unpa

### Community 48 - "Community 48"
Cohesion: 0.28
Nodes (7): main(), package_skill(), Check if a path should be excluded from packaging., Package a skill folder into a .skill file.      Args:         skill_path: Path t, should_exclude(), Basic validation of a skill, validate_skill()

### Community 49 - "Community 49"
Cohesion: 0.25
Nodes (7): direct_scoring_example(), pairwise_comparison_example(), Advanced Evaluation Example  Use when: building LLM-as-judge evaluation pipeline, Compare two responses with position-swapped bias mitigation.      Use when: eval, Generate a domain-specific scoring rubric for consistent evaluation.      Use wh, Rate a single response against defined criteria using direct scoring.      Use w, rubric_generation_example()

### Community 50 - "Community 50"
Cohesion: 0.46
Nodes (7): addBackground(), addElements(), extractSlideData(), getBodyDimensions(), html2pptx(), validateDimensions(), validateTextBoxPosition()

### Community 51 - "Community 51"
Cohesion: 0.67
Nodes (4): _escape_smart_quotes(), _pretty_print_xml(), Unpack Office files (DOCX, PPTX, XLSX) for editing.  Extracts the ZIP archive, p, unpack()

### Community 52 - "Community 52"
Cohesion: 0.38
Nodes (6): init_skill(), main(), # TODO: Add actual script logic here, Convert hyphenated skill name to Title Case for display., Initialize a new skill directory with template SKILL.md.      Args:         skil, title_case_skill_name()

### Community 53 - "Community 53"
Cohesion: 0.47
Nodes (5): ensure_venv(), get_venv_python(), main(), Get the virtual environment Python executable, Ensure virtual environment exists

### Community 54 - "Community 54"
Cohesion: 0.53
Nodes (4): combineGraphs(), extractDotBlocks(), main(), renderToSvg()

### Community 55 - "Community 55"
Cohesion: 0.47
Nodes (5): main(), Setup LibreOffice macro for recalculation if not already configured, Recalculate formulas in Excel file and report any errors          Args:, recalc(), setup_libreoffice_macro()

### Community 57 - "Community 57"
Cohesion: 0.5
Nodes (4): is_slack_ready(), Quick check if GIF is ready for Slack.      Args:         gif_path: Path to GIF, Validate GIF for Slack (dimensions, size, frame count).      Args:         gif_p, validate_gif()

### Community 60 - "Community 60"
Cohesion: 0.5
Nodes (1): CompressionEvaluatorTests

### Community 61 - "Community 61"
Cohesion: 0.67
Nodes (3): extract_form_structure(), main(), Extract form structure from a non-fillable PDF.  This script analyzes the PDF to

### Community 62 - "Community 62"
Cohesion: 0.83
Nodes (3): fill_pdf_form(), transform_from_image_coords(), transform_from_pdf_coords()

### Community 64 - "Community 64"
Cohesion: 0.67
Nodes (3): is_server_ready(), main(), Wait for server to be ready by polling the port.

### Community 66 - "Community 66"
Cohesion: 0.67
Nodes (1): main()

### Community 67 - "Community 67"
Cohesion: 0.67
Nodes (2): ensure_venv_and_run(), Ensure virtual environment exists and run the requested script.     This is call

### Community 68 - "Community 68"
Cohesion: 0.67
Nodes (2): format_output(), Format results for Claude consumption (token-optimized)

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (1): Configuration for NotebookLM Skill Centralizes constants, selectors, and paths

### Community 75 - "Community 75"
Cohesion: 1.0
Nodes (1): Load a plan from *path*.          Use when: resuming work in a new context windo

### Community 76 - "Community 76"
Cohesion: 1.0
Nodes (1): Create the connection context based on connection type.

### Community 77 - "Community 77"
Cohesion: 1.0
Nodes (1): Launch a persistent browser context with anti-detection features         and coo

### Community 78 - "Community 78"
Cohesion: 1.0
Nodes (1): Inject cookies from state.json if available

### Community 79 - "Community 79"
Cohesion: 1.0
Nodes (1): Type with human-like speed

### Community 80 - "Community 80"
Cohesion: 1.0
Nodes (1): Click with realistic movement

### Community 85 - "Community 85"
Cohesion: 1.0
Nodes (1): Convert EMUs (English Metric Units) to inches.

### Community 86 - "Community 86"
Cohesion: 1.0
Nodes (1): Convert inches to pixels at given DPI.

### Community 87 - "Community 87"
Cohesion: 1.0
Nodes (1): Get the font file path for a given font name.          Args:             font_na

### Community 88 - "Community 88"
Cohesion: 1.0
Nodes (1): Get slide dimensions from slide object.          Args:             slide: Slide

### Community 89 - "Community 89"
Cohesion: 1.0
Nodes (1): Calculate paragraphs from the shape's text frame.

### Community 90 - "Community 90"
Cohesion: 1.0
Nodes (1): Check if shape has any issues (overflow, overlap, or warnings).

## Knowledge Gaps
- **512 isolated node(s):** `Advanced Evaluation Example  Use when: building LLM-as-judge evaluation pipeline`, `Rate a single response against defined criteria using direct scoring.      Use w`, `Compare two responses with position-swapped bias mitigation.      Use when: eval`, `Generate a domain-specific scoring rubric for consistent evaluation.      Use wh`, `Context Compression Evaluation  Public API for evaluating context compression qu` (+507 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 60`** (4 nodes): `test_compression_evaluator.py`, `CompressionEvaluatorTests`, `.test_json_ground_truth_terms_score_when_response_mentions_artifacts()`, `.test_plain_text_ground_truth_still_uses_substring_match()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (3 nodes): `main()`, `validate.py`, `validate.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (3 nodes): `ensure_venv_and_run()`, `Ensure virtual environment exists and run the requested script.     This is call`, `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (3 nodes): `format_output()`, `Format results for Claude consumption (token-optimized)`, `search.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (2 nodes): `Configuration for NotebookLM Skill Centralizes constants, selectors, and paths`, `config.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (1 nodes): `Load a plan from *path*.          Use when: resuming work in a new context windo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (1 nodes): `Create the connection context based on connection type.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (1 nodes): `Launch a persistent browser context with anti-detection features         and coo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (1 nodes): `Inject cookies from state.json if available`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (1 nodes): `Type with human-like speed`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (1 nodes): `Click with realistic movement`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (1 nodes): `Convert EMUs (English Metric Units) to inches.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (1 nodes): `Convert inches to pixels at given DPI.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (1 nodes): `Get the font file path for a given font name.          Args:             font_na`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (1 nodes): `Get slide dimensions from slide object.          Args:             slide: Slide`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (1 nodes): `Calculate paragraphs from the shape's text frame.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 90`** (1 nodes): `Check if shape has any issues (overflow, overlap, or warnings).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DOCXSchemaValidator` connect `Community 0` to `Community 1`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `Validation modules for Word document processing.` connect `Community 0` to `Community 1`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `BaseSchemaValidator` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Are the 53 inferred relationships involving `DOCXSchemaValidator` (e.g. with `Validation modules for Word document processing.` and `DocxXMLEditor`) actually correct?**
  _`DOCXSchemaValidator` has 53 INFERRED edges - model-reasoned connections that need verification._
- **Are the 52 inferred relationships involving `RedliningValidator` (e.g. with `Validation modules for Word document processing.` and `DocxXMLEditor`) actually correct?**
  _`RedliningValidator` has 52 INFERRED edges - model-reasoned connections that need verification._
- **Are the 47 inferred relationships involving `XMLEditor` (e.g. with `DocxXMLEditor` and `Document`) actually correct?**
  _`XMLEditor` has 47 INFERRED edges - model-reasoned connections that need verification._
- **Are the 25 inferred relationships involving `BaseSchemaValidator` (e.g. with `DOCXSchemaValidator` and `Validator for Word document XML files against XSD schemas.`) actually correct?**
  _`BaseSchemaValidator` has 25 INFERRED edges - model-reasoned connections that need verification._