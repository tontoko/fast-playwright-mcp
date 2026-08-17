# Upstream compatibility policy

Microsoft Playwright MCP and the MCP implementation maintained inside Microsoft Playwright are reviewed regularly, but changes are not merged automatically.

A behavioral port must satisfy all of the following:

- record the upstream repository, full commit SHA, and source path;
- add a local regression or conformance test before or with the implementation;
- preserve local response expectations, selectors, adaptive discovery, and capability boundaries;
- complete a security review when networking, file access, secrets, executable launch, CDP, or extension behavior changes;
- isolate dependency upgrades from behavioral ports where practical;
- update `docs/upstream-compatibility.md`;
- pass typecheck, lint, build, package smoke, the applicable browser matrix, extension tests, Docker smoke, and the SonarQube quality gate.

The following are excluded from automatic or bulk import:

- formatter and linter configuration;
- release and publishing automation;
- generated README output unrelated to a selected behavior;
- unrelated dependency updates;
- implementations that duplicate or weaken an existing local feature.

The scheduled upstream audit has read-only repository permissions and uploads a report artifact. A maintainer decides whether each candidate should be ported, deferred, treated as already covered, or rejected.
