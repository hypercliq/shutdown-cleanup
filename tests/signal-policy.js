// A deliberate integration allowlist, rather than all os.constants.signals.
// Other signals can still be registered through the existing API.
export const posixSignals = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGUSR2']

const reasons = {
  SIGKILL: 'Uncatchable forced termination; tested for absence of cleanup.',
  SIGSTOP: 'Uncatchable suspension, not a cleanup trigger.',
  SIGCONT:
    'Resumes a suspended process; outside the shutdown support contract.',
  SIGUSR1: 'Node reserves this signal for starting its debugger.',
  SIGABRT: 'Abort/crash signal; graceful cleanup is not a supported guarantee.',
  SIGIOT: 'Alias of the abort/crash signal; no graceful cleanup guarantee.',
  SIGBUS: 'Hardware fault; graceful cleanup is not a supported guarantee.',
  SIGFPE: 'Hardware fault; graceful cleanup is not a supported guarantee.',
  SIGILL: 'Hardware fault; graceful cleanup is not a supported guarantee.',
  SIGSEGV: 'Hardware fault; graceful cleanup is not a supported guarantee.',
  SIGTRAP: 'Debugger trap; outside the shutdown support contract.',
  SIGQUIT:
    'Quit/core-dump signal; outside the graceful shutdown support contract.',
  SIGSYS: 'Invalid system call; graceful cleanup is not a supported guarantee.',
  SIGSTKFLT: 'Stack fault; graceful cleanup is not a supported guarantee.',
  SIGBREAK: 'Windows console event; validated using GenerateConsoleCtrlEvent.',
}

export const signalSkipReason = (signal, platform) => {
  if (platform === 'win32') {
    if (['SIGINT', 'SIGHUP', 'SIGBREAK'].includes(signal)) {
      return 'Native console delivery replaces POSIX kill: Ctrl+C, Ctrl+Break or console closure.'
    }
    if (signal === 'SIGTERM') {
      return 'Windows kill(SIGTERM) is forced termination, validated for absence of cleanup.'
    }
    return (
      reasons[signal] ??
      'Windows has no POSIX signal delivery; native console/termination tests replace kill-based tests.'
    )
  }
  return (
    reasons[signal] ??
    'Job-control, resource, timer or device notification outside the shutdown support contract.'
  )
}
