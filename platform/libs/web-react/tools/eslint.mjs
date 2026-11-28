// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

// The lint rules every product's React screens follow (S-5): no HTML strings into the page, no javascript: links, rel=noopener on
// target=_blank, the hook rules. A product's eslint.config.mjs is: export default grepxReact({ js, globals, react, hooks }).
export function grepxReact({ js, globals, react, hooks }) {
  return [
    { ignores: ["node_modules/**", "playwright-report/**", "test-results/**"] },
    js.configs.recommended,
    {
      files: ["src/**/*.{js,jsx}", "test/**/*.{js,jsx,mjs}", "*.mjs"],
      languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.browser, ...globals.node }, parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { react, "react-hooks": hooks },
      settings: { react: { version: "19" } },
      rules: {
        ...react.configs.recommended.rules,
        "react/react-in-jsx-scope": "off", "react/prop-types": "off", "react/no-unescaped-entities": "off",
        "react/no-danger": "error", "react/jsx-no-script-url": "error", "react/jsx-no-target-blank": ["error", { allowReferrer: true }],
        "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "error",
        "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      },
    },
    {
      files: ["src/**/*.{js,jsx}"],
      rules: { "no-restricted-syntax": ["error", { selector: "AssignmentExpression[left.property.name='innerHTML']", message: "Do not write innerHTML: build elements." }] },
    },
  ];
}
