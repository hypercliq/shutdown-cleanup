param(
  [Parameter(Mandatory = $true)][string]$Node,
  [Parameter(Mandatory = $true)][string]$Fixture,
  [Parameter(Mandatory = $true)][string]$Journal,
  [Parameter(Mandatory = $true)][string]$Signal,
  [Parameter(Mandatory = $true)][string]$Mode,
  [Parameter(Mandatory = $true)][string]$Action,
  [switch]$IgnoredCtrlC
)
$ErrorActionPreference = 'Stop'
try {
  Add-Type -Path "$PSScriptRoot/windows-console.cs"
  if ($IgnoredCtrlC) { [ShutdownConsoleHarness]::IgnoreCtrlCForChildren() }
  $code = [ShutdownConsoleHarness]::Run($Node, $Fixture, $Journal, $Signal, $Mode, $Action)
  @{ code = $code } | ConvertTo-Json -Compress
} catch {
  [Console]::Error.WriteLine($_.Exception.ToString())
  exit 1
}
