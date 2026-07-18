# Sonar issues for PR 31

- total: 29
- returned: 29

## 1. Remove this redundant jump.
- key: AZ9vkBq085EfyZkQcDEe
- rule: typescript:S3626
- path: src/tools/evaluate.ts
- line: 33
- textRange: {"startLine": 33, "endLine": 33, "startOffset": 2, "endOffset": 9}
- type: CODE_SMELL
- severity: MINOR
- status: OPEN
- cleanCodeAttribute: CLEAR
- impacts: [{"softwareQuality": "MAINTAINABILITY", "severity": "LOW"}]
- effort: 1min
- creationDate: 2026-07-17T10:11:53+0000
- updateDate: 2026-07-17T10:11:53+0000
- tags: ["clumsy", "editable-source", "redundant"]
- flows: []

## 2. The empty object is useless.
- key: AZ9uxoWSudde5MzmmSSX
- rule: typescript:S7744
- path: src/config.ts
- line: 464
- textRange: {"startLine": 464, "endLine": 464, "startOffset": 37, "endOffset": 39}
- type: CODE_SMELL
- severity: MINOR
- status: OPEN
- cleanCodeAttribute: CLEAR
- impacts: [{"softwareQuality": "MAINTAINABILITY", "severity": "LOW"}]
- effort: 5min
- creationDate: 2026-07-17T06:31:17+0000
- updateDate: 2026-07-17T06:31:17+0000
- tags: ["editable-source", "spread-operator", "unnecessary"]
- flows: []

## 3. The empty object is useless.
- key: AZ9uxoWSudde5MzmmSSY
- rule: typescript:S7744
- path: src/config.ts
- line: 465
- textRange: {"startLine": 465, "endLine": 465, "startOffset": 43, "endOffset": 45}
- type: CODE_SMELL
- severity: MINOR
- status: OPEN
- cleanCodeAttribute: CLEAR
- impacts: [{"softwareQuality": "MAINTAINABILITY", "severity": "LOW"}]
- effort: 5min
- creationDate: 2026-07-17T06:31:17+0000
- updateDate: 2026-07-17T06:31:17+0000
- tags: ["editable-source", "spread-operator", "unnecessary"]
- flows: []

## 4. Remove this redundant jump.
- key: AZ9uxoWSudde5MzmmSSZ
- rule: typescript:S3626
- path: src/config.ts
- line: 577
- textRange: {"startLine": 577, "endLine": 577, "startOffset": 2, "endOffset": 9}
- type: CODE_SMELL
- severity: MINOR
- status: OPEN
- cleanCodeAttribute: CLEAR
- impacts: [{"softwareQuality": "MAINTAINABILITY", "severity": "LOW"}]
- effort: 1min
- creationDate: 2026-07-17T06:31:17+0000
- updateDate: 2026-07-17T06:31:17+0000
- tags: ["clumsy", "editable-source", "redundant"]
- flows: []

## 5. Prefer `.findLast(…)` over `.filter(…).at(-1)`.
- key: AZ9uxoUFudde5MzmmSST
- rule: typescript:S7750
- path: src/tools/batch-execute.ts
- line: 94
- textRange: {"startLine": 94, "endLine": 94, "startOffset": 5, "endOffset": 11}
- type: CODE_SMELL
- severity: MINOR
- status: OPEN
- cleanCodeAttribute: EFFICIENT
- impacts: [{"softwareQuality": "MAINTAINABILITY", "severity": "MEDIUM"}]
- effort: 5min
- creationDate: 2026-07-17T06:31:17+0000
- updateDate: 2026-07-17T06:31:17+0000
- tags: ["editable-source", "es2015", "performance", "readability"]
- flows: []

## 6. Use `.includes()` instead of `.some()` when checking value existence.
- key: AZ9uxoSHudde5MzmmSSR
- rule: typescript:S7765
- path: src/tools/catalog/search.ts
- line: 27
- textRange: {"startLine": 27, "endLine": 27, "startOffset": 27, "endOffset": 31}
- type: CODE_SMELL
- severity: MINOR
- status: OPEN
- cleanCodeAttribute: CLEAR
- impacts: [{"softwareQuality": "MAINTAINABILITY", "severity": "LOW"}]
- effort: 5min
- creationDate: 2026-07-17T06:31:17+0000
- updateDate: 2026-07-17T06:31:17+0000
- tags: ["editable-source", "es2016", "readability"]
- flows: []

