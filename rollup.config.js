import pkg from './package.json'
import ts from 'rollup-plugin-typescript2'
import { terser } from 'rollup-plugin-terser'

export default {
  input: 'src/index.ts',
  output: [
    {
      file: pkg.main,
      format: 'cjs',
    },
    {
      file: pkg.module,
      format: 'es',
    },
  ],
  plugins: [ts(), terser({ format: { ecma: 'es2017', beautify: true } })],
  external: ['os'],
}
