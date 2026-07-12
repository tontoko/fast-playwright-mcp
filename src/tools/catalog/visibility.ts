import type { ToolProfile } from '../../../config.js';
import type { ToolRegistry } from './registry.js';
import type { ToolGroup, ToolRegistration } from './types.js';

export const ADAPTIVE_BOOTSTRAP_NAMES = Object.freeze([
  'browser_tools',
  'browser_query',
  'browser_execute',
  'browser_batch_execute',
  'browser_navigate',
  'browser_snapshot',
  'browser_find',
] as const);

export const MINIMAL_BOOTSTRAP_NAMES = Object.freeze([
  'browser_tools',
  'browser_query',
  'browser_execute',
] as const);

export class ToolVisibility {
  private readonly enabled = new Set<string>();

  constructor(readonly profile: ToolProfile) {}

  visible(registry: ToolRegistry): ToolRegistration[] {
    if (this.profile === 'full') return [...registry.registrations];
    const bootstrap =
      this.profile === 'minimal'
        ? MINIMAL_BOOTSTRAP_NAMES
        : ADAPTIVE_BOOTSTRAP_NAMES;
    const names = new Set<string>([...bootstrap, ...this.enabled]);
    return registry.registrations.filter(({ tool }) =>
      names.has(tool.schema.name)
    );
  }

  visibleNames(registry: ToolRegistry): string[] {
    return this.visible(registry).map(({ tool }) => tool.schema.name);
  }

  enableTools(registry: ToolRegistry, names: readonly string[]): boolean {
    if (this.profile === 'full') return false;
    for (const name of names) registry.require(name);
    const before = this.enabled.size;
    for (const name of names) this.enabled.add(name);
    return before !== this.enabled.size;
  }

  enableGroups(registry: ToolRegistry, groups: readonly ToolGroup[]): boolean {
    return this.enableTools(
      registry,
      groups.flatMap((group) =>
        registry.byGroup(group).map(({ tool }) => tool.schema.name)
      )
    );
  }

  disableTools(registry: ToolRegistry, names: readonly string[]): boolean {
    if (this.profile === 'full') return false;
    for (const name of names) registry.require(name);
    let changed = false;
    for (const name of names) changed = this.enabled.delete(name) || changed;
    return changed;
  }

  disableGroups(registry: ToolRegistry, groups: readonly ToolGroup[]): boolean {
    return this.disableTools(
      registry,
      groups.flatMap((group) =>
        registry.byGroup(group).map(({ tool }) => tool.schema.name)
      )
    );
  }

  reset(): boolean {
    if (this.profile === 'full') return false;
    const changed = this.enabled.size > 0;
    this.enabled.clear();
    return changed;
  }
}
