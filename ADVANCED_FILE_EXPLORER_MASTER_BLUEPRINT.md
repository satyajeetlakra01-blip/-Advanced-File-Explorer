# Advanced File Explorer — Master Project Blueprint

> **Project Scope:** Architectural blueprint and specification for the Advanced File Explorer desktop application. It defines system requirements, foundational architecture, design principles, and verification guidelines.

**Project type:** Windows-first desktop file manager  
**Working product name:** Advanced File Explorer  
**Primary goal:** Build a reliable, modern file-management application that gives users strong control over files and folders, with clear folder statistics and storage analysis.  
**Primary user:** A Windows user who wants an informative, capable, and efficient alternative to the standard file-browsing experience.  

---

## 1. Project Objectives

The project follows a structured engineering approach across architecture, user experience, and automated verification:

1. Maintain system integrity and stability across all core file-management features.
2. Structure modules with clear separation of concerns (UI layer, background worker threads, and IPC abstraction).
3. Ensure comprehensive test coverage across file operations, search indexing, and UI virtualization.
4. Maintain foundational documentation in `docs/` covering requirements, architecture, UX specifications, implementation schedules, and acceptance criteria.
5. Provide clear error diagnostics, cancellation mechanics, and permission handling for all long-running operations.

## 2. Product Vision and Design Principles

The app should be more than a visual skin over the standard file manager. It should provide practical capabilities, dependable file operations, clear feedback, and useful information that is otherwise difficult to see at a glance.

Use these principles when making decisions:

- **Useful before flashy:** Every prominent feature must solve a real file-management problem.
- **Correctness before speed:** Never show fabricated file counts, sizes, scan completion, or operation success.
- **Visible system state:** Show progress, cancellation, permissions issues, failures, and whether a result is complete, cached, estimated, or still scanning.
- **Safe file operations:** Protect users against accidental data loss. Confirm destructive or bulk actions, clearly explain the impact, and provide undo or recovery where technically possible.
- **Respect existing work:** Build on the current repository and preserve functioning features unless a documented reason requires change.
- **Performance:** Keep the interface responsive while scanning large directories, searching, copying files, or calculating sizes.
- **Privacy:** Do not upload, transmit, or index user file contents remotely unless a separately documented feature explicitly requires it and the user gives informed consent.
- **Accessible and predictable:** Support keyboard navigation, understandable labels, scalable layouts, and consistent interactions.
- **Honest limitations:** Report inaccessible directories, links that cannot be followed safely, files that change during scanning, and any totals that could not be calculated.
- **Evidence-based engineering:** Verify important behavior with code inspection, tests, builds, and UI checks instead of relying only on screenshots or assumptions.

## 3. The Five Foundational Documentation Files

Create exactly these **five foundational documentation files** for this project, in the order below. Use the existing documentation folder if one is already established; otherwise use a clear `docs/` directory. If equivalent files already exist, update them in place rather than creating duplicates. This master blueprint is the initiating brief; it does not count as one of the five files.

### File 1 — `PRD.md` (Product Requirements Document)

**Why it exists:** It defines the product, target user, problems to solve, scope, priorities, and what “done” means. It prevents the project from becoming a collection of disconnected features.

Include:

- Product vision, target users, user problems, and measurable goals.
- Main use cases and user journeys.
- Functional requirements, each with a stable identifier such as `FR-001`.
- Non-functional requirements: reliability, performance, accessibility, privacy, safety, and maintainability.
- Feature priorities: **MVP**, **Next**, and **Later**. Do not try to implement every advanced feature in the first release.
- Explicit out-of-scope items and assumptions.
- Acceptance criteria for every MVP capability.
- Risks, constraints, dependencies, and open questions.
- A clear distinction between a planned feature, an implemented feature, and a verified feature.

The PRD must cover the core file manager, navigation, selection, file operations, search, folder inspection, storage analysis, error handling, and user control over long-running tasks.

### File 2 — `ARCHITECTURE.md` (System Architecture and Repository Map)

**Why it exists:** It explains how the application is organized and how the main parts communicate. It gives future agents a map to follow before changing code.

Include:

- A factual map of the current repository: folders, key source files, entry points, configuration, dependencies, build system, and test setup.
- The current technology stack, based on inspection—not guesswork.
- A high-level architecture diagram using Mermaid if it improves clarity.
- Responsibilities and boundaries for the UI, application/services layer, filesystem abstraction, background work, scanning/indexing/cache, settings, and persistence, as relevant to the actual stack.
- Main data flows for browsing a directory, scanning a folder tree, searching, and executing a file operation.
- Threading/async strategy so large scans and I/O do not freeze the UI.
- Error propagation, logging, cancellation, cache invalidation, and permission handling.
- Security considerations for path handling, symbolic links/reparse points, archive extraction, and destructive actions.
- Decisions already established, proposed decisions, and unresolved architecture questions—label each accurately.
- Build and test entry points discovered in the repository.

