## Team agent boundary

Before editing, read `CONTRIBUTING.md`, `docs/OWNERSHIP.md`, and the assigned file in `docs/workstreams/`.

当前按三名实际成员协作：A 负责 Present Self，C 负责 Encounter + Matching，D 负责 Side、长期画像、共享平台与集成。不得再把不存在的 B 作为任务角色或审批人。

- Only edit paths explicitly allowed by the Issue or task prompt.
- Treat `package*.json`, framework config, `app/globals.css`, `components/**`, `lib/contracts/**`, `lib/db/schema.ts`, `drizzle/**`, `.env.example`, and `.github/**` as frozen shared files.
- Do not install dependencies, generate migrations, format the whole repository, or refactor adjacent modules without a dedicated Issue and CODEOWNER approval.
- Run `git status --short` before and after work. Preserve unrelated and uncommitted user changes.
- Run the checks required by the assigned workstream; `npm run check` is the default merge gate.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
