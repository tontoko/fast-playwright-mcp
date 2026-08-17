# Release checklist

Run from a clean checkout:

- [ ] `bun install --frozen-lockfile`
- [ ] `bun run build:dashboard` and confirm `src/apps/generated/dashboard.ts` is unchanged
- [ ] `bun run typecheck`
- [ ] `bun run build:publish`
- [ ] `bun run lint`
- [ ] `bun run benchmark:tools -- --check`
- [ ] run `bun run upstream:check:fixture` twice and confirm identical output
- [ ] `bun run test:package`
- [ ] `bunx playwright test --project=chrome`
- [ ] `bunx playwright test --project=chromium`
- [ ] `bunx playwright test --project=msedge`
- [ ] `bunx playwright test --project=firefox`
- [ ] `bunx playwright test --project=webkit`
- [ ] `npm ci --prefix extension`
- [ ] `npm run build --prefix extension`
- [ ] `xvfb-run --auto-servernum bunx playwright test --config=extension/playwright.config.ts`
- [ ] build the Docker image and run the CLI version smoke test
- [ ] confirm the SonarQube quality gate passes with no new unresolved issue or security hotspot
- [ ] confirm all review threads are resolved before marking a pull request ready
- [ ] confirm every GitHub Action reference is a full commit SHA
- [ ] `git diff --check`
- [ ] `git status --short` is empty
