module.exports = {
  // '**/*.ts': () => 'tsc -p tsconfig.json --noEmit',
  '**/*.ts': 'eslint --fix',
  '**/*.{ts,js,json,md,yml}': 'prettier --write'
}
