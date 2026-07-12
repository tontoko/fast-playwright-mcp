/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type * as playwright from 'playwright';

export type ToolCapability =
  | 'core'
  | 'core-tabs'
  | 'core-install'
  | 'vision'
  | 'pdf'
  | 'apps';

export type ToolProfile = 'adaptive' | 'full' | 'minimal';

export type Config = {
  /**
   * Tool catalog profile. Adaptive is the default and exposes a small bootstrap
   * catalog while keeping all registered tools callable by name.
   */
  toolProfile?: ToolProfile;

  /**
   * The browser to use.
   */
  browser?: {
    /** The type of browser to use. */
    browserName?: 'chromium' | 'firefox' | 'webkit';

    /** Keep the browser profile in memory, do not save it to disk. */
    isolated?: boolean;

    /** Path to a user data directory for browser profile persistence. */
    userDataDir?: string;

    /** Launch options passed to Playwright. */
    launchOptions?: playwright.LaunchOptions;

    /** Context options for the browser context. */
    contextOptions?: playwright.BrowserContextOptions;

    /** Chrome DevTools Protocol endpoint. */
    cdpEndpoint?: string;

    /** Headers sent when connecting to a CDP endpoint. */
    cdpHeaders?: Record<string, string>;

    /** CDP connection timeout in milliseconds. */
    cdpTimeout?: number;

    /** Remote Playwright server endpoint. */
    remoteEndpoint?: string;
  };

  server?: {
    /** The port to listen on for SSE or MCP transport. */
    port?: number;

    /** The host to bind the server to. */
    host?: string;

    /** Allowed HTTP Host header values. Use `*` to disable host checks. */
    allowedHosts?: string[];
  };

  /** List of enabled optional capabilities. */
  capabilities?: ToolCapability[];

  /** Whether to save the Playwright session into the output directory. */
  saveSession?: boolean;

  /** Whether to save a Playwright trace into the output directory. */
  saveTrace?: boolean;

  /** The directory to save output files. */
  outputDir?: string;

  /** Maximum output directory size in bytes. Zero disables eviction. */
  outputMaxSize?: number;

  /** Literal values to redact from textual tool responses. */
  secrets?: Record<string, string>;

  /** Attribute used by Playwright test-id selectors. */
  testIdAttribute?: string;

  /** Browser operation timeout configuration. */
  timeouts?: {
    action?: number;
    navigation?: number;
    expect?: number;
  };

  /** Generated Playwright code output mode. */
  codegen?: 'typescript' | 'none';

  network?: {
    /** List of origins to allow the browser to request. */
    allowedOrigins?: string[];

    /** List of origins to block the browser from requesting. */
    blockedOrigins?: string[];
  };

  /** Whether to send image responses to the client. */
  imageResponses?: 'allow' | 'omit';
};
