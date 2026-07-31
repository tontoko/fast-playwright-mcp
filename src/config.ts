import { promises as fsPromises } from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join as pathJoin } from 'node:path';
import { parse as parseDotenv } from 'dotenv';
import type { BrowserContextOptions, LaunchOptions } from 'playwright';
import { devices } from 'playwright';
import type { Config, ToolCapability, ToolProfile } from '../config.js';
import { sanitizeForFilePath } from './utils/guid.js';

const MAX_CONFIG_FILE_SIZE = 1024 * 1024;
const DEFAULT_ACTION_TIMEOUT = 5000;
const DEFAULT_NAVIGATION_TIMEOUT = 60_000;
const DEFAULT_EXPECT_TIMEOUT = 5000;
const DEFAULT_CDP_TIMEOUT = 30_000;
const AUTOMATION_CONTROLLED_ARG =
  '--disable-blink-features=AutomationControlled';

export type CLIOptions = {
  allowedHosts?: string[];
  allowedOrigins?: string[];
  blockedOrigins?: string[];
  blockServiceWorkers?: boolean;
  browser?: string;
  caps?: string[];
  cdpEndpoint?: string;
  /** Commander attribute for --cdp-header. */
  cdpHeader?: Record<string, string>;
  /** Programmatic and environment representation of CDP headers. */
  cdpHeaders?: Record<string, string>;
  cdpTimeout?: number;
  codegen?: 'typescript' | 'none';
  config?: string;
  device?: string;
  executablePath?: string;
  headless?: boolean;
  host?: string;
  ignoreHttpsErrors?: boolean;
  isolated?: boolean;
  imageResponses?: 'allow' | 'omit';
  outputDir?: string;
  outputMaxSize?: number;
  port?: number;
  proxyBypass?: string;
  proxyServer?: string;
  sandbox?: boolean;
  saveSession?: boolean;
  saveTrace?: boolean;
  /** Commander attribute for --secrets. */
  secrets?: string;
  /** Programmatic and environment path to a secrets file. */
  secretsFile?: string;
  storageState?: string;
  testIdAttribute?: string;
  timeoutAction?: number;
  timeoutExpect?: number;
  timeoutNavigation?: number;
  toolProfile?: ToolProfile;
  userAgent?: string;
  userDataDir?: string;
  viewportSize?: string;
};

const defaultConfig: FullConfig = {
  toolProfile: 'adaptive',
  browser: {
    browserName: 'chromium',
    launchOptions: {
      channel: 'chrome',
      headless: platform() === 'linux' && !process.env.DISPLAY,
      chromiumSandbox: true,
    },
    contextOptions: {
      viewport: null,
    },
    cdpTimeout: DEFAULT_CDP_TIMEOUT,
  },
  network: {
    allowedOrigins: undefined,
    blockedOrigins: undefined,
  },
  server: {},
  saveTrace: false,
  outputMaxSize: 0,
  testIdAttribute: 'data-testid',
  timeouts: {
    action: DEFAULT_ACTION_TIMEOUT,
    navigation: DEFAULT_NAVIGATION_TIMEOUT,
    expect: DEFAULT_EXPECT_TIMEOUT,
  },
  codegen: 'typescript',
};

type BrowserUserConfig = NonNullable<Config['browser']>;

export type FullConfig = Config & {
  toolProfile: ToolProfile;
  browser: Omit<BrowserUserConfig, 'browserName'> & {
    browserName: 'chromium' | 'firefox' | 'webkit';
    launchOptions: NonNullable<BrowserUserConfig['launchOptions']>;
    contextOptions: NonNullable<BrowserUserConfig['contextOptions']>;
    cdpTimeout: number;
  };
  network: NonNullable<Config['network']>;
  saveTrace: boolean;
  server: NonNullable<Config['server']>;
  outputMaxSize: number;
  testIdAttribute: string;
  timeouts: {
    action: number;
    navigation: number;
    expect: number;
  };
  codegen: 'typescript' | 'none';
};

export function resolveConfig(config: Config): FullConfig {
  return mergeConfig(defaultConfig, config);
}

