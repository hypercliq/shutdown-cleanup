module.exports = {
  types: [
    { type: 'feat', section: 'Features' },
    { type: 'fix', section: 'Fixes' },
    { type: 'chore', section: 'Chores', hidden: true },
    { type: 'build', section: 'Build', hidden: true },
    { type: 'ci', section: 'CI/CD', hidden: false },
    { type: 'docs', section: 'Documentation', hidden: false },
    { type: 'style', section: 'Style', hidden: true },
    { type: 'refactor', section: 'Refactoring', hidden: false },
    { type: 'perf', section: 'Improvements' },
    { type: 'test', section: 'Tests', hidden: false },
  ],
}
