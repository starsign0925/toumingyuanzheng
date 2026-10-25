# Balance simulator: compiles tools/sim.ts and runs it with the Cocos-bundled Electron runtime.
# Usage:
#   powershell -File tools/sim.ps1 [runsPerHero]              full report
#   powershell -File tools/sim.ps1 600 calib 0.55             HP calibration (target solo clear rate 55%)
param([int]$runs = 3000, [string]$mode = 'report', [string]$target = '0.55')
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:ELECTRON_RUN_AS_NODE = '1'
$cc = 'D:\cocos\Creator\3.8.8\CocosCreator.exe'
$tsc = 'D:\cocos\Creator\3.8.8\resources\app.asar.unpacked\node_modules\typescript\bin\tsc'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
# Pipe output so PowerShell waits for the detached Electron process to finish.
& $cc $tsc -p (Join-Path $here 'tsconfig.json') 2>&1 | Out-String | Write-Output
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $cc (Join-Path $here 'out\tools\sim.js') $runs $mode $target 2>&1 | Out-String | Write-Output