export async function resolveCLIConfig(
  cliOptions: CLIOptions,
  env: NodeJS.ProcessEnv = process.env
): Promise<FullConfig> {
  const envOptions = buildEnvOptions(env);
  const configInFile = await loadConfig(cliOptions.config ?? envOptions.config);
  const envOverrides = configFromCLIOptions(envOptions);
  const envSecretOverrides = await loadSecretOverrides(envOptions.secretsFile);
  const cliOverrides = configFromCLIOptions(cliOptions);
  const cliSecretOverrides = await loadSecretOverrides(
    cliOptions.secrets ?? cliOptions.secretsFile
  );

  let result = defaultConfig;
  result = mergeConfig(result, configInFile);
  result = mergeConfig(result, envOverrides);
  result = mergeConfig(result, envSecretOverrides);
  result = mergeConfig(result, cliOverrides);
  result = mergeConfig(result, cliSecretOverrides);
  return result;
}

type BrowserParseResult = {
  browserName: 'chromium' | 'firefox' | 'webkit' | undefined;
  channel: string | undefined;
};

function parseBrowserType(browser: string): BrowserParseResult {
  if (isChromiumVariant(browser)) {
    return { browserName: 'chromium', channel: browser };
  }
  if (browser === 'firefox') {
    return { browserName: 'firefox', channel: undefined };
  }
  if (browser === 'webkit') {
    return { browserName: 'webkit', channel: undefined };
  }
  return { browserName: undefined, channel: undefined };
}

export function isChromiumVariant(browser: string): boolean {
  return [
    'chrome',
    'chrome-beta',
    'chrome-canary',
    'chrome-dev',
    'chromium',
    'msedge',
    'msedge-beta',
    'msedge-canary',
    'msedge-dev',
  ].includes(browser);
}

function createLaunchOptions(
  cliOptions: CLIOptions,
  channel?: string
): LaunchOptions {
  const launchOptions: LaunchOptions = {
    channel,
    executablePath: cliOptions.executablePath,
    headless: cliOptions.headless,
  };
  if (cliOptions.sandbox === false) {
    launchOptions.chromiumSandbox = false;
  }
  if (cliOptions.proxyServer) {
    launchOptions.proxy = {
      server: cliOptions.proxyServer,
      ...(cliOptions.proxyBypass && { bypass: cliOptions.proxyBypass }),
    };
  }
  return launchOptions;
}

function createContextOptions(cliOptions: CLIOptions): BrowserContextOptions {
  const contextOptions: BrowserContextOptions = cliOptions.device
    ? devices[cliOptions.device] || {}
    : {};
  if (cliOptions.storageState) {
    contextOptions.storageState = cliOptions.storageState;
  }
  if (cliOptions.userAgent) {
    contextOptions.userAgent = cliOptions.userAgent;
  }
  if (cliOptions.viewportSize) {
    contextOptions.viewport = parseViewportSize(cliOptions.viewportSize);
  }
  if (cliOptions.ignoreHttpsErrors) {
    contextOptions.ignoreHTTPSErrors = true;
  }
  if (cliOptions.blockServiceWorkers) {
    contextOptions.serviceWorkers = 'block';
  }
  return contextOptions;
}

function parseViewportSize(viewportSize: string): {
  width: number;
  height: number;
} {
  const [width, height] = viewportSize.split(',').map((value) => +value);
  if (
    !(Number.isFinite(width) && Number.isFinite(height)) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      'Invalid viewport size format: use "width,height", for example --viewport-size="800,600"'
    );
  }
  return { width, height };
}

function validateDeviceAndCDPOptions(cliOptions: CLIOptions): void {
  if (cliOptions.device && cliOptions.cdpEndpoint) {
    throw new Error('Device emulation is not supported with cdpEndpoint.');
  }
}

function resolveCdpHeaders(
  cliOptions: CLIOptions
): Record<string, string> | undefined {
  if (!(cliOptions.cdpHeaders || cliOptions.cdpHeader)) {
    return;
  }
  return {
    ...cliOptions.cdpHeaders,
    ...cliOptions.cdpHeader,
  };
}

