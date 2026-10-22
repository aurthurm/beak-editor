/**
 * ZoomControl and ViewModeControl - zoom, view mode, page layout and focus toggles.
 *
 * These are controlled components. The shell or the app decides what each view renders.
 * `print-preview` is supplied by the app (see `renderPrintPreview` on OfficeShell).
 *
 * @module
 */

import React from 'react';
import { joinClass } from './shared';
import { OfficeIcon } from './icons';

/** Zoom presets offered in the zoom dropdown. */
export const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** Office view modes. */
export type OfficeViewMode = 'print' | 'draft' | 'outline' | 'preview';

/** View mode labels, in ribbon order. */
export const OFFICE_VIEW_MODES: { id: OfficeViewMode; label: string }[] = [
  { id: 'print', label: 'Print Layout' },
  { id: 'draft', label: 'Draft' },
  { id: 'outline', label: 'Outline' },
  { id: 'preview', label: 'Print Preview' },
];

/** Props for {@link ZoomControl}. */
export interface ZoomControlProps {
  /** Zoom factor, where 1 is 100%. */
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

/** Zoom out / in buttons with a preset dropdown. */
export function ZoomControl({ value, onChange, min = 0.5, max = 2, className }: ZoomControlProps): React.ReactElement {
  const clampZoom = (next: number) => Math.round(Math.min(max, Math.max(min, next)) * 100) / 100;
  const percent = Math.round(value * 100);
  return (
    <div className={joinClass('bb-office-zoom', className)} role="group" aria-label="Zoom">
      <button
        type="button"
        className="bb-office-button bb-office-button-small"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={value <= min}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onChange(clampZoom(value - 0.1))}
      >
        <OfficeIcon name="zoom-out" size={14} />
      </button>
      <select
        className="bb-office-zoom-select"
        aria-label="Zoom level"
        value={String(value)}
        onChange={(event) => onChange(clampZoom(Number(event.target.value)))}
      >
        {!ZOOM_PRESETS.includes(value as (typeof ZOOM_PRESETS)[number]) && (
          <option value={String(value)}>{percent}%</option>
        )}
        {ZOOM_PRESETS.map((preset) => (
          <option key={preset} value={String(preset)}>
            {Math.round(preset * 100)}%
          </option>
        ))}
      </select>
      <button
        type="button"
        className="bb-office-button bb-office-button-small"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={value >= max}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onChange(clampZoom(value + 0.1))}
      >
        <OfficeIcon name="zoom-in" size={14} />
      </button>
    </div>
  );
}

/** Props for {@link ViewModeControl}. */
export interface ViewModeControlProps {
  viewMode: OfficeViewMode;
  onViewModeChange: (mode: OfficeViewMode) => void;
  /** Show pages side by side or stacked. Omit to hide the control. */
  multiPage?: boolean;
  onMultiPageChange?: (multiPage: boolean) => void;
  /** Fit pages to the window width instead of the page size. Omit to hide the control. */
  fitWidth?: boolean;
  onFitWidthChange?: (fitWidth: boolean) => void;
  /** Hide chrome and dim everything except the editor. Omit to hide the control. */
  focusMode?: boolean;
  onFocusModeChange?: (focusMode: boolean) => void;
  className?: string;
}

/** View switch (Print Layout, Draft, Outline, Print Preview) with page and focus toggles. */
export function ViewModeControl({
  viewMode,
  onViewModeChange,
  multiPage,
  onMultiPageChange,
  fitWidth,
  onFitWidthChange,
  focusMode,
  onFocusModeChange,
  className,
}: ViewModeControlProps): React.ReactElement {
  return (
    <div className={joinClass('bb-office-view-controls', className)}>
      <div className="bb-office-view-switch" role="radiogroup" aria-label="View">
        {OFFICE_VIEW_MODES.map((mode) => {
          const selected = mode.id === viewMode;
          return (
            <button
              key={mode.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={joinClass('bb-office-view-switch-button', selected && 'is-active')}
              data-view-mode={mode.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onViewModeChange(mode.id)}
            >
              {mode.label}
            </button>
          );
        })}
      </div>
      {onMultiPageChange && (
        <button
          type="button"
          className={joinClass('bb-office-button', 'bb-office-button-small', multiPage && 'is-pressed')}
          aria-pressed={!!multiPage}
          title="Multiple pages"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onMultiPageChange(!multiPage)}
        >
          Multiple pages
        </button>
      )}
      {onFitWidthChange && (
        <button
          type="button"
          className={joinClass('bb-office-button', 'bb-office-button-small', fitWidth && 'is-pressed')}
          aria-pressed={!!fitWidth}
          title="Page width"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onFitWidthChange(!fitWidth)}
        >
          Page width
        </button>
      )}
      {onFocusModeChange && (
        <button
          type="button"
          className={joinClass('bb-office-button', 'bb-office-button-small', focusMode && 'is-pressed')}
          aria-pressed={!!focusMode}
          title="Focus mode"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onFocusModeChange(!focusMode)}
        >
          Focus
        </button>
      )}
    </div>
  );
}
