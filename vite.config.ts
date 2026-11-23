/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Content-Security-Policy als <meta>-Tag, nur im Produktions-Build (der Dev-Server braucht Inline-Skripte).
// Wichtig für GitHub Pages: Dort lassen sich keine eigenen HTTP-Header setzen, `public/_headers` wird ignoriert.
// `frame-ancestors` funktioniert nur als HTTP-Header und fehlt hier deshalb.
const META_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' https://musicbrainz.org https://api.github.com",
  "font-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const cspMeta = (): Plugin => ({
  name: 'musicguess-csp-meta',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: META_CSP }, injectTo: 'head-prepend' },
  ],
});

// VITE_BASE_PATH erlaubt das Hosting in einem Unterordner (z. B. GitHub Pages: "/repo-name/").
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const base = env.VITE_BASE_PATH || '/';
  // Für „Liste fest einbauen“: Repository und Branch. Netlify setzt REPOSITORY_URL und BRANCH beim Build automatisch.
  const repoFromUrl = (process.env.REPOSITORY_URL ?? '').match(/github\.com[/:]([^/]+\/[^/.]+)/)?.[1] ?? '';
  return {
    base,
    define: {
      __GITHUB_REPO__: JSON.stringify(env.VITE_GITHUB_REPO || repoFromUrl),
      __GITHUB_BRANCH__: JSON.stringify(env.VITE_GITHUB_BRANCH || process.env.BRANCH || ''),
    },
    plugins: [react(), cspMeta()],
    server: { host: '127.0.0.1', port: 5173 },
    preview: { host: '127.0.0.1', port: 4173 },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
