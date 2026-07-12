import { expect, test } from '@playwright/test';
import { z } from 'zod';
import {
  ToolRegistry,
  registerTools,
} from '../src/tools/catalog/registry.js';
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
  async handle() {},
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
      new ToolRegistry([
        ...registerTools([sample]),
        ...registerTools([sample]),
      ])
  ).toThrow('Duplicate tool registration: browser_sample');
});

test('registry rejects overlong top-level descriptions', () => {
  const verbose = defineTool({
    ...sample,
    schema: {
      ...sample.schema,
      name: 'browser_verbose',
      description: 'x'.repeat(181),
    },
  });
  expect(() => new ToolRegistry(registerTools([verbose]))).toThrow(
    'Tool description exceeds 180 characters: browser_verbose'
  );
});
