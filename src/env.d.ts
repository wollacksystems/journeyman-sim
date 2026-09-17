/**
 * Ambient typing for the optional `import.meta.env` access
 * (`import.meta.env?.VITE_CAPTURE_WIDTH` etc.).
 *
 * The build chain has no `vite/client` types, so `import.meta.env` is not
 * otherwise declared. In browsers the value is populated by Vite; in
 * headless/Node bundles it is `undefined`, and every consumer optional-chains
 * it so the module still loads (falling back to the defaults).
 */
interface ImportMeta {
  env?: Record<string, string | number | boolean | undefined>;
}