export function configFromCLIOptions(cliOptions: CLIOptions): Config {
  const browserInfo = cliOptions.browser
    ? parseBrowserType(cliOptions.browser)
    : { browserName: undefined, channel: undefined };
  validateDeviceAndCDPOptions(cliOptions);

  const browser: Config['browser'] = {
    isolated: cliOptions.isolated,
    userDataDir: cliOptions.userDataDir,
    launchOptions: createLaunchOptions(cliOptions, browserInfo.channel),
    contextOptions: createContextOptions(cliOptions),
    cdpEndpoint: cliOptions.cdpEndpoint,
    cdpHeaders: resolveCdpHeaders(cliOptions),
    cdpTimeout: cliOptions.cdpTimeout,
  };
  if (browserInfo.browserName !== undefined) {
    browser.browserName = browserInfo.browserName;
  }

  return {
    toolProfile: cliOptions.toolProfile,
    browser,
    server: {
      port: cliOptions.port,
      host: cliOptions.host,
      allowedHosts: cliOptions.allowedHosts,
    },
    network: {
      allowedOrigins: cliOptions.allowedOrigins,
      blockedOrigins: cliOptions.blockedOrigins,
    },
    capabilities: cliOptions.caps as ToolCapability[],
    saveSession: cliOptions.saveSession,
    saveTrace: cliOptions.saveTrace,
    outputDir: cliOptions.outputDir,
    outputMaxSize: cliOptions.outputMaxSize,
    imageResponses: cliOptions.imageResponses,
    testIdAttribute: cliOptions.testIdAttribute,
    timeouts: {
      action: cliOptions.timeoutAction,
      navigation: cliOptions.timeoutNavigation,
      expect: cliOptions.timeoutExpect,
    },
    codegen: cliOptions.codegen,
  };
}

function buildEnvOptions(env: NodeJS.ProcessEnv): CLIOptions {
  return {
    allowedHosts: commaSeparatedList(env.PLAYWRIGHT_MCP_ALLOWED_HOSTS),
    allowedOrigins: semicolonSeparatedList(env.PLAYWRIGHT_MCP_ALLOWED_ORIGINS),
    blockedOrigins: semicolonSeparatedList(env.PLAYWRIGHT_MCP_BLOCKED_ORIGINS),
    ignoreHttpsErrors: envToBoolean(env.PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS),
    host: envToString(env.PLAYWRIGHT_MCP_HOST),
    port: envToNumber(env.PLAYWRIGHT_MCP_PORT),
    browser: envToString(env.PLAYWRIGHT_MCP_BROWSER),
    executablePath: envToString(env.PLAYWRIGHT_MCP_EXECUTABLE_PATH),
    headless: envToBoolean(env.PLAYWRIGHT_MCP_HEADLESS),
    sandbox: envToBoolean(env.PLAYWRIGHT_MCP_SANDBOX),
    isolated: envToBoolean(env.PLAYWRIGHT_MCP_ISOLATED),
    blockServiceWorkers: envToBoolean(env.PLAYWRIGHT_MCP_BLOCK_SERVICE_WORKERS),
    device: envToString(env.PLAYWRIGHT_MCP_DEVICE),
    viewportSize: envToString(env.PLAYWRIGHT_MCP_VIEWPORT_SIZE),
    userAgent: envToString(env.PLAYWRIGHT_MCP_USER_AGENT),
    userDataDir: envToString(env.PLAYWRIGHT_MCP_USER_DATA_DIR),
    storageState: envToString(env.PLAYWRIGHT_MCP_STORAGE_STATE),
    proxyServer: envToString(env.PLAYWRIGHT_MCP_PROXY_SERVER),
    proxyBypass: envToString(env.PLAYWRIGHT_MCP_PROXY_BYPASS),
    outputDir: envToString(env.PLAYWRIGHT_MCP_OUTPUT_DIR),
    outputMaxSize: envToNumber(env.PLAYWRIGHT_MCP_OUTPUT_MAX_SIZE),
    saveTrace: envToBoolean(env.PLAYWRIGHT_MCP_SAVE_TRACE),
    imageResponses:
      env.PLAYWRIGHT_MCP_IMAGE_RESPONSES === 'omit' ? 'omit' : undefined,
    caps: commaSeparatedList(env.PLAYWRIGHT_MCP_CAPS),
    cdpEndpoint: envToString(env.PLAYWRIGHT_MCP_CDP_ENDPOINT),
    cdpHeaders: headerList(env.PLAYWRIGHT_MCP_CDP_HEADERS),
    cdpTimeout: envToNumber(env.PLAYWRIGHT_MCP_CDP_TIMEOUT),
    codegen: parseOptionalCodegen(env.PLAYWRIGHT_MCP_CODEGEN),
    config: envToString(env.PLAYWRIGHT_MCP_CONFIG),
    secretsFile: envToString(env.PLAYWRIGHT_MCP_SECRETS),
    testIdAttribute: envToString(env.PLAYWRIGHT_MCP_TEST_ID_ATTRIBUTE),
    timeoutAction: envToNumber(env.PLAYWRIGHT_MCP_TIMEOUT_ACTION),
    timeoutNavigation: envToNumber(env.PLAYWRIGHT_MCP_TIMEOUT_NAVIGATION),
    timeoutExpect: envToNumber(env.PLAYWRIGHT_MCP_TIMEOUT_EXPECT),
    toolProfile: env.FAST_PLAYWRIGHT_TOOL_PROFILE
      ? parseToolProfile(env.FAST_PLAYWRIGHT_TOOL_PROFILE)
      : undefined,
  };
}

