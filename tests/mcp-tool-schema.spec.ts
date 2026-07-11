import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { toMcpTool } from '../src/mcp/tool.js';
import { allTools } from '../src/tools.js';

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

test('MCP tool schemas preserve input fields named like schema annotations', () => {
  const tool = toMcpTool({
    name: 'browser_annotation_names',
    title: 'Annotation names',
    description: 'Tests property-name preservation.',
    type: 'readOnly',
    inputSchema: z.object({
      description: z.string().describe('Description field annotation.'),
      $schema: z.string().optional().describe('Schema field annotation.'),
    }),
  });

  const properties = (
    tool.inputSchema as {
      properties?: Record<string, unknown>;
    }
  ).properties;

  expect(properties).toHaveProperty('description');
  expect(properties).toHaveProperty('$schema');
  expect(collectKeys(properties?.description)).not.toContain('description');
});

test('the complete tool catalog keeps a substantial schema payload reduction', () => {
  const rawSchemas = allTools.map((tool) =>
    zodToJsonSchema(tool.schema.inputSchema, { strictUnions: true })
  );
  const compactSchemas = allTools.map(
    (tool) => toMcpTool(tool.schema).inputSchema
  );

  const rawLength = JSON.stringify(rawSchemas).length;
  const compactLength = JSON.stringify(compactSchemas).length;

  expect(compactLength).toBeLessThan(rawLength * 0.85);
});
