module.exports = {
  'src/**/*.js': () => 'tsc -p tsconfig.json --noEmit',
  '**/*': ['prettier-standard --lint', 'git add']
}
