import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['app/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    exclude: ['node_modules/**', 'zhihu-hackathon/**', 'media-crawler/**'],
  },
});
