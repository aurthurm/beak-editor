import { afterEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createBuiltInCommands } from '@amusendame/beakblock-commands';

import { OfficeIcon } from './icons';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const builtinIcons = [...new Set(createBuiltInCommands().map((command) => command.icon).filter(Boolean))] as string[];

const mounted: Array<{ root: Root; host: HTMLElement }> = [];

afterEach(() => {
  while (mounted.length) {
    const { root, host } = mounted.pop()!;
    act(() => root.unmount());
    host.remove();
  }
});

function renderIcon(name: string | null | undefined, label?: string): HTMLElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  act(() => {
    root.render(createElement(OfficeIcon, { name, label }));
  });
  return host;
}

describe('OfficeIcon', () => {
  it.each(builtinIcons)('renders "%s" as an svg with at least one drawn shape', (icon) => {
    const host = renderIcon(icon);
    const svg = host.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
    const shapes = svg?.querySelectorAll('path') ?? [];
    expect(shapes.length).toBeGreaterThan(0);
    expect(shapes[0].getAttribute('d')?.length ?? 0).toBeGreaterThan(0);
  });

  it('falls back to the first letter for unknown icon names', () => {
    const host = renderIcon('no-such-icon');
    expect(host.querySelector('svg')).toBeNull();
    expect(host.textContent).toBe('N');
  });
});