## 7. Use `.includes()` instead of `.some()` when checking value existence.
- key: AZ9uxoSHudde5MzmmSSS
- rule: typescript:S7765
- path: src/tools/catalog/search.ts
- line: 39
- textRange: {"startLine": 39, "endLine": 39, "startOffset": 28, "endOffset": 32}
- type: CODE_SMELL
- severity: MINOR
- status: OPEN
- cleanCodeAttribute: CLEAR
- impacts: [{"softwareQuality": "MAINTAINABILITY", "severity": "LOW"}]
- effort: 5min
- creationDate: 2026-07-17T06:31:17+0000
- updateDate: 2026-07-17T06:31:17+0000
- tags: ["editable-source", "es2016", "readability"]
- flows: []

## 8. LLMs running this code with faulty CLI arguments can escape file system restrictions. Refactor this code to validate the constructed path before accessing the file system.
- key: AZ9uxoW_udde5MzmmSSa
- rule: tssecurity:S8707
- path: scripts/check-review-threads.ts
- line: 18
- textRange: {"startLine": 18, "endLine": 18, "startOffset": 26, "endOffset": 34}
- type: VULNERABILITY
- severity: MAJOR
- status: OPEN
- cleanCodeAttribute: COMPLETE
- impacts: [{"softwareQuality": "SECURITY", "severity": "HIGH"}]
- effort: 30min
- creationDate: 2026-07-17T05:48:44+0000
- updateDate: 2026-07-17T06:31:17+0000
- tags: ["cwe"]
- flows: [{"locations": [{"component": "tontoko_fast-playwright-mcp:scripts/check-review-threads.ts", "textRange": {"startLine": 18, "endLine": 18, "startOffset": 26, "endOffset": 34}, "msg": "Sink: this invocation is not safe; a malicious value can be used as argument"}, {"component": "tontoko_fast-playwright-mcp:scripts/check-review-threads.ts", "textRange": {"startLine": 18, "endLine": 18, "startOffset": 42, "endOffset": 49}, "msg": "A malicious value was previously assigned to field ‘fixture’"}, {"component": "tontoko_fast-playwright-mcp:scripts/check-review-threads.ts", "textRange": {"startLine": 9, "endLine": 9, "startOffset": 19, "endOffset": 28}, "msg": "Source: an llm can pass malicious data through command-line arguments"}]}]

## 9. Group parts of the regex together to make the intended operator precedence explicit.
- key: AZ9uxoXKudde5MzmmSSb
- rule: typescript:S5850
- path: scripts/upstream-check.ts
- line: 6
- textRange: {"startLine": 6, "endLine": 6, "startOffset": 25, "endOffset": 61}
- type: BUG
- severity: MAJOR
- status: OPEN
- cleanCodeAttribute: CLEAR
- impacts: [{"softwareQuality": "RELIABILITY", "severity": "MEDIUM"}]
- effort: 10min
- creationDate: 2026-07-17T05:48:44+0000
- updateDate: 2026-07-17T06:31:17+0000
- tags: ["regex", "type-dependent"]
- flows: []

## 10. LLMs running this code with faulty CLI arguments can escape file system restrictions. Refactor this code to validate the constructed path before accessing the file system.
- key: AZ9uxoXKudde5MzmmSSh
- rule: tssecurity:S8707
- path: scripts/upstream-check.ts
- line: 40
- textRange: {"startLine": 40, "endLine": 40, "startOffset": 36, "endOffset": 44}
- type: VULNERABILITY
- severity: MAJOR
- status: OPEN
- cleanCodeAttribute: COMPLETE
- impacts: [{"softwareQuality": "SECURITY", "severity": "HIGH"}]
- effort: 30min
- creationDate: 2026-07-17T05:48:44+0000
- updateDate: 2026-07-17T06:31:17+0000
- tags: ["cwe"]
- flows: [{"locations": [{"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 40, "endLine": 40, "startOffset": 36, "endOffset": 44}, "msg": "Sink: this invocation is not safe; a malicious value can be used as argument"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 40, "endLine": 40, "startOffset": 45, "endOffset": 49}, "msg": "A malicious value was previously assigned to field ‘path’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 38, "endLine": 38, "startOffset": 2, "endOffset": 6}, "msg": "A malicious value can be assigned to field ‘path’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 203, "endLine": 203, "startOffset": 25, "endOffset": 45}, "msg": "Function call: Control is passed to this function, which is on the path to a security sink"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 203, "endLine": 203, "startOffset": 53, "endOffset": 61}, "msg": "A malicious value was previously assigned to field ‘manifest’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 196, "endLine": 196, "startOffset": 21, "endOffset": 30}, "msg": "Source: an llm can pass malicious data through command-line arguments"}]}]

