# Antigravity Operating System (OS)

This document summarizes the core components, rules, and capabilities that drive my development process.

## 1. Core Operating Principles

### Planning Mode (Mandatory for Complexity)
Every non-trivial task follows this flow:
1.  **Research**: Understand the codebase and requirements.
2.  **Implementation Plan**: Create a detailed plan (`implementation_plan.md`) for user approval.
3.  **Task Tracking**: Break down work into a checklist (`task.md`).
4.  **Execution**: Write code following the plan.
5.  **Verification**: Test and document results in a `walkthrough.md`.

### Web & Design Excellence
- **Premium Aesthetics**: No "minimal" MVPs. Designs must be "WOW" (vibrant colors, glassmorphism, animations).
- **Modern Tech**: HTML/JS logic, Vanilla CSS for styling (unless Tailwind is requested).
- **SEO & SEM**: Built-in best practices for every page.

### Technical Discipline
- **Systematic Debugging**: Follow a rigid process to identify root causes before fixing.
- **Test-Driven Development (TDD)**: Write tests first to ensure reliability.
- **Documentation**: Maintain comments, docstrings, and technical manuals.

---

## 2. Superpowers (Skills)

I have a specialized library of skills that I invoke whenever they apply. The most relevant for your new project are:

| Skill | Purpose |
| :--- | :--- |
| `brainstorming` | **(First Step)** Explore intent and design before any code is written. |
| `writing-plans` | Create structured implementation blueprints. |
| `ui-ux-pro-max` | Advanced design patterns, color palettes, and UX guidelines. |
| `frontend-design` | Build distinctive, production-grade interfaces. |
| `systematic-debugging` | Logical, step-by-step bug resolution. |
| `test-driven-development` | Ensures code quality through automated testing. |
| `verification-before-completion` | Final check to ensure requirements are met. |

---

## 3. MCP (Model Context Protocol) Servers

Currently, I use the **GitHub MCP Server**, which allows me to:
- List, search, and manage **Issues** and **Pull Requests**.
- Read and write files directly to the repository.
- Create branches, forks, and tags.
- Search code globally across GitHub.

---

## 4. Transitioning to `nexora-desktop`

To use me with everything I have now for your new project:

### Workspace Separation
1.  **Create the Directory**: Start a new directory `c:\Dev\nexora-desktop`.
2.  **Open in Claude Code**: Launch a new session in that directory.
3.  **Knowledge Carry-over**: 
    - I can use the `Knowledge Items (KIs)` system. I can generate a KI for the current project that I can then read in the new project.
    - Or, you can simply keep this conversation open and "share" context by asking me to reference specific files or patterns from `Nexora Media Processing`.

### Persistent Context
I use **Conversation Logs** and **Knowledge Items** to remember past decisions. If you reference this Conversation ID (`36f25891-f7ee-4fc7-8954-9767a452f04d`) in a new session, I can look back at what we've done here.

### Recommended Stack for Nexora Desktop
Since you want Windows, Mac, and Linux support:
- **Tauri** (Highly recommended: Uses Rust for backend, any web tech for frontend. Small, fast, secure).
- **Electron** (Industry standard, uses Chromium. Larger bundle, very flexible).
- **Flutter** (Excellent for native feel, uses Dart).
