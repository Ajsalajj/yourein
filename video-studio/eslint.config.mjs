import next from "eslint-config-next";

export default [
  ...next,
  { ignores: ["data/**", ".next/**", "ai-service/**", "node_modules/**"] },
  { rules: { "react-hooks/set-state-in-effect": "off", "react-hooks/refs": "off", "react-hooks/purity": "off", "react-hooks/immutability": "off", "@next/next/no-img-element": "off" } },
];
