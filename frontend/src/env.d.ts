/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端 REST API 服务地址 */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
