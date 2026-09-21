# Protocol Box repository instructions

## Commands

- Install dependencies with `pnpm install`.
- Run the development server with `pnpm dev`.
- Run all unit tests with `pnpm test`; use watch mode with `pnpm test:watch`.
- Run one unit-test file with `pnpm exec vitest run src/domain/protocol/index.test.ts`.
- Run one named unit test with `pnpm exec vitest run src/domain/protocol/index.test.ts -t "test name"`.
- Type-check with `pnpm typecheck`.
- Build the self-contained production artifact with `pnpm build`; the output is `dist/index.html`.
- Run all Chromium product tests with `pnpm test:e2e`.
- Run one Chromium test with `pnpm exec playwright test tests/application.spec.ts --grep "test name"`. Build first when the test consumes `dist/index.html`.
- Run the complete automated release gate with `pnpm validate`. This is the only command that represents all automated release checks. There is no separate lint script.

## Architecture

Protocol Box is a Vue 3 application that authors, signs, publishes, and reads portable experimental procedures. Vite and `vite-plugin-singlefile` bundle the application into one offline-capable HTML file. A Published Protocol is another self-contained HTML file containing one base64url-encoded JSON envelope in an inert data block; the embedded `Protocol` object is the sole canonical source.

### `src` organization

Use the dependency direction **Vue view/component → Pinia store → Workspace → ProtocolCore**. A lower layer must not import a higher layer; shared modules must not depend on a feature.

- `App.vue` and `main.ts` are bootstrap only: render the router shell and install Vue, Pinia, Router, and global styles.
- `router/` owns hash-history routes and legacy URL translation. `stores/app-shell.ts` owns cross-feature shell state such as document classification, Fork intent, and return-route intent; it contains no Author or Reader domain behavior.
- `domain/protocol/` is the framework-independent Protocol domain. Put schemas, canonicalization, signatures, fingerprints, formulas, resource limits, and Published Protocol inspection here.
- `features/author/`, `features/reader/`, and `features/help/` are vertical slices. Keep route-level views, feature components, and feature-local CSS together; Author and Reader additionally expose a Pinia `store.ts` and a framework-independent `workspace/` seam. Feature-only adapters, examples, and content stay inside their owning slice.
- `components/shared/` contains product-wide interaction contracts. `components/ui/` contains project-owned shadcn-vue/Reka primitives; compose these primitives rather than putting domain behavior in them.
- `shared/protocol-markdown/` contains only the Tiptap/Markdown schema shared by Author and Reader. Editability, Reader checklist state, sanitization, and persistence remain in their owning feature or Workspace.
- `locales/` owns the typed bilingual dictionaries, split by language and feature. English keys are canonical; the zh-CN dictionaries must satisfy the same key set.
- `styles/` is limited to global tokens, base rules, generated Protocol content, and portal behavior. Keep complex feature geometry in the feature-local stylesheet. `lib/` is reserved for genuinely framework-agnostic, cross-feature helpers.

Place behavior at the deepest layer that can own it completely. UI components orchestrate named Store actions; Stores keep Workspace instances private; Workspaces enforce application rules through ProtocolCore.

Domain behavior is divided into three deep public seams:

- `src/domain/protocol/index.ts` owns strict schemas, resource limits, deterministic Decimal formula evaluation, RFC 8785 canonicalization, fingerprints, signatures, envelope parsing, and Playable Protocol inspection.
- `src/features/author/workspace/index.ts` owns encrypted Key Bundles, Browser Key Bundle Recovery Copies, IndexedDB-backed encrypted Unsigned Drafts, content sanitization, imports, signing, and publication. Browser file-system integration stays behind `PublicationSaveAdapter` in `src/features/author/adapters/publication-save-adapter.ts`.
- `src/features/reader/workspace/index.ts` independently inspects Published Protocol HTML and owns Variable Value resolution, Playback state/timing, local session persistence, quarantine, and Completion Summary generation.

`src/App.vue` is the minimal Vue Router shell. Author, Reader, and Help views live under `src/features/`; seam-aligned Pinia stores hide Workspace instances behind named actions. Author and Reader share the Tiptap schema in `src/shared/protocol-markdown`, but Markdown is the persisted Protocol content: ProseMirror/Tiptap editor state is not a second source of truth. `src/components/shared/AccessibleDialog.vue` is the product-level modal contract over project-owned shadcn-vue/Reka primitives.

Tests use three intentional layers:

- Colocated `src/**/*.test.ts` exercises behavior through `ProtocolCore`, `AuthorWorkspace`, `ReaderWorkspace`, Router helpers, and the Author/Reader Pinia stores.
- `tests/application.spec.ts` exercises rendered Author/Reader workflows and built files in headless Chromium, primarily from `file://`.
- Artifact assertions inspect `dist/index.html`, emitted Published Protocol HTML, CSP, inert envelope data, and `.sha256` bytes as public file-format interfaces.

## Repository conventions

- Use the exact domain vocabulary in `CONTEXT.md`. In particular, a Signature Match proves signed-content integrity, not real-world Author identity; a Completion Summary is unsigned and non-evidentiary.
- Keep domain rules in their owning public seam. UI code orchestrates workspaces and reports status; it must not duplicate schema, crypto, formula, resource-limit, signature, or Playback logic.
- Treat all `file://` storage as untrusted. Author Keys live in encrypted portable Key Bundles; IndexedDB may retain one validated encrypted Browser Key Bundle Recovery Copy per Author Key ID, but never a passphrase or decrypted key. Unsigned Drafts remain encrypted with per-Draft keys. Playback Sessions are convenience data and must not be presented as evidence or used for sensitive values.
- Preserve the offline boundary: production artifacts bundle scripts, styles, fonts, and media and make zero runtime network requests. External links require Reader confirmation. Imported HTML is inert data and Author-supplied HTML/SVG must continue to lose scripts, styles, event handlers, classes, and IDs.
- Preserve the CSP split: application scripts are hash-constrained and inline event handlers are forbidden; inline style elements and attributes are intentionally allowed for trusted Reka positioning, scroll locking, and support styles. Do not interpret this as permission for Author content to carry styling.
- Published Protocol generation clones the application document. Close Dialog/Popover/Select portals and wait for Vue's `nextTick()` before cloning so temporary portals, `aria-hidden`, and body scroll-lock state are not published.
- Files under `src/components/ui/` are project-owned shadcn-vue source. Review changes locally rather than overwriting them through unreviewed regeneration. `SelectContent.vue` and `PopoverContent.vue` intentionally omit close animations because lingering Reka portals can leave the application `aria-hidden`.
- Keep `AccessibleDialog` behavior stable: primary-action initial focus, focus containment, required-vs-dismissible Escape handling, outside-dismiss prevention, and opener focus restoration are product contracts.
- Persistent in-page status and alert regions are authoritative feedback. Transient UI may supplement them but cannot replace visible failure/capability messages.
- Author editing is desktop-oriented; Reader layouts must remain usable at narrow widths and 200% zoom. Light, Dark, and System appearance is browser-wide UI state, outside signed Protocol and Playback Session data.
- Release approval has a manual half. Passing `pnpm validate` does not satisfy GUI file-picker, real filesystem permission, full accessibility, or current-plus-two-prior Chromium checks; record those in `docs/release/0001-mvp-release-checklist.md`.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in this repository's self-hosted Gitea Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

The canonical triage role names are used unchanged as Gitea labels. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses a single-context domain documentation layout. See `docs/agents/domain.md`.
