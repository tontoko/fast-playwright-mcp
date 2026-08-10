from pathlib import Path

path = Path('src/extension/cdp-relay.ts')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one marker, found {count}')
    text = text.replace(old, new, 1)


replace_once(
    "import { httpAddressToString } from '../http-server.js';",
    "import { httpAddressToString, isHostAllowed } from '../http-server.js';",
    'HTTP server import',
)

replace_once(
    "const DANGEROUS_PROPS = new Set(['__proto__', 'constructor', 'prototype']);\n",
    """const DANGEROUS_PROPS = new Set(['__proto__', 'constructor', 'prototype']);

function isAllowedRelayOrigin(
  origin: string | undefined,
  boundHost: string
): boolean {
  if (!origin) {
    return true;
  }
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return true;
    }
    return isHostAllowed(url.host, boundHost, undefined);
  } catch {
    return false;
  }
}

export function isRelayUpgradeAllowed(
  hostHeader: string | undefined,
  origin: string | undefined,
  boundHost: string
): boolean {
  return (
    isHostAllowed(hostHeader, boundHost, undefined) &&
    isAllowedRelayOrigin(origin, boundHost)
  );
}

export function launchBrowserProcess(
  executablePath: string,
  args: readonly string[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    let spawned = false;
    const child = spawn(executablePath, [...args], {
      windowsHide: true,
      detached: true,
      shell: false,
      stdio: 'ignore',
    });
    child.once('spawn', () => {
      spawned = true;
      child.unref();
      resolve();
    });
    child.on('error', (error) => {
      if (!spawned) {
        reject(error);
        return;
      }
      cdpRelayDebug('Detached browser process error:', error);
    });
  });
}
""",
    'relay helpers',
)

replace_once(
    """    this._wsHost = httpAddressToString(server.address()).replace(
      HTTP_TO_WS_REGEX,
      'ws'
    );
""",
    """    const httpAddress = httpAddressToString(server.address());
    this._wsHost = httpAddress.replace(HTTP_TO_WS_REGEX, 'ws');
    const boundHost = new URL(httpAddress).hostname;
""",
    'relay bound host',
)

replace_once(
    """    this._wss = new WebSocketServer({ server });
    this._wss.on('connection', this._onConnection.bind(this));
""",
    """    this._wss = new WebSocketServer({
      server,
      verifyClient: (info, done) => {
        const allowed = isRelayUpgradeAllowed(
          info.req.headers.host,
          info.origin,
          boundHost
        );
        if (allowed) {
          done(true);
        } else {
          done(false, 403, 'Forbidden');
        }
      },
    });
    this._wss.on('connection', this._onConnection.bind(this));
""",
    'relay WebSocket validation',
)

replace_once(
    """    if (this._userDataDir) {
      args.push(`--user-data-dir=${this._userDataDir}`);
      if (!this._executablePath) {
        const profile = await findExtensionProfile(
          this._userDataDir,
          extensionId
        );
        if (profile) {
          args.push(`--profile-directory=${profile}`);
        }
      }
    }
""",
    """    if (this._userDataDir) {
      args.push(`--user-data-dir=${this._userDataDir}`);
      const profile = await findExtensionProfile(
        this._userDataDir,
        extensionId
      );
      if (profile) {
        args.push(`--profile-directory=${profile}`);
      }
    }
""",
    'custom executable profile discovery',
)

replace_once(
    """    spawn(executablePath, args, {
      windowsHide: true,
      detached: true,
      shell: false,
      stdio: 'ignore',
    });
""",
    "    await launchBrowserProcess(executablePath, args);\n",
    'browser spawn boundary',
)

path.write_text(text, encoding='utf-8')
