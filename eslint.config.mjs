import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/**
 * Next 16 removed the `next lint` command, so ESLint runs directly.
 * `eslint-config-next` ships flat config, which is why there is no FlatCompat
 * shim here.
 */
/**
 * No rule overrides. `react-hooks/set-state-in-effect` was a warning while the
 * data panels reset their state inside the fetch effect. They now derive
 * `loading` during render through `useFetchedData`, so the rule is back at its
 * default of error.
 *
 * `@next/next/no-img-element` also stays on. `src/components/RemoteImage.tsx`
 * holds the one exception, and explains why an NHL headshot or team logo is a
 * plain `<img>`. Keeping the rule enabled means a new raw `<img>` anywhere else
 * still fails.
 */
const config = [
  { ignores: [".next/**", "coverage/**"] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default config;
