import { describe, expect, it } from 'vitest';

import { createBuiltInCommands } from './builtins';
import { BUILTIN_ICON_PATHS, hasBuiltinIcon } from './icons';

describe('built-in command icons', () => {
  const names = [...new Set(createBuiltInCommands().map((command) => command.icon).filter(Boolean))] as string[];

  it('has path data for every icon used by createBuiltInCommands', () => {
    expect(names.length).toBeGreaterThan(0);
    const missing = names.filter((name) => !hasBuiltinIcon(name));
    expect(missing).toEqual([]);
  });

  it('has non-empty path data for every entry', () => {
    for (const [name, d] of Object.entries(BUILTIN_ICON_PATHS)) {
      expect(d.trim().length, name).toBeGreaterThan(0);
    }
  });
});
