import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

import { vi } from 'vitest';

vi.stubGlobal(
  'matchMedia',
  vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
);
vi.mock('@cloudscape-design/global-styles', () => ({
  applyMode: vi.fn(),
  Mode: { Light: 'light', Dark: 'dark' },
}));

// Cloudscape measures layout with ResizeObserver, which jsdom lacks.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
