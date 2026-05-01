## karpathy_guidelines

This project strictly follows the Karpathy-Inspired Agent Guidelines for code generation and refactoring.

Rules:
- **Think Before Coding**: Do not assume missing information or hide confusion. Surface tradeoffs and push back if a simpler approach exists. Stop and ask clarifying questions if the task is ambiguous.
- **Simplicity First**: Write the minimum code necessary to solve the problem. Do not add speculative features, unnecessary error handling for impossible scenarios, or bloated abstractions. If 200 lines can be 50, rewrite it.
- **Surgical Changes**: Touch ONLY what is explicitly requested. Do not perform "drive-by" refactorings of adjacent code, formatting, or comments. If you create orphaned code (unused imports/functions), remove ONLY what your changes made unused.
- **Goal-Driven Execution**: Define verifiable success criteria before implementing changes (e.g., "Write a test that reproduces the bug, then make it pass"). For multi-step tasks, always execute verification loops before proceeding to the next step.
