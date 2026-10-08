import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TooltipLayer } from './TooltipLayer';

describe('TooltipLayer', () => {
  it('shows a tooltip at once on hover and hides it when the pointer leaves', () => {
    render(
      <>
        <button data-tooltip="Archive">
          <svg />
        </button>
        <TooltipLayer />
      </>,
    );
    fireEvent.mouseOver(screen.getByRole('button').querySelector('svg')!);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Archive');

    fireEvent.mouseOut(screen.getByRole('button'), { relatedTarget: document.body });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