async function loadConfig(configFile: string | undefined): Promise<Config> {
  if (!configFile) {
    return {};
  }
  try {
    const configContent = await fsPromises.readFile(configFile, 'utf8');
    validateConfigContent(configContent);
    const config: unknown = JSON.parse(configContent);
    sanitizeConfigIfNeeded(config);
    return config as Config;
  } catch (error) {
    throw new Error(`Failed to load config file: ${configFile}, ${error}`);
  }
}

async function loadSecretOverrides(path: string | undefined): Promise<Config> {
  return path ? { secrets: await loadSecretsFile(path) } : {};
}

async function loadSecretsFile(path: string): Promise<Record<string, string>> {
  const content = await fsPromises.readFile(path, 'utf8');
  if (content.length > MAX_CONFIG_FILE_SIZE) {
    throw new Error('Secrets file too large');
  }
  const secrets = parseDotenv(content);
  for (const [name, value] of Object.entries(secrets)) {
    if (!value) {
      throw new Error(`Secret value must not be empty: ${name}`);
    }
  }
  return secrets;
}

function validateConfigContent(configContent: string): void {
  if (configContent.length > MAX_CONFIG_FILE_SIZE) {
    throw new Error('Configuration file too large');
  }
  if (
    configContent.includes('__proto__') ||
    configContent.includes('constructor')
  ) {
    throw new Error(
      'Configuration file contains potentially dangerous content'
    );
  }
}

function sanitizeConfigIfNeeded(config: unknown): void {
  if (config && typeof config === 'object') {
    sanitizeConfigObject(config as Record<string, unknown>);
  }
}

function sanitizeConfigObject(obj: Record<string, unknown>): void {
  for (const prop of ['__proto__', 'constructor', 'prototype']) {
    if (Object.hasOwn(obj, prop)) {
      delete obj[prop];
    }
  }
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      sanitizeConfigObject(value as Record<string, unknown>);
    }
  }
}

export async function outputFile(
  config: FullConfig,
  rootPath: string | undefined,
  name: string
): Promise<string> {
  const outputDir =
    config.outputDir ??
    (rootPath ? pathJoin(rootPath, '.playwright-mcp') : undefined) ??
    pathJoin(
      tmpdir(),
      'playwright-mcp-output',
      sanitizeForFilePath(new Date().toISOString())
    );
  await fsPromises.mkdir(outputDir, { recursive: true });
  return pathJoin(outputDir, sanitizeForFilePath(name));
}

