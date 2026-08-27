import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

/* Deliberately small. The job here is catching what the bundler cannot:
   undefined identifiers, dead bindings, and hook rules. Style is left alone. */
export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      /* Pre-existing entry-animation and toast timers set state on mount by
         design. Kept visible as warnings rather than silenced or rewritten. */
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['tests/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
];
