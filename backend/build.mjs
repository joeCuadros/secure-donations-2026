// Empaquetado de las funciones Lambda (multiplataforma: no depende de rm ni de globs del shell).
// Salida: dist/<módulo>/api.js en CommonJS, que SAM referencia como `<módulo>/api.<handler>`.
// El SDK de AWS v3 se incluye en el paquete (no se marca como externo) para fijar la versión probada.
import { rmSync } from 'node:fs';
import { build } from 'esbuild';

const modules = ['projects', 'donations', 'audit'];

rmSync('dist', { recursive: true, force: true });

await build({
  entryPoints: modules.map((name) => `src/${name}/api.ts`),
  outbase: 'src',
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'info',
});