function pickDefined<T extends object>(obj: T | undefined): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj ?? {}).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function mergeConfig(base: FullConfig, overrides: Config): FullConfig {
  return {
    ...pickDefined(base),
    ...pickDefined(overrides),
    browser: createMergedBrowserConfig(base, overrides),
    network: {
      ...pickDefined(base.network),
      ...pickDefined(overrides.network),
    },
    server: {
      ...pickDefined(base.server),
      ...pickDefined(overrides.server),
    },
    timeouts: {
      ...pickDefined(base.timeouts),
      ...pickDefined(overrides.timeouts),
    },
    secrets: {
      ...pickDefined(base.secrets),
      ...pickDefined(overrides.secrets),
    },
  } as FullConfig;
}

function createMergedBrowserConfig(
  base: FullConfig,
  overrides: Config
): FullConfig['browser'] {
  const browser: FullConfig['browser'] = {
    ...pickDefined(base.browser),
    ...pickDefined(overrides.browser),
    browserName:
      overrides.browser?.browserName ?? base.browser.browserName ?? 'chromium',
    isolated: overrides.browser?.isolated ?? base.browser.isolated ?? false,
    launchOptions: {
      ...pickDefined(base.browser.launchOptions),
      ...pickDefined(overrides.browser?.launchOptions),
    } as FullConfig['browser']['launchOptions'],
    contextOptions: {
      ...pickDefined(base.browser.contextOptions),
      ...pickDefined(overrides.browser?.contextOptions),
    },
    cdpHeaders: {
      ...base.browser.cdpHeaders,
      ...overrides.browser?.cdpHeaders,
    },
    cdpTimeout:
      overrides.browser?.cdpTimeout ??
      base.browser.cdpTimeout ??
      DEFAULT_CDP_TIMEOUT,
  };
  const args = (browser.launchOptions.args ?? []).filter(
    (arg) => arg !== AUTOMATION_CONTROLLED_ARG
  );
  if (browser.browserName !== 'chromium') {
    browser.launchOptions.channel = undefined;
  } else {
    args.push(AUTOMATION_CONTROLLED_ARG);
  }
  browser.launchOptions.args = args.length ? args : undefined;
  return browser;
}

export function parseToolProfile(value: string): ToolProfile {
  if (value === 'adaptive' || value === 'full' || value === 'minimal') {
    return value;
  }
  throw new Error(`Invalid tool profile: ${value}`);
}

export function parseCodegen(value: string): 'typescript' | 'none' {
  if (value === 'typescript' || value === 'none') {
    return value;
  }
  throw new Error(`Invalid codegen mode: ${value}`);
}

function parseOptionalCodegen(
  value: string | undefined
): 'typescript' | 'none' | undefined {
  return value ? parseCodegen(value) : undefined;
}

export function positiveNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Expected a non-negative number, received: ${value}`);
  }
  return parsed;
}

export function headerParser(
  value: string,
  previous: Record<string, string> = {}
): Record<string, string> {
  const separator = value.indexOf(':');
  if (separator <= 0) {
    throw new Error(`Invalid header: ${value}`);
  }
  const name = value.slice(0, separator).trim();
  const headerValue = value.slice(separator + 1).trim();
  if (!(name && headerValue)) {
    throw new Error(`Invalid header: ${value}`);
  }
  return { ...previous, [name]: headerValue };
}

function headerList(
  value: string | undefined
): Record<string, string> | undefined {
  if (!value) {
    return;
  }
  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>(
      (headers, entry) => headerParser(entry, headers),
      {}
    );
}

export function semicolonSeparatedList(
  value: string | undefined
): string[] | undefined {
  return value
    ? value
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
}

export function commaSeparatedList(
  value: string | undefined
): string[] | undefined {
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
}

function envToNumber(value: string | undefined): number | undefined {
  return value ? positiveNumber(value) : undefined;
}

function envToBoolean(value: string | undefined): boolean | undefined {
  if (value === 'true' || value === '1') {
    return true;
  }
  if (value === 'false' || value === '0') {
    return false;
  }
}

function envToString(value: string | undefined): string | undefined {
  return value ? value.trim() : undefined;
}
