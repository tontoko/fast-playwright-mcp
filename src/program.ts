import { Option, program } from 'commander';

// @ts-expect-error - playwright-core does not publish types for its exported coreBundle entry.
import coreBundle from 'playwright-core/lib/coreBundle';

const { startTraceViewerServer } = coreBundle.server;

import { contextFactory } from './browser-context-factory.js';
import {
  BrowserServerBackend,
  type FactoryList,
} from './browser-server-backend.js';
import {
  commaSeparatedList,
  headerParser,
  parseCodegen,
  parseToolProfile,
  positiveNumber,
  resolveCLIConfig,
  semicolonSeparatedList,
} from './config.js';
import { Context } from './context.js';
import {
  createExtensionContextFactory,
  runWithExtension,
} from './extension/main.js';
import { runLoopTools } from './loopTools/main.js';
import type { ServerBackendFactory } from './mcp/server.js';
import { start } from './mcp/transport.js';
import { programDebug } from './utils/log.js';
import { packageJSON } from './utils/package.js';
import { logServerStart } from './utils/request-logger.js';

program
  .version(`Version ${packageJSON.version}`)
  .name(packageJSON.name)
  .option(
    '--allowed-hosts <hosts>',
    'comma-separated list of allowed HTTP Host header values',
    commaSeparatedList
  )
  .option(
    '--allowed-origins <origins>',
    'semicolon-separated list of origins to allow the browser to request. Default is to allow all.',
    semicolonSeparatedList
  )
  .option(
    '--blocked-origins <origins>',
    'semicolon-separated list of origins to block the browser from requesting. Blocklist is evaluated before allowlist.',
    semicolonSeparatedList
  )
  .option('--block-service-workers', 'block service workers')
  .option(
    '--browser <browser>',
    'browser or chrome channel to use: chrome, firefox, webkit, or msedge'
  )
  .option(
    '--caps <caps>',
    'comma-separated optional capabilities: vision, pdf, apps',
    commaSeparatedList
  )
  .option('--cdp-endpoint <endpoint>', 'CDP endpoint to connect to')
  .option(
    '--cdp-header <header...>',
    'CDP request header in Name: Value form; may be repeated',
    headerParser
  )
  .option(
    '--cdp-timeout <timeout>',
    'CDP connection timeout in milliseconds',
    positiveNumber
  )
  .option(
    '--codegen <mode>',
    'generated code mode: typescript or none',
    parseCodegen
  )
  .option('--config <path>', 'path to the configuration file')
  .option('--device <device>', 'device to emulate, for example: "iPhone 15"')
  .option('--executable-path <path>', 'path to the browser executable')
  .option('--headless', 'run browser in headless mode, headed by default')
  .option(
    '--host <host>',
    'host to bind server to. Default is localhost. Use 0.0.0.0 to bind all interfaces.'
  )
  .option('--ignore-https-errors', 'ignore HTTPS errors')
  .option('--isolated', 'use an in-memory isolated browser profile')
  .option(
    '--image-responses <mode>',
    'whether image responses are allow or omit'
  )
  .option(
    '--no-sandbox',
    'disable the Chromium sandbox for process types that normally use it'
  )
  .option('--output-dir <path>', 'directory for output files')
  .option(
    '--output-max-size <bytes>',
    'maximum output directory size in bytes; zero disables eviction',
    positiveNumber
  )
  .option(
    '--port <port>',
    'port to listen on for HTTP transport',
    positiveNumber
  )
  .option(
    '--proxy-bypass <bypass>',
    'comma-separated domains to bypass the proxy'
  )
  .option('--proxy-server <proxy>', 'proxy server URL')
  .option('--save-session', 'save the Playwright MCP session')
  .option('--save-trace', 'save the Playwright trace')
  .option('--secrets <path>', 'dotenv file containing values to redact')
  .option(
    '--storage-state <path>',
    'path to storage state for isolated sessions'
  )
  .option(
    '--test-id-attribute <attribute>',
    'attribute used by test-id selectors'
  )
  .option(
    '--timeout-action <timeout>',
    'default action timeout in milliseconds',
    positiveNumber
  )
  .option(
    '--timeout-expect <timeout>',
    'default expectation timeout in milliseconds',
    positiveNumber
  )
  .option(
    '--timeout-navigation <timeout>',
    'default navigation timeout in milliseconds',
    positiveNumber
  )
  .option(
    '--tool-profile <profile>',
    'tool catalog profile: adaptive, full, or minimal',
    parseToolProfile
  )
  .option('--user-agent <ua string>', 'browser user-agent string')
  .option('--user-data-dir <path>', 'browser user data directory')
  .option(
    '--viewport-size <size>',
    'viewport size as width,height, for example 1280,720'
  )
  .addOption(
    new Option(
      '--extension',
      'Connect to a running Edge/Chrome browser using the Playwright MCP Bridge extension.'
    ).hideHelp()
  )
  .addOption(
    new Option(
      '--connect-tool',
      'Allow switching between browser connection methods.'
    ).hideHelp()
  )
  .addOption(new Option('--loop-tools', 'Run loop tools').hideHelp())
  .addOption(
    new Option('--vision', 'Legacy option, use --caps=vision').hideHelp()
  )
  .action(async (options) => {
    setupExitWatchdog();
    if (options.vision) {
      options.caps = ['vision'];
    }
    try {
      const config = await resolveCLIConfig(options);
      if (options.extension) {
        await runWithExtension(config);
        return;
      }
      if (options.loopTools) {
        await runLoopTools(config);
        return;
      }

      const browserContextFactory = contextFactory(config);
      let serverBackendFactory: ServerBackendFactory;
      if (options.connectTool) {
        const factories: FactoryList = [
          browserContextFactory,
          createExtensionContextFactory(config),
        ];
        serverBackendFactory = () =>
          new BrowserServerBackend(config, factories);
      } else {
        const factories: FactoryList = [browserContextFactory];
        serverBackendFactory = () =>
          new BrowserServerBackend(config, factories);
      }

      logServerStart();
      await start(serverBackendFactory, config.server);
      if (config.saveTrace) {
        const server = await startTraceViewerServer();
        const urlPrefix = server.urlPrefix('human-readable');
        const url =
          `${urlPrefix}/trace/index.html?trace=` +
          `${config.browser.launchOptions.tracesDir}/trace.json`;
        programDebug(`Trace viewer available at: ${url}`);
      }
    } catch (error) {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exit(1);
    }
  });

function setupExitWatchdog() {
  let isExiting = false;
  const handleExit = async () => {
    if (isExiting) {
      return;
    }
    isExiting = true;
    setTimeout(() => process.exit(0), 15_000);
    await Context.disposeAll();
    process.exit(0);
  };
  process.stdin.on('close', handleExit);
  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
}

program.parseAsync(process.argv).catch(() => {
  process.exit(1);
});
