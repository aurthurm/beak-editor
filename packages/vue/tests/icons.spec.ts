import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { renderIcon } from '@amusendame/beakblock-vue';
import { createBuiltInCommands } from '@amusendame/beakblock-commands';

const builtinIcons = [...new Set(createBuiltInCommands().map((command) => command.icon).filter(Boolean))] as string[];

function renderOne(icon: string) {
  return mount(defineComponent({ render: () => renderIcon(icon, 'Label') }));
}

describe('Office ribbon icons', () => {
  it.each(builtinIcons)('renders "%s" as an svg with at least one drawn shape', (icon) => {
    const wrapper = renderOne(icon);
    const svg = wrapper.element as SVGElement;
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    const shapes = svg.querySelectorAll('path');
    expect(shapes.length).toBeGreaterThan(0);
    expect((shapes[0] as SVGPathElement).getAttribute('d')?.length ?? 0).toBeGreaterThan(0);
    wrapper.unmount();
  });

  it('falls back to the first letter of the label for unknown icons', () => {
    const wrapper = renderOne('no-such-icon');
    expect(wrapper.find('svg').exists()).toBe(false);
    expect(wrapper.text()).toBe('L');
    wrapper.unmount();
  });
});