Do not force a preferred framework into an established project. If an architectural change seems necessary, document its benefits, risks, migration cost, and alternatives before making it.

### File 3 — `UX_UI_SPEC.md` (User Experience and Interface Specification)

**Why it exists:** It establishes how the application should look and behave so different implementation tasks produce one coherent product rather than disconnected screens.

Include:

- Main application layout and navigation model.
- File-list view modes, selection behavior, sorting, filtering, breadcrumbs/path entry, tabs, and optional dual-pane behavior according to feature priority.
- A consistent design system: typography, spacing, icon style, colors, surfaces, focus states, and component patterns. Follow the existing app's design language if it is already established and suitable.
- Loading, empty, error, permission-denied, stale-cache, and completed states.
- Keyboard shortcuts, context menus, accessible labels, focus order, and confirmation dialogs.
- Responsive behavior for the window resizing and supported display scaling.
- Interaction notes or lightweight text wireframes for major screens.
- A clear distinction between essential MVP UI and later enhancements.

#### Required design: Folder Inspector

When a user selects a folder, the UI should expose a visible **Folder Inspector** panel or equivalent easy-to-reach view. It should not require opening a separate Properties dialog every time.

At minimum, plan for:

- Selected folder name and full path.
- Total file count within that folder tree, including nested directories.
- Total subfolder count, including nested subfolders, with a separately labelled direct-child count if useful.
- Combined size of files inside the folder tree.
- Direct contents versus recursive totals, clearly differentiated.
- Largest child folders and largest files where feasible.
- Optional breakdown by file type, empty-folder count, hidden-item count, and last-modified information when reliable and appropriate.
- Scan state: not scanned, scanning, complete, partial, cancelled, or stale.
- Progress feedback and cancellation for long scans.
- An understandable summary of inaccessible locations or items that could not be counted.

Use **illustrative mock values only** in design examples and label them as examples. Never imply mock values are live measurements.

### File 4 — `IMPLEMENTATION_PLAN.md` (Engineering Roadmap and Task Breakdown)

**Why it exists:** It turns requirements and architecture into a sequenced, testable work plan. It helps the coding agent work in small, reviewable steps and avoid uncontrolled rewrites.

Include:

- Phases, dependencies, deliverables, and completion criteria.
- A task breakdown linked to PRD requirement IDs and test IDs where practical.
- Files/modules expected to change, based on the actual repository audit.
- A phased approach such as:
  1. Repository audit and baseline build.
  2. Navigation and core file/folder listing.
  3. Safe, reliable core file operations.
  4. Folder Inspector and recursive storage scan.
  5. Search, sorting, filtering, and previews.
  6. Advanced tools selected for the release, such as storage visualization, duplicate detection, archive support, tabs, or dual-pane browsing.
  7. Performance, accessibility, polish, packaging, and release verification.
- Technical risks, likely bottlenecks, and mitigation strategies.
- A definition of done for each phase.
- A concise running status area with completed, in-progress, blocked, and next tasks. Keep status evidence-based.
- A list of decisions that require human input versus safe decisions the agent may make autonomously.

Do not assume all suggested features belong in the first release. Prioritize a dependable core, then layer in advanced tools.

### File 5 — `TESTING_AND_ACCEPTANCE.md` (Verification, Quality, and Release Criteria)

**Why it exists:** It specifies how to prove the app works, how to prevent regressions, and what must be true before a release is considered ready.

Include:

- Existing test/build commands discovered during the repository audit.
- A test strategy with unit, integration, UI, filesystem, regression, performance, and accessibility checks as appropriate to the stack.
- Test IDs connected to PRD requirements.
- A representative test fixture containing nested folders, empty directories, hidden items, different file sizes, long paths, Unicode names, and simulated permission failures where practical.
- File-operation checks: copy, move, rename, delete, cancellation, conflict handling, and recovery behavior as applicable.
- Large-directory and long-running scan responsiveness tests.
- Folder Inspector correctness rules, including direct versus recursive totals, duplicate-count avoidance, unreadable items, links/reparse points, files changing mid-scan, cancellation, and stale-cache handling.
- Security and safety checks for path traversal, unsafe archive extraction, destructive actions, and filesystem edge cases where relevant.
- Packaging, startup, upgrade, and clean-install checks if packaging is in scope.
- A release checklist and explicit definition of verified versus not-yet-verified behavior.

Never state that tests passed unless they were actually run and their results were inspected. When a check cannot be run, write **Not run** and explain why.

---

## 4. Core Feature Direction

Use the following as the initial product direction. Confirm existing capabilities and prioritize them in the PRD rather than assuming all of them must ship at once.

### Essential foundation

