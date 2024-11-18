import globals from 'globals'
import pluginJs from '@eslint/js'
import mochaPlugin from 'eslint-plugin-mocha'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions: { globals: { ...globals.builtin, ...globals.node } },
  },
  pluginJs.configs.recommended,
  eslintPluginUnicorn.configs['flat/recommended'],
  mochaPlugin.configs.flat.recommended,
]
