import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        // The official jest mock for AsyncStorage; vitest has no jest preset,
        // so the real native module must be redirected in tests.
        find: /^@react-native-async-storage\/async-storage$/,
        replacement: '@react-native-async-storage/async-storage/jest/async-storage-mock',
      },
    ],
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
