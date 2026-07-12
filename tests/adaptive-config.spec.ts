import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { toMcpTool } from '../src/mcp/tool.js';

test.describe('tool profile configuration', () => {
  test('defaults to adaptive', async () => {
    const { resolveConfig } = await import('../src/config.js');
    expect(resolveConfig({}).toolProfile).toBe('adaptive');
  });

  test('accepts full from CLI options', async () => {
    const { configFromCLIOptions } = await import('../src/config.js');
    expect(configFromCLIOptions({ toolProfile: 'full' }).toolProfile).toBe(
      'full'
    );
  });

  test('reads the dedicated environment variable', async () => {
    const previous = process.env.FAST_PLAYWRIGHT_TOOL_PROFILE;
    process.env.FAST_PLAYWRIGHT_TOOL_PROFILE = 'minimal';
    try {
      const { resolveCLIConfig } = await import('../src/config.js');
      expect((await resolveCLIConfig({})).toolProfile).toBe('minimal');
    } finally {
      if (previous === undefined) {
        delete process.env.FAST_PLAYWRIGHT_TOOL_PROFILE;
      } else {
        process.env.FAST_PLAYWRIGHT_TOOL_PROFILE = previous;
      }
    }
  });

  test('rejects an unknown profile', async () => {
    const { parseToolProfile } = await import('../src/config.js');
    expect(() => parseToolProfile('large')).toThrow(
      'Invalid tool profile: large'
    );
  });
});

test('action tools are neither read-only nor destructive', () => {
  const tool = toMcpTool({
    name: 'browser_action_example',
    title: 'Action example',
    description: 'Changes session state without destructive browser effects.',
    type: 'action',
    inputSchema: z.object({}),
  });

  expect(tool.annotations).toMatchObject({
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: true,
  });
});
