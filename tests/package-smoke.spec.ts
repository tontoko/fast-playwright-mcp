import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { expect, test } from '@playwright/test';
import packageJSON from '../package.json' with { type: 'json' };

const EXPECTED_ADAPTIVE_TOOLS = [
  'browser_batch_execute',
  'browser_execute',
  'browser_find',
  'browser_navigate',
  'browser_query',
  'browser_snapshot',
  'browser_tools',
];

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }
  return result.stdout;
}

async function linkRuntimeDependencies(root: string): Promise<void> {
  const sourceNodeModules = resolve('node_modules');
  const targetNodeModules = join(root, 'node_modules');
  await Promise.all(
    Object.keys(packageJSON.dependencies).map(async (dependency) => {
      const source = join(sourceNodeModules, dependency);
      const target = join(targetNodeModules, dependency);
      await mkdir(dirname(target), { recursive: true });
      await symlink(source, target, 'dir');
    })
  );
}

test('packed package installs into an isolated project and starts MCP', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fast-playwright-package-'));
  try {
    const packOutput = run(
      'npm',
      ['pack', '--json', '--pack-destination', root],
      process.cwd()
    );
    const [pack] = JSON.parse(packOutput) as Array<{
      filename: string;
      files: Array<{ path: string }>;
    }>;
    const packedPaths = pack.files.map((file) => file.path);
    expect(packedPaths).toContain('lib/program.js');
    expect(packedPaths).toContain('lib/apps/generated/dashboard.js');
    expect(packedPaths).toContain('cli.js');
    expect(packedPaths).not.toContain('src/program.ts');
    expect(packedPaths.some((path) => path.startsWith('tests/'))).toBe(false);
    expect(packedPaths.some((path) => path.startsWith('.github/'))).toBe(false);

    const packageDir = join(
      root,
      'node_modules',
      '@tontoko',
      'fast-playwright-mcp'
    );
    await mkdir(packageDir, { recursive: true });
    run(
      'tar',
      [
        '-xzf',
        join(root, pack.filename),
        '--strip-components=1',
        '-C',
        packageDir,
      ],
      root
    );
    await linkRuntimeDependencies(root);

    const cli = join(packageDir, 'cli.js');
    expect(run(process.execPath, [cli, '--version'], root).trim()).toBe(
      `Version ${packageJSON.version}`
    );
    expect(run(process.execPath, [cli, '--help'], root)).toContain(
      '--tool-profile'
    );

    const client = new Client({ name: 'package-smoke', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [cli, '--tool-profile=adaptive'],
      cwd: root,
      stderr: 'pipe',
    });
    let stderr = '';
    transport.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    try {
      await client.connect(transport);
      expect(
        (await client.listTools()).tools.map((tool) => tool.name).sort()
      ).toEqual([...EXPECTED_ADAPTIVE_TOOLS].sort());
      const status = await client.callTool({
        name: 'browser_tools',
        arguments: { action: 'status' },
      });
      const text = status.content.find((part) => part.type === 'text');
      expect(text).toMatchObject({
        text: expect.stringContaining('"profile": "adaptive"'),
      });
    } catch (error) {
      throw new Error(
        `Installed MCP server failed: ${String(error)}\n${stderr}`
      );
    } finally {
      await client.close();
    }

    expect(
      JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'))
    ).toMatchObject({ name: packageJSON.name, version: packageJSON.version });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
