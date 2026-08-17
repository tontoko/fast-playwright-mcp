import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { registerTools, ToolRegistry } from '../src/tools/catalog/registry.js';
import {
  ADAPTIVE_BOOTSTRAP_NAMES,
  MINIMAL_BOOTSTRAP_NAMES,
  ToolVisibility,
} from '../src/tools/catalog/visibility.js';
import { defineTool } from '../src/tools/tool.js';

function createTool(name: string) {
  return defineTool({
    capability: 'core',
    schema: {
      name,
      title: name,
      description: `${name} description`,
      inputSchema: z.object({}),
      type: name === 'browser_execute' ? 'action' : 'readOnly',
    },
    handle() {
      return Promise.resolve();
    },
  });
}

const names = [
  ...ADAPTIVE_BOOTSTRAP_NAMES,
  'browser_console_messages',
  'browser_click',
];
const registry = new ToolRegistry(registerTools(names.map(createTool)));

test('adaptive profile exposes the exact bootstrap set', () => {
  const visible = new ToolVisibility('adaptive').visibleNames(registry).sort();
  expect(visible).toEqual([...ADAPTIVE_BOOTSTRAP_NAMES].sort());
});

test('minimal profile exposes only the three gateways', () => {
  const visible = new ToolVisibility('minimal').visibleNames(registry).sort();
  expect(visible).toEqual([...MINIMAL_BOOTSTRAP_NAMES].sort());
});

test('full profile exposes the complete registry', () => {
  expect(new ToolVisibility('full').visible(registry)).toHaveLength(
    names.length
  );
});

test('enable, disable, and reset are session-local', () => {
  const first = new ToolVisibility('adaptive');
  const second = new ToolVisibility('adaptive');
  expect(first.enableTools(registry, ['browser_console_messages'])).toBe(true);
  expect(first.visibleNames(registry)).toContain('browser_console_messages');
  expect(second.visibleNames(registry)).not.toContain(
    'browser_console_messages'
  );
  expect(first.disableTools(registry, ['browser_console_messages'])).toBe(true);
  expect(first.enableTools(registry, ['browser_click'])).toBe(true);
  expect(first.reset()).toBe(true);
  expect(first.visibleNames(registry).sort()).toEqual(
    [...ADAPTIVE_BOOTSTRAP_NAMES].sort()
  );
});

test('unknown enable requests are atomic', () => {
  const visibility = new ToolVisibility('adaptive');
  expect(() =>
    visibility.enableTools(registry, [
      'browser_console_messages',
      'browser_missing',
    ])
  ).toThrow('Unknown tool: browser_missing');
  expect(visibility.visibleNames(registry)).not.toContain(
    'browser_console_messages'
  );
});
