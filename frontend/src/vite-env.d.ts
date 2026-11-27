/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** IANA time zone used to display timestamps (default Asia/Manila). */
  readonly VITE_DISPLAY_TIME_ZONE?: string;
}
