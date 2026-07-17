import type { AnyTool } from '../tool.js';
import type {
  RegistrationOverrides,
  ToolGroup,
  ToolRegistration,
} from './types.js';

const MAX_DESCRIPTION_LENGTH = 180;
const WORD_PATTERN = /[a-z0-9]+/gu;
const BROWSER_PREFIX_PATTERN = /^browser_/u;
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.toLowerCase()))];
}

function inferToolGroup(tool: AnyTool): ToolGroup {
  const name = tool.schema.name;
  if (tool.capability === 'vision') {
    return 'vision';
  }
  if (tool.capability === 'pdf' || name.includes('pdf')) {
    return 'pdf';
  }
  if (name.startsWith('browser_network')) {
    return 'network';
  }
  if (
    name.startsWith('browser_tab_') ||
    name.startsWith('browser_navigate') ||
    name.includes('navigate_back') ||
    name.includes('navigate_forward')
  ) {
    return 'navigation';
  }
  if (name.includes('diagnose') || name.includes('find_elements')) {
    return 'diagnostics';
  }
  if (
    name.includes('snapshot') ||
    name.includes('screenshot') ||
    name.includes('inspect') ||
    name.includes('console') ||
    name.includes('evaluate') ||
    name.includes('wait') ||
    name === 'browser_find'
  ) {
    return 'inspection';
  }
  if (name.includes('storage') || name.includes('cookie')) {
    return 'storage';
  }
  if (name.includes('verify') || name.includes('expect')) {
    return 'testing';
  }
  return 'interaction';
}

function defaultKeywords(tool: AnyTool): string[] {
  const source = [tool.schema.name, tool.schema.title, tool.schema.description]
    .join(' ')
    .toLowerCase();
  return unique(source.match(WORD_PATTERN) ?? []);
}

export function registerTools(
  tools: readonly AnyTool[],
  overrides: RegistrationOverrides = {}
): ToolRegistration[] {
  return tools.map((tool) => {
    const override = overrides[tool.schema.name] ?? {};
    const alias = tool.schema.name
      .replace(BROWSER_PREFIX_PATTERN, '')
      .replaceAll('_', ' ');
    return {
      tool,
      group: override.group ?? inferToolGroup(tool),
      aliases: Object.freeze(
        unique(override.aliases ?? (alias ? [alias] : []))
      ),
      keywords: Object.freeze(
        unique(override.keywords ?? defaultKeywords(tool))
      ),
      bootstrap:
        override.bootstrap ??
        (tool.capability === 'vision' ||
          tool.capability === 'pdf' ||
          tool.capability === 'apps'),
      upstreamSource: override.upstreamSource,
    };
  });
}

function validateUpstreamSource(registration: ToolRegistration): void {
  const source = registration.upstreamSource;
  if (!source) {
    return;
  }
  const name = registration.tool.schema.name;
  if (!REPOSITORY_PATTERN.test(source.repository)) {
    throw new Error(`Invalid upstream repository for ${name}`);
  }
  if (!FULL_SHA_PATTERN.test(source.commit)) {
    throw new Error(`Invalid upstream commit for ${name}`);
  }
  const segments = source.path.split('/');
  if (
    source.path.startsWith('/') ||
    source.path.includes('\\') ||
    segments.some((segment) => !segment || segment === '..')
  ) {
    throw new Error(`Invalid upstream path for ${name}`);
  }
}

function validateRegistration(
  registration: ToolRegistration,
  existingNames: ReadonlyMap<string, ToolRegistration>
): void {
  const name = registration.tool.schema.name;
  if (existingNames.has(name)) {
    throw new Error(`Duplicate tool registration: ${name}`);
  }
  if (registration.tool.schema.description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Tool description exceeds 180 characters: ${name}`);
  }
  validateUpstreamSource(registration);
}

function freezeRegistration(registration: ToolRegistration): ToolRegistration {
  return Object.freeze({
    ...registration,
    aliases: Object.freeze([...registration.aliases]),
    keywords: Object.freeze([...registration.keywords]),
  });
}

export class ToolRegistry {
  readonly registrations: readonly ToolRegistration[];
  private readonly byName: ReadonlyMap<string, ToolRegistration>;

  constructor(registrations: readonly ToolRegistration[]) {
    const byName = new Map<string, ToolRegistration>();
    for (const registration of registrations) {
      validateRegistration(registration, byName);
      byName.set(
        registration.tool.schema.name,
        freezeRegistration(registration)
      );
    }
    this.registrations = Object.freeze([...byName.values()]);
    this.byName = byName;
  }

  get(name: string): ToolRegistration | undefined {
    return this.byName.get(name);
  }

  require(name: string): ToolRegistration {
    const registration = this.get(name);
    if (!registration) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return registration;
  }

  names(): string[] {
    return this.registrations.map(({ tool }) => tool.schema.name);
  }

  byGroup(group: ToolGroup): ToolRegistration[] {
    return this.registrations.filter(
      (registration) => registration.group === group
    );
  }
}
