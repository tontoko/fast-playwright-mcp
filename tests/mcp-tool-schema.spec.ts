import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { toMcpTool } from '../src/mcp/tool.js';

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, keys);
    }
    return keys;
  }

  if (!value || typeof value !== 'object') {
    return keys;
  }

  for (const [key, child] of Object.entries(value)) {
    keys.push(key);
    collectKeys(child, keys);
  }
  return keys;
}

test('MCP tool schemas omit nested descriptions while preserving the tool summary', () => {
  const tool = toMcpTool({
    name: 'browser_example',
    title: 'Example tool',
    description: 'Concise top-level summary.',
    type: 'readOnly',
    inputSchema: z
      .object({
        selector: z
          .string()
          .describe('A deliberately verbose nested field description.'),
        options: z
          .object({
            timeout: z
              .number()
              .optional()
              .describe('Another deliberately verbose nested description.'),
          })
          .describe('Nested object description.'),
      })
      .describe('Root schema description.'),
  });

  expect(tool.description).toBe('Concise top-level summary.');
  expect(collectKeys(tool.inputSchema)).not.toContain('description');
  expect(collectKeys(tool.inputSchema)).not.toContain('$schema');
  expect(JSON.stringify(tool.inputSchema)).toContain('selector');
  expect(JSON.stringify(tool.inputSchema)).toContain('timeout');
});
