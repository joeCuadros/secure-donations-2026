import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      AWS_REGION: 'us-east-1',
      STAGE: 'academic',
      PROJECTS_TABLE: 'Projects-test',
      DONATIONS_TABLE: 'Donations-test',
      IDEMPOTENCY_TABLE: 'Idempotency-test',
      AUDIT_TABLE: 'AuditEvents-test',
      LOG_LEVEL: 'info',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/**/index.ts',
        'src/**/types.ts',
        'src/shared/types/**',
        'src/shared/aws/**',
      ],
    },
    clearMocks: true,
    restoreMocks: true,
  },
});