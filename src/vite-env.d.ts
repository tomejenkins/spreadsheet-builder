/// <reference types="vite/client" />

declare module '*.css';

interface ImportMetaEnv {
  readonly VITE_INTAKE_FORM_URL?: string;
  readonly PUBLIC_INTAKE_FORM_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
