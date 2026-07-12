import type { FullConfig } from './config.js';
import { batchExecuteTool } from './tools/batch-execute.js';
import { ToolRegistry, registerTools } from './tools/catalog/registry.js';
import common from './tools/common.js';
import consoleTools from './tools/console.js';
import { browserDiagnose } from './tools/diagnose.js';
import dialogs from './tools/dialogs.js';
import evaluate from './tools/evaluate.js';
import files from './tools/files.js';
import { browserFind } from './tools/find.js';
import { browserFindElements } from './tools/find-elements.js';
import inspectHtml from './tools/inspect-html.js';
import install from './tools/install.js';
import keyboard from './tools/keyboard.js';
import mouse from './tools/mouse.js';
import navigate from './tools/navigate.js';
import network from './tools/network.js';
import pdf from './tools/pdf.js';
import screenshot from './tools/screenshot.js';
import snapshot from './tools/snapshot.js';
import tabs from './tools/tabs.js';
import type { AnyTool } from './tools/tool.js';
import wait from './tools/wait.js';

export const allTools: AnyTool[] = [
  ...common,
  ...consoleTools,
  ...dialogs,
  ...evaluate,
  ...files,
  ...install,
  ...inspectHtml,
  ...keyboard,
  ...navigate,
  ...network,
  ...mouse,
  ...pdf,
  ...screenshot,
  ...snapshot,
  ...tabs,
  ...wait,
  batchExecuteTool,
  browserFind,
  browserFindElements,
  browserDiagnose,
];

export function filteredTools(config: FullConfig): AnyTool[] {
  return allTools.filter(
    (tool) =>
      tool.capability.startsWith('core') ||
      config.capabilities?.includes(tool.capability)
  );
}

export function createBaseToolRegistry(config: FullConfig): ToolRegistry {
  return new ToolRegistry(
    registerTools(filteredTools(config), {
      browser_find: {
        group: 'inspection',
        aliases: ['find', 'search snapshot', 'page search'],
        keywords: ['accessibility', 'snapshot', 'ref', 'locate'],
        upstreamSource: {
          repository: 'microsoft/playwright-mcp',
          commit: '7d36e7c5062e9d7a6c85fbabe9318e65539ae1af',
          path: 'packages/playwright-core/src/tools/backend/find.ts',
        },
      },
    })
  );
}
