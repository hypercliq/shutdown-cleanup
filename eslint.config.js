import globals from 'globals'
import pluginJs from '@eslint/js'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    // TypeScript declarations/fixtures are validated by test:types, not ESLint.
    ignores: ['**/*.ts', 'coverage/**', 'scrap/**', '_site/**'],
  },
  {
    languageOptions: { globals: { ...globals.builtin, ...globals.node } },
  },
  pluginJs.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  eslintPluginUnicorn.configs['recommended'],
]
