/// <reference types="vite/client" />

// Custom env vars exposed by Vite at build time.
// Anything starting with VITE_ is replaced inline in the bundle.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
