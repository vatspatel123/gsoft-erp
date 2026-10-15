# Looks for bills that were made on this PC but never reached the server.
# Copies the software's saved data to a temp folder (the software's own data is never changed),
# reads the copies with find-lost-bills.js, and puts the answers in zip files on the Desktop.
#   LostBills-RESULT-*.zip   the answer (bill list + report). Safe to send.
#   LostBills-RAWDATA-*.zip  a copy of the software's data. It contains the software's login, so
#                            send it ONLY if asked, and delete it afterwards.

$ErrorActionPreference = 'Continue'
$here    = Split-Path -Parent $MyInvocation.MyCommand.Path
$tool    = Join-Path $here 'find-lost-bills.js'
$stamp   = Get-Date -Format 'yyyyMMdd-HHmm'
$desktop = [Environment]::GetFolderPath('Desktop')
$work    = Join-Path $env:TEMP "lostbills-$stamp"
$raw     = Join-Path $work 'raw'
$res     = Join-Path $work 'results'
New-Item -ItemType Directory -Force -Path $raw, $res | Out-Null

function Say([string]$t, [string]$c = 'White') { Write-Host $t -ForegroundColor $c }
function Get-App {
  Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessName -like 'Retail ERP*' -or $_.ProcessName -like 'RetailERP*' -or $_.ProcessName -like 'gsoft-erp*' }
}

Say '=== Find the lost bills ===' 'Cyan'
Say ''

# 1. The software should be closed: while it runs it keeps rewriting the files that may still hold the old bills.
$exe = $null
$running = Get-App
if ($running) {
  $exe = ($running | Where-Object { $_.Path } | Select-Object -First 1).Path
  Say 'The Retail ERP software is OPEN.' 'Yellow'
  Say 'Please CLOSE it now (click the X, and check it is not hiding near the clock).' 'Yellow'
  Say 'Waiting for you to close it...'
  $tries = 0
  while ((Get-App) -and $tries -lt 120) { Start-Sleep -Seconds 2; $tries++ }
  if (Get-App) { Say 'It is still open - continuing anyway (the result may be less complete).' 'Red' }
  else { Say 'Thank you, it is closed.' 'Green' }
  Say ''
}

# 2. Find the software that can run the reader (the installed Retail ERP itself, nothing else is needed).
$candidates = @($exe,
  (Join-Path $env:LOCALAPPDATA 'Programs\Retail ERP\Retail ERP.exe'),
  (Join-Path $env:ProgramFiles 'Retail ERP\Retail ERP.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Retail ERP\Retail ERP.exe')) | Where-Object { $_ -and (Test-Path $_) }
$exe = $candidates | Select-Object -First 1

# 3. Copy the software's saved data (a copy only).
$roots = @((Join-Path $env:APPDATA 'gsoft-erp'), (Join-Path $env:APPDATA 'Retail ERP')) | Where-Object { Test-Path $_ }
if (-not $roots) {
  $roots = Get-ChildItem -Path $env:APPDATA -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName 'Local Storage') } | ForEach-Object { $_.FullName }
}
if (-not $roots) { Say 'Could not find the software data folder in AppData. Please tell Agam.' 'Red' }

foreach ($r in $roots) {
  $name = Split-Path -Leaf $r
  Say "Copying the saved data from: $r"
  foreach ($sub in 'Local Storage', 'IndexedDB', 'Session Storage') {
    $src = Join-Path $r $sub
    if (Test-Path $src) {
      robocopy $src (Join-Path $raw "$name\$sub") /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    }
  }
  $crash = Join-Path $r 'erp-crash.log'
  if (Test-Path $crash) { Copy-Item $crash (Join-Path $res "$name-erp-crash.log") -ErrorAction SilentlyContinue }
}

# What exists and when it was last written (file names and dates only - no contents).
$info = Join-Path $res 'info.txt'
"Collected: $(Get-Date)" | Out-File $info -Encoding utf8
"Computer: $env:COMPUTERNAME   Windows: $([Environment]::OSVersion.VersionString)" | Out-File $info -Append -Encoding utf8
"Software: $exe" | Out-File $info -Append -Encoding utf8
Get-ChildItem -Path $raw -Recurse -File -ErrorAction SilentlyContinue |
  Select-Object @{n = 'File'; e = { $_.FullName.Substring($raw.Length) } }, Length, LastWriteTime |
  Format-Table -AutoSize | Out-String -Width 250 | Out-File $info -Append -Encoding utf8

# 4. Read the copies for unsent bills.
$dirs = Get-ChildItem -Path $raw -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*leveldb' }
$found = 0
if ($exe -and (Test-Path $tool) -and $dirs) {
  Say ''
  Say 'Looking for the missing bills...'
  $env:ELECTRON_RUN_AS_NODE = '1'
  $i = 0
  foreach ($d in $dirs) {
    $i++
    $outJson = Join-Path $res ("bills-$i.json")
    try {
      Start-Process -FilePath $exe -ArgumentList @("`"$tool`"", "`"$($d.FullName)`"", "`"$outJson`"") -Wait -NoNewWindow -ErrorAction Stop | Out-Null
    } catch { Say "  (could not read $($d.Name): $($_.Exception.Message))" 'Red' }
  }
  Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  foreach ($rep in Get-ChildItem -Path $res -Filter '*-report.txt' -ErrorAction SilentlyContinue) {
    $text = Get-Content -Path $rep.FullName -Encoding UTF8 -ErrorAction SilentlyContinue
    $hits = @($text | Where-Object { $_ -match 'INV-L|OFF-' }).Count
    $found += $hits
  }
} else {
  Say ''
  Say 'Could not run the reader here - the data copy below is enough for Agam.' 'Yellow'
}

# 5. Put the answers on the Desktop.
$resultZip = Join-Path $desktop "LostBills-RESULT-$stamp.zip"
$rawZip    = Join-Path $desktop "LostBills-RAWDATA-$stamp.zip"
Compress-Archive -Path (Join-Path $res '*') -DestinationPath $resultZip -Force -ErrorAction SilentlyContinue
if (Test-Path (Join-Path $raw '*')) { Compress-Archive -Path (Join-Path $raw '*') -DestinationPath $rawZip -Force -ErrorAction SilentlyContinue }

Say ''
if ($found -gt 0) { Say "FOUND: the reader saw $found line(s) about unsent bills. Please send the RESULT zip to Agam." 'Green' }
else { Say 'The reader did not find the bills in the result. Please still send the RESULT zip to Agam; he may ask for the RAWDATA zip too.' 'Yellow' }
Say ''
Say "On your Desktop:" 'Cyan'
Say "  $resultZip   <-- send this one"
if (Test-Path $rawZip) { Say "  $rawZip   <-- only if Agam asks (contains the software's login: delete it afterwards)" }
if (Test-Path $resultZip) { Start-Process explorer.exe -ArgumentList "/select,`"$resultZip`"" }
