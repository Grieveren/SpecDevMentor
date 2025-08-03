// @ts-nocheck
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_ENVIRONMENT: 'development' | 'staging' | 'production';
  readonly VITE_ENABLE_ANALYTICS: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_OPENAI_API_KEY: string;
  readonly VITE_REDIS_URL: string;
  readonly VITE_DATABASE_URL: string;
  readonly VITE_JWT_SECRET: string;
  readonly VITE_ENCRYPTION_KEY: string;
  readonly VITE_SMTP_HOST: string;
  readonly VITE_SMTP_PORT: string;
  readonly VITE_SMTP_USER: string;
  readonly VITE_SMTP_PASS: string;
  readonly VITE_AWS_ACCESS_KEY_ID: string;
  readonly VITE_AWS_SECRET_ACCESS_KEY: string;
  readonly VITE_AWS_REGION: string;
  readonly VITE_S3_BUCKET: string;
  readonly VITE_GITHUB_CLIENT_ID: string;
  readonly VITE_GITHUB_CLIENT_SECRET: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_GOOGLE_CLIENT_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