- Reliable folder navigation and file listing.
- Breadcrumb navigation and a usable path/address entry.
- Sorting, filtering, multi-selection, and understandable file/folder metadata.
- Safe copy, move, rename, delete, and conflict handling.
- A background task/operation view for long-running operations.
- Clear errors and permission handling.
- Keyboard and context-menu workflows.

### Signature feature: Folder Inspector and Storage Analyzer

This is a major differentiator and must be explicitly designed and tested. When a folder is selected, the application should calculate and display its recursive contents, not just its immediate children.

The implementation plan and architecture must decide and document:

- How recursive scanning is performed without freezing the UI.
- How counts and sizes are aggregated and updated.
- Whether results are cached and how cache freshness is determined.
- How cancellation and progress are represented.
- How inaccessible paths and files changing during a scan affect totals.
- How symbolic links/reparse points are handled to avoid loops or accidental traversal outside the intended tree.
- Whether hard links or other filesystem-specific cases can cause apparent sizes to differ from physical disk usage.
- How logical file size differs from actual allocated disk space, if both values are offered.
- How to label partial totals so users do not mistake them for complete results.

Do not report a scan as complete if some content could not be examined. Avoid double-counting items, and document the chosen rules for links and unusual filesystem cases.

### Advanced capabilities to evaluate and prioritize

- Tabs and/or dual-pane browsing.
- Fast search and advanced filters.
- Preview for common file types where safe and practical.
- Storage breakdown, largest-items discovery, and a treemap-style view.
- Duplicate-file discovery using a cautious staged process (metadata first, content hash when needed) and a clear review step before deletion.
- Archive browsing and safe extraction.
- Batch rename and batch operations with previews.
- File checksums and metadata inspection.
- Folder comparison/synchronization preview.
- Saved locations or collections.
- Customizable views, themes, and keyboard shortcuts.

These are candidates, not promises. The PRD must assign priorities based on utility, implementation risk, and the actual state of the existing repository.

## 5. Repository Inspection and Reverse-Engineering Checklist

Before writing the five documents, inspect and record:

- Whether this is a Git repository and the current branch.
- `git status` and any user changes that must be preserved.
- Recent commits and available project notes, without assuming commit history proves current behavior.
- The root directory and important source/configuration files.
- Application entry point and how the UI starts.
- Current application screenshots or UI previews, if available.
- Language, frameworks, major dependencies, dependency manifests, and lockfiles.
- Build, run, format, lint, and test commands supported by the repo.
- Existing functionality, partly implemented functionality, stubs, TODOs, and known failures.
- Existing architecture boundaries and the areas most likely to need change.
- Available test data and safe methods of testing filesystem actions.

Prefer evidence from the source, project configuration, tests, and actual run results. If tools are unavailable, document the limitation and continue with what can be verified.

## 6. Non-Negotiable Engineering Rules

1. **Do not destroy existing work.** Do not reset, clean, delete, or overwrite user changes or unknown files. Inspect Git status first.
2. **Do not duplicate the project.** Work inside the existing repository and follow its established naming and layout where reasonable.
3. **Do not create duplicate documentation.** Search for equivalent files and update them when appropriate.
4. **Do not guess about the stack.** Discover it from repository evidence.
5. **Do not claim success without evidence.** Show the actual commands/checks used and their results in the status report.
6. **Do not make destructive operations invisible.** Any file deletion, bulk modification, or migration must be explicit, reviewable, and appropriately confirmed.
7. **Do not freeze the UI for scans or bulk I/O.** Use the project's suitable background/concurrency mechanisms and provide cancellation where feasible.
8. **Do not silently hide scan errors.** Partial results must be labelled and explained.
9. **Do not add dependencies casually.** Explain the purpose, maintenance/security implications, and alternatives for significant new dependencies.
10. **Maintain modular execution checkpoints.** Work through prioritized tasks with defined milestones and verify across shared project requirements.
11. **Verify beyond static mockups.** Validate real behavior with automated tests, production builds, and actual UI interaction.
12. **Keep documentation synchronized.** When a major architecture or UX decision changes, update related requirements, specifications, and test plans together.

## 7. Documentation Structure

The core project documentation is maintained under `docs/`:

1. `PRD.md` — Product scope, user personas, functional and non-functional requirements.
2. `ARCHITECTURE.md` — Technical stack, process models, threading, IPC contracts, and worker pipelines.
3. `UX_UI_SPEC.md` — Design system, layout structure, interaction models, and accessibility.
4. `IMPLEMENTATION_PLAN.md` — Work breakdown structure, milestones, and deliverables.
5. `TESTING_AND_ACCEPTANCE.md` — Quality assurance criteria, unit/integration test suites, and performance thresholds.

---

## 8. Development Reference

Refer to the documents in `docs/` and the automated test suite in `tests/` when adding new features or verifying regression baselines.
