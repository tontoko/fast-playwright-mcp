import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { registerTools, ToolRegistry } from '../src/tools/catalog/registry.js';
import { defineTool } from '../src/tools/tool.js';

const sample = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_sample',
    title: 'Sample',
    description: 'Sample tool.',
    inputSchema: z.object({ value: z.string() }),
    type: 'readOnly',
  },
  handle() {
    return Promise.resolve();
  },
});

test('registry resolves tools and metadata by stable name', () => {
  const registry = new ToolRegistry(
    registerTools([sample], {
      browser_sample: {
        group: 'inspection',
        aliases: ['sample'],
        keywords: ['example'],
      },
    })
  );
  expect(registry.require('browser_sample').group).toBe('inspection');
  expect(registry.require('browser_sample').aliases).toEqual(['sample']);
  expect(registry.names()).toEqual(['browser_sample']);
});

test('registry rejects duplicate names', () => {
  expect(
    () =>
      new ToolRegistry([...registerTools([sample]), ...registerTools([sample])])
  ).toThrow('Duplicate tool registration: browser_sample');
});

test('registry rejects overlong top-level descriptions', () => {
  const verbose = defineTool({
    capability: 'core',
    schema: {
      name: 'browser_verbose',
      title: 'Verbose',
      description: 'x'.repeat(181),
      inputSchema: z.object({ value: z.string() }),
      type: 'readOnly',
    },
    handle() {
      return Promise.resolve();
    },
  });
  expect(() => new ToolRegistry(registerTools([verbose]))).toThrow(
    'Tool description exceeds 180 characters: browser_verbose'
  );
});

test('registry validates upstream attribution', () => {
  const registration = registerTools([sample], {
    browser_sample: {
      upstreamSource: {
        repository: 'microsoft/playwright-mcp',
        commit: '7d36e7c5062e9d7a6c85fbabe9318e65539ae1af',
        path: 'packages/playwright-core/src/tools/backend/find.ts',
      },
    },
  });
  expect(() => new ToolRegistry(registration)).not.toThrow();

  const invalid = registerTools([sample], {
    browser_sample: {
      upstreamSource: {
        repository: 'microsoft/playwright-mcp',
        commit: 'main',
        path: '../find.ts',
      },
    },
  });
  expect(() => new ToolRegistry(invalid)).toThrow(
    'Invalid upstream commit for browser_sample'
  );
});
