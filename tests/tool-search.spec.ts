import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { registerTools, ToolRegistry } from '../src/tools/catalog/registry.js';
import { searchTools } from '../src/tools/catalog/search.js';
import { defineTool } from '../src/tools/tool.js';

function createTool(name: string, title: string, description: string) {
  return defineTool({
    capability: 'core',
    schema: {
      name,
      title,
      description,
      inputSchema: z.object({}),
      type: 'readOnly',
    },
    handle() {
      return Promise.resolve();
    },
  });
}

const registry = new ToolRegistry(
  registerTools(
    [
      createTool('browser_snapshot', 'Capture snapshot', 'Read page structure'),
      createTool('browser_screenshot', 'Capture image', 'Take a page image'),
      createTool(
        'browser_console_messages',
        'Console messages',
        'Read browser logs'
      ),
    ],
    {
      browser_snapshot: {
        aliases: ['page tree'],
        keywords: ['accessibility'],
      },
      browser_screenshot: { aliases: ['image'] },
    }
  )
);

test('search uses deterministic score ordering', () => {
  expect(searchTools(registry, 'browser_snapshot')[0]).toMatchObject({
    name: 'browser_snapshot',
    score: 100,
  });
  expect(searchTools(registry, 'page tree')[0]).toMatchObject({
    name: 'browser_snapshot',
    score: 90,
  });
  expect(searchTools(registry, 'accessibility')[0]).toMatchObject({
    name: 'browser_snapshot',
    score: 30,
  });
});

test('search limits results and sorts ties by name', () => {
  const results = searchTools(registry, 'capture', 1);
  expect(results).toHaveLength(1);
  expect(results[0].name).toBe('browser_screenshot');
});
