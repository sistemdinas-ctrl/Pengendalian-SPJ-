import nextVitals from "eslint-config-next/core-web-vitals";
import reactHooks from "eslint-plugin-react-hooks";

const config = [
  ...nextVitals,
  {
    ignores: [".next/**", "node_modules/**", ".kilo/**", "next-env.d.ts"],
  },
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];

export default config;
