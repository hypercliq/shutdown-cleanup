module.exports = {
  '**/*.ts': () => 'tsc -p tsconfig.json --noEmit',
  '**/*.(j|t)s': 'eslint --fix',
  '**/*.{ts,js,json,md,yml}': 'prettier --write',
}
