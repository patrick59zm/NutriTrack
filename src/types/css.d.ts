// Lets TypeScript accept side-effect CSS imports (src/global.css) without relying on the
// generated, git-ignored expo-env.d.ts, so the typecheck also passes on a fresh checkout.
declare module '*.css';
