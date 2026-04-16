$ErrorActionPreference = 'Stop'

Write-Host 'Building balconx...'
bun run build

Write-Host 'Registering/linking balconx with Bun...'
bun link

$binDir = (bun pm bin).Trim()
Write-Host "Bun global bin: $binDir"

$cmd = Get-Command balconx -ErrorAction SilentlyContinue
if ($cmd) {
  Write-Host "Done. balconx is available at: $($cmd.Source)"
  Write-Host 'Try: balconx'
  exit 0
}

Write-Warning 'balconx is not on PATH in this shell yet.'
Write-Host 'Try one of these:'
Write-Host '  1. Open a new terminal and run: balconx'
Write-Host "  2. Add this directory to PATH: $binDir"
Write-Host '  3. Then run: balconx'
