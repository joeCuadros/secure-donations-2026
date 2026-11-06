import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  AWS_REGION: z.string().default('us-east-1'),
  STAGE: z.enum(['academic', 'staging', 'prod']).default('academic'),
  PROJECTS_TABLE: z.string().min(1, 'PROJECTS_TABLE es obligatorio'),
  DONATIONS_TABLE: z.string().min(1, 'DONATIONS_TABLE es obligatorio'),
  IDEMPOTENCY_TABLE: z.string().min(1, 'IDEMPOTENCY_TABLE es obligatorio'),
  AUDIT_TABLE: z.string().min(1, 'AUDIT_TABLE es obligatorio'),
  S3_BUCKET: z.string().optional().default('secure-donations-assets'),
  COGNITO_USER_POOL_ID: z.string().optional().default('us-east-1_dummy'),
  COGNITO_CLIENT_ID: z.string().optional().default('dummy_client_id'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const getEnv = (): EnvConfig => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Error en configuración de variables de entorno: ${issues}`);
  }
  return result.data;
};

export const env = getEnv();