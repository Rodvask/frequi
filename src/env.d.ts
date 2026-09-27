/* Provide Type for Vite's import.meta.env structure */
interface ImportMetaEnv extends Readonly<Record<string, string>> {
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __COMMIT_HASH__: string;

/**
 * Types for the virtual modules that `unplugin-icons` resolves at build time.
 *
 * The plugin is a Vite resolver only: it turns `~icons/mdi/chart-line` into an inline SVG
 * component, and it declares nothing for TypeScript. Without this, every explicit icon import
 * is `TS2307: Cannot find module`, which is what made `pnpm typecheck` report 13 errors in
 * NavBar and 5 in NavFooter -- the imports work at runtime, so the build was always green and
 * the type errors looked like a real problem.
 *
 * The module is declared once with a wildcard rather than one entry per icon, so adding an
 * icon never needs a matching line here. `string` is the component name because the resolver
 * names the generated component after the collection, and the build rewrites every import
 * before this type is ever used.
 */
declare module '~icons/*' {
  import type { FunctionalComponent, SVGAttributes } from 'vue';

  const component: FunctionalComponent<SVGAttributes>;
  export default component;
}
