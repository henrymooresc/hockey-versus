import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/**
 * Next 16 removed the `next lint` command, so ESLint runs directly.
 * `eslint-config-next` ships flat config, which is why there is no FlatCompat
 * shim here.
 */
const config = [
  { ignores: [".next/**", "coverage/**"] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    name: "hockey-versus/known-debt",
    rules: {
      /**
       * Every data panel resets its state and then fetches, inside one effect.
       * The rule is right that this costs an extra render, but the fix is to
       * restructure fetching in eight components, not to silence it here.
       * Kept visible as a warning until that happens. See TASKS.md.
       */
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