## 11. Make sure that sending this confidential data in a GET parameter is safe here.
- key: AZ9uxoXKudde5MzmmSSe
- rule: tssecurity:S8690
- path: scripts/upstream-check.ts
- line: 164
- textRange: {"startLine": 164, "endLine": 164, "startOffset": 25, "endOffset": 30}
- type: VULNERABILITY
- severity: CRITICAL
- status: OPEN
- cleanCodeAttribute: TRUSTWORTHY
- impacts: [{"softwareQuality": "SECURITY", "severity": "HIGH"}]
- effort: 20min
- creationDate: 2026-07-17T05:48:44+0000
- updateDate: 2026-07-17T06:31:17+0000
- tags: ["cwe"]
- flows: [{"locations": [{"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 164, "endLine": 164, "startOffset": 25, "endOffset": 30}, "msg": "Sink: this invocation is not safe; a malicious value can be used as argument"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 164, "endLine": 164, "startOffset": 31, "endOffset": 34}, "msg": "A malicious value was previously assigned to field ‘url’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 163, "endLine": 163, "startOffset": 29, "endOffset": 40}, "msg": "A malicious value can be assigned to field ‘url’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 186, "endLine": 186, "startOffset": 23, "endOffset": 33}, "msg": "Function call: Control is passed to this function, which is on the path to a security sink"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 187, "endLine": 187, "startOffset": 4, "endOffset": 70}, "msg": "This concatenation can propagate malicious content to the newly created string"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 187, "endLine": 187, "startOffset": 45, "endOffset": 55}, "msg": "A malicious value was previously assigned to field ‘repository’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 206, "endLine": 206, "startOffset": 10, "endOffset": 21}, "msg": "Function call: Control is passed to this function, which is on the path to a security sink"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 40, "endLine": 40, "startOffset": 30, "endOffset": 58}, "msg": "A malicious value was previously assigned to field ‘value’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 40, "endLine": 40, "startOffset": 36, "endOffset": 44}, "msg": "Source: this is confidential credential data (password, API key, secret, or token)"}]}]

## 12. Ensure that tainted data is validated before being used to construct a client-side request URL.
- key: AZ9uxoXKudde5MzmmSSf
- rule: tssecurity:S8476
- path: scripts/upstream-check.ts
- line: 164
- textRange: {"startLine": 164, "endLine": 164, "startOffset": 25, "endOffset": 30}
- type: VULNERABILITY
- severity: MINOR
- status: OPEN
- cleanCodeAttribute: TRUSTWORTHY
- impacts: [{"softwareQuality": "SECURITY", "severity": "HIGH"}]
- effort: 20min
- creationDate: 2026-07-17T05:48:44+0000
- updateDate: 2026-07-17T06:31:17+0000
- tags: ["cwe"]
- flows: [{"locations": [{"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 164, "endLine": 164, "startOffset": 25, "endOffset": 30}, "msg": "Sink: this invocation is not safe; a malicious value can be used as argument"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 164, "endLine": 164, "startOffset": 31, "endOffset": 34}, "msg": "A malicious value was previously assigned to field ‘url’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 163, "endLine": 163, "startOffset": 29, "endOffset": 40}, "msg": "A malicious value can be assigned to field ‘url’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 189, "endLine": 189, "startOffset": 24, "endOffset": 34}, "msg": "Function call: Control is passed to this function, which is on the path to a security sink"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 190, "endLine": 190, "startOffset": 4, "endOffset": 108}, "msg": "This concatenation can propagate malicious content to the newly created string"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 190, "endLine": 190, "startOffset": 45, "endOffset": 55}, "msg": "A malicious value was previously assigned to field ‘repository’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 206, "endLine": 206, "startOffset": 10, "endOffset": 21}, "msg": "Function call: Control is passed to this function, which is on the path to a security sink"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 40, "endLine": 40, "startOffset": 30, "endOffset": 58}, "msg": "A malicious value was previously assigned to field ‘value’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 40, "endLine": 40, "startOffset": 36, "endOffset": 44}, "msg": "Source: this is confidential credential data (password, API key, secret, or token)"}]}]

## 13. Change this code to not construct the URL's path from user-controlled data.
- key: AZ9uxoXKudde5MzmmSSg
- rule: tssecurity:S7044
- path: scripts/upstream-check.ts
- line: 164
- textRange: {"startLine": 164, "endLine": 164, "startOffset": 25, "endOffset": 30}
- type: VULNERABILITY
- severity: MAJOR
- status: OPEN
- cleanCodeAttribute: COMPLETE
- impacts: [{"softwareQuality": "SECURITY", "severity": "MEDIUM"}]
- effort: 30min
- creationDate: 2026-07-17T05:48:44+0000
- updateDate: 2026-07-17T06:31:17+0000
- tags: ["cwe"]
- flows: [{"locations": [{"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 164, "endLine": 164, "startOffset": 25, "endOffset": 30}, "msg": "Sink: this invocation is not safe; a malicious value can be used as argument"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 164, "endLine": 164, "startOffset": 31, "endOffset": 34}, "msg": "A malicious value was previously assigned to field ‘url’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 163, "endLine": 163, "startOffset": 29, "endOffset": 40}, "msg": "A malicious value can be assigned to field ‘url’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 189, "endLine": 189, "startOffset": 24, "endOffset": 34}, "msg": "Function call: Control is passed to this function, which is on the path to a security sink"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 190, "endLine": 190, "startOffset": 4, "endOffset": 108}, "msg": "This concatenation can propagate malicious content to the newly created string"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 190, "endLine": 190, "startOffset": 45, "endOffset": 55}, "msg": "A malicious value was previously assigned to field ‘repository’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 206, "endLine": 206, "startOffset": 10, "endOffset": 21}, "msg": "Function call: Control is passed to this function, which is on the path to a security sink"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 40, "endLine": 40, "startOffset": 30, "endOffset": 58}, "msg": "A malicious value was previously assigned to field ‘value’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 40, "endLine": 40, "startOffset": 36, "endOffset": 44}, "msg": "Source: this is confidential credential data (password, API key, secret, or token)"}]}]

## 14. LLMs running this code with faulty CLI arguments can escape file system restrictions. Refactor this code to validate the constructed path before accessing the file system.
- key: AZ9uxoXKudde5MzmmSSc
- rule: tssecurity:S8707
- path: scripts/upstream-check.ts
- line: 184
- textRange: {"startLine": 184, "endLine": 184, "startOffset": 28, "endOffset": 36}
- type: VULNERABILITY
- severity: MAJOR
- status: OPEN
- cleanCodeAttribute: COMPLETE
- impacts: [{"softwareQuality": "SECURITY", "severity": "HIGH"}]
- effort: 30min
- creationDate: 2026-07-17T05:48:44+0000
- updateDate: 2026-07-17T06:31:17+0000
- tags: ["cwe"]
- flows: [{"locations": [{"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 184, "endLine": 184, "startOffset": 28, "endOffset": 36}, "msg": "Sink: this invocation is not safe; a malicious value can be used as argument"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 184, "endLine": 184, "startOffset": 37, "endOffset": 44}, "msg": "A malicious value was previously assigned to field ‘fixture’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 181, "endLine": 181, "startOffset": 2, "endOffset": 18}, "msg": "A malicious value can be assigned to field ‘fixture’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 206, "endLine": 206, "startOffset": 10, "endOffset": 21}, "msg": "Function call: Control is passed to this function, which is on the path to a security sink"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 206, "endLine": 206, "startOffset": 39, "endOffset": 46}, "msg": "A malicious value was previously assigned to field ‘fixture’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 196, "endLine": 196, "startOffset": 21, "endOffset": 30}, "msg": "Source: an llm can pass malicious data through command-line arguments"}]}]

## 15. LLMs running this code with faulty CLI arguments can escape file system restrictions. Refactor this code to validate the constructed path before accessing the file system.
- key: AZ9uxoXKudde5MzmmSSd
- rule: tssecurity:S8707
- path: scripts/upstream-check.ts
- line: 209
- textRange: {"startLine": 209, "endLine": 209, "startOffset": 10, "endOffset": 19}
- type: VULNERABILITY
- severity: MAJOR
- status: OPEN
- cleanCodeAttribute: COMPLETE
- impacts: [{"softwareQuality": "SECURITY", "severity": "HIGH"}]
- effort: 30min
- creationDate: 2026-07-17T05:48:44+0000
- updateDate: 2026-07-17T06:31:17+0000
- tags: ["cwe"]
- flows: [{"locations": [{"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 209, "endLine": 209, "startOffset": 10, "endOffset": 19}, "msg": "Sink: this invocation is not safe; a malicious value can be used as argument"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 209, "endLine": 209, "startOffset": 27, "endOffset": 33}, "msg": "A malicious value was previously assigned to field ‘output’"}, {"component": "tontoko_fast-playwright-mcp:scripts/upstream-check.ts", "textRange": {"startLine": 196, "endLine": 196, "startOffset": 21, "endOffset": 30}, "msg": "Source: an llm can pass malicious data through command-line arguments"}]}]

## 16. Make sure that this dynamic injection or execution of code is safe.
- key: AZ9uxoUPudde5MzmmSSU
- rule: typescript:S1523
- path: src/tools/evaluate.ts
- line: 110
- textRange: {"startLine": 110, "endLine": 110, "startOffset": 28, "endOffset": 32}
- type: VULNERABILITY
- severity: CRITICAL
- status: OPEN
- cleanCodeAttribute: TRUSTWORTHY
- impacts: [{"softwareQuality": "MAINTAINABILITY", "severity": "LOW"}, {"softwareQuality": "SECURITY", "severity": "HIGH"}]
- effort: 30min
- creationDate: 2026-07-17T05:48:44+0000
- updateDate: 2026-07-17T06:31:17+0000
- tags: ["cwe", "former-hotspot"]
- flows: []

## 17. Make sure that this dynamic injection or execution of code is safe.
- key: AZ9uxoUPudde5MzmmSSV
- rule: typescript:S1523
- path: src/tools/evaluate.ts
- line: 112
- textRange: {"startLine": 112, "endLine": 112, "startOffset": 49, "endOffset": 54}
- type: VULNERABILITY
- severity: CRITICAL
- status: OPEN
- cleanCodeAttribute: TRUSTWORTHY
- impacts: [{"softwareQuality": "MAINTAINABILITY", "severity": "LOW"}, {"softwareQuality": "SECURITY", "severity": "HIGH"}]
- effort: 30min
- creationDate: 2026-07-17T05:48:44+0000
- updateDate: 2026-07-17T06:31:17+0000
- tags: ["cwe", "former-hotspot"]
- flows: []

## 18. Make sure that this dynamic injection or execution of code is safe.
- key: AZ9uxoUPudde5MzmmSSW
- rule: typescript:S1523
- path: src/tools/evaluate.ts
- line: 117
- textRange: {"startLine": 117, "endLine": 117, "startOffset": 28, "endOffset": 32}
- type: VULNERABILITY
- severity: CRITICAL
- status: OPEN
- cleanCodeAttribute: TRUSTWORTHY
- impacts: [{"softwareQuality": "MAINTAINABILITY", "severity": "LOW"}, {"softwareQuality": "SECURITY", "severity": "HIGH"}]
- effort: 30min
- creationDate: 2026-07-17T05:48:44+0000
- updateDate: 2026-07-17T06:31:17+0000
- tags: ["cwe", "former-hotspot"]
- flows: []

## 19. Simplify this regular expression to reduce its runtime, as it has super-linear performance due to backtracking.
- key: AZ9Vi1PHb3Yg5Wvlu52T
- rule: typescript:S8786
- path: src/apps/dashboard/render.ts
- line: 13
- textRange: {"startLine": 13, "endLine": 13, "startOffset": 25, "endOffset": 47}
- type: CODE_SMELL
- severity: MAJOR
- status: OPEN
- cleanCodeAttribute: EFFICIENT
- impacts: [{"softwareQuality": "RELIABILITY", "severity": "MEDIUM"}]
- effort: 20min
- creationDate: 2026-07-12T08:56:36+0000
- updateDate: 2026-07-12T08:56:36+0000
- tags: ["performance", "regex"]
- flows: []

## 20. `String.raw` should be used to avoid escaping `\`.
- key: AZ9VbHfHfI86R02PzCSo
- rule: typescript:S7780
- path: scripts/build-dashboard.ts
- line: 46
- textRange: {"startLine": 46, "endLine": 46, "startOffset": 26, "endOffset": 38}
- type: CODE_SMELL
- severity: MINOR
- status: OPEN
- cleanCodeAttribute: CLEAR
- impacts: [{"softwareQuality": "MAINTAINABILITY", "severity": "LOW"}]
- effort: 5min
- creationDate: 2026-07-12T08:22:38+0000
- updateDate: 2026-07-12T08:22:48+0000
- tags: ["editable-source", "es2015", "readability"]
- flows: []

## 21. Use <output> instead of the status role to ensure accessibility across all devices.
- key: AZ9Va-OB1sKQ6MLEYt-f
- rule: Web:S6819
- path: src/apps/dashboard/template.html
- line: 15
- textRange: {"startLine": 15, "endLine": 15, "startOffset": 10, "endOffset": 39}
- type: CODE_SMELL
- severity: MAJOR
- status: OPEN
- cleanCodeAttribute: CONVENTIONAL
- impacts: [{"softwareQuality": "MAINTAINABILITY", "severity": "MEDIUM"}]
- effort: 5min
- creationDate: 2026-07-12T08:21:52+0000
- updateDate: 2026-07-12T08:22:02+0000
- tags: ["accessibility"]
- flows: []

## 22. Provide a compare function that depends on "String.localeCompare", to reliably sort elements alphabetically.
- key: AZ9VW7u8OFmXP_NXQl6y
- rule: typescript:S2871
- path: src/tools/catalog/gateways.ts
- line: 80
- textRange: {"startLine": 80, "endLine": 80, "startOffset": 20, "endOffset": 24}
- type: BUG
- severity: CRITICAL
- status: OPEN
- cleanCodeAttribute: CLEAR
- impacts: [{"softwareQuality": "RELIABILITY", "severity": "HIGH"}]
- effort: 10min
- creationDate: 2026-07-12T08:04:13+0000
- updateDate: 2026-07-12T08:04:23+0000
- tags: ["bad-practice", "type-dependent"]
- flows: []

## 23. Provide a compare function that depends on "String.localeCompare", to reliably sort elements alphabetically.
- key: AZ9VW7u8OFmXP_NXQl6z
- rule: typescript:S2871
- path: src/tools/catalog/gateways.ts
- line: 124
- textRange: {"startLine": 124, "endLine": 124, "startOffset": 68, "endOffset": 72}
- type: BUG
- severity: CRITICAL
- status: OPEN
- cleanCodeAttribute: CLEAR
- impacts: [{"softwareQuality": "RELIABILITY", "severity": "HIGH"}]
- effort: 10min
- creationDate: 2026-07-12T08:04:13+0000
- updateDate: 2026-07-12T08:04:23+0000
- tags: ["bad-practice", "type-dependent"]
- flows: []

## 24. Provide a compare function that depends on "String.localeCompare", to reliably sort elements alphabetically.
- key: AZ9VW7u8OFmXP_NXQl60
- rule: typescript:S2871
- path: src/tools/catalog/gateways.ts
- line: 139
- textRange: {"startLine": 139, "endLine": 139, "startOffset": 68, "endOffset": 72}
- type: BUG
- severity: CRITICAL
- status: OPEN
- cleanCodeAttribute: CLEAR
- impacts: [{"softwareQuality": "RELIABILITY", "severity": "HIGH"}]
- effort: 10min
- creationDate: 2026-07-12T08:04:13+0000
- updateDate: 2026-07-12T08:04:23+0000
- tags: ["bad-practice", "type-dependent"]
- flows: []

## 25. Provide a compare function that depends on "String.localeCompare", to reliably sort elements alphabetically.
- key: AZ9VW7u8OFmXP_NXQl61
- rule: typescript:S2871
- path: src/tools/catalog/gateways.ts
- line: 149
- textRange: {"startLine": 149, "endLine": 149, "startOffset": 68, "endOffset": 72}
- type: BUG
- severity: CRITICAL
- status: OPEN
- cleanCodeAttribute: CLEAR
- impacts: [{"softwareQuality": "RELIABILITY", "severity": "HIGH"}]
- effort: 10min
- creationDate: 2026-07-12T08:04:13+0000
- updateDate: 2026-07-12T08:04:23+0000
- tags: ["bad-practice", "type-dependent"]
- flows: []

## 26. Provide a compare function that depends on "String.localeCompare", to reliably sort elements alphabetically.
- key: AZ9VW7u8OFmXP_NXQl62
- rule: typescript:S2871
- path: src/tools/catalog/gateways.ts
- line: 155
- textRange: {"startLine": 155, "endLine": 155, "startOffset": 68, "endOffset": 72}
- type: BUG
- severity: CRITICAL
- status: OPEN
- cleanCodeAttribute: CLEAR
- impacts: [{"softwareQuality": "RELIABILITY", "severity": "HIGH"}]
- effort: 10min
- creationDate: 2026-07-12T08:04:13+0000
- updateDate: 2026-07-12T08:04:23+0000
- tags: ["bad-practice", "type-dependent"]
- flows: []

## 27. Replace this assertion; it always succeeds.
- key: AZ9zBa-VMvoxo5ITxNz4
- rule: typescript:S5914
- path: tests/tabs.spec.ts
- line: 169
- textRange: {"startLine": 169, "endLine": 169, "startOffset": 9, "endOffset": 13}
- type: CODE_SMELL
- severity: MAJOR
- status: OPEN
- cleanCodeAttribute: LOGICAL
- impacts: [{"softwareQuality": "MAINTAINABILITY", "severity": "MEDIUM"}]
- effort: 5min
- creationDate: 2025-08-04T14:27:37+0000
- updateDate: 2026-07-18T02:19:08+0000
- tags: ["bun", "chai", "confusing", "cypress", "jasmine", "jest", "node", "playwright", "suspicious", "tests", "vitest"]
- flows: []

## 28. Replace this assertion; it always succeeds.
- key: AZ9zBa-VMvoxo5ITxNz5
- rule: typescript:S5914
- path: tests/tabs.spec.ts
- line: 188
- textRange: {"startLine": 188, "endLine": 188, "startOffset": 9, "endOffset": 13}
- type: CODE_SMELL
- severity: MAJOR
- status: OPEN
- cleanCodeAttribute: LOGICAL
- impacts: [{"softwareQuality": "MAINTAINABILITY", "severity": "MEDIUM"}]
- effort: 5min
- creationDate: 2025-08-04T14:27:37+0000
- updateDate: 2026-07-18T02:19:08+0000
- tags: ["bun", "chai", "confusing", "cypress", "jasmine", "jest", "node", "playwright", "suspicious", "tests", "vitest"]
- flows: []

## 29. Prefer "expect(pages).toHaveLength(1)" over this generic assertion for better reporting; it works on any object with a numeric length property.
- key: AZ9zBa-VMvoxo5ITxNz3
- rule: typescript:S5906
- path: tests/tabs.spec.ts
- line: 160
- textRange: {"startLine": 160, "endLine": 160, "startOffset": 2, "endOffset": 27}
- type: CODE_SMELL
- severity: MINOR
- status: OPEN
- cleanCodeAttribute: CLEAR
- impacts: [{"softwareQuality": "MAINTAINABILITY", "severity": "LOW"}]
- effort: 1min
- creationDate: 2025-04-04T05:39:55+0000
- updateDate: 2026-07-18T02:19:08+0000
- tags: ["chai", "cypress", "jest", "playwright", "tests", "vitest"]
- flows: []
