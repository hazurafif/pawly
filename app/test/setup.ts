// vitest setup — reserved for global mocks; none needed yet.
import { vi } from 'vitest';

// The AsyncStorage jest mock calls jest.fn() at module load; vitest exposes vi.
(globalThis as unknown as { jest: typeof vi }).jest = vi;
