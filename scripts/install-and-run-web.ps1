$ErrorActionPreference = "Stop"

$RepoUrl = if ($env:MORPHEUS_REPO_URL) { $env:MORPHEUS_REPO_URL } else { "https://github.com/gaoyiiiii/Morpheus.git" }
$AppDir = if ($env:MORPHEUS_HOME) { $env:MORPHEUS_HOME } else { Join-Path $HOME "Morpheus" }
$HostName = if ($env:HOST) { $env:HOST } else { "127.0.0.1" }
$Port = if ($env:PORT) { $env:PORT } else { "2199" }
$LogDir = Join-Path $AppDir ".morpheus"
$LogFile = Join-Path $LogDir "server.log"
$PidFile = Join-Path $LogDir "server.pid"

function Say($Message) {
  Write-Host $Message
}

function Fail($Message) {
  Write-Error "Morpheus setup failed: $Message"
  exit 1
}

function Need-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Fail "missing '$Name'. Please install it and run this command again."
  }
}

function Test-Running($PidText) {
  if (-not $PidText) { return $false }
  try {
    $null = Get-Process -Id ([int]$PidText) -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

function Wait-ForServer($Url) {
  $Deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $Deadline) {
    try {
      Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 | Out-Null
      return $true
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  return $false
}

Need-Command git
Need-Command node
Need-Command npm

Say "Preparing Morpheus Web client..."

if (Test-Path (Join-Path $AppDir ".git")) {
  $CurrentRemote = ""
  try {
    $CurrentRemote = (git -C $AppDir remote get-url origin 2>$null).Trim()
  } catch {}
  if ($CurrentRemote -ne $RepoUrl) {
    Fail "$AppDir already exists and is not the Morpheus repository. Set MORPHEUS_HOME to another directory."
  }
  git -C $AppDir pull --ff-only
} elseif (Test-Path $AppDir) {
  Fail "$AppDir already exists. Move it away or set MORPHEUS_HOME to another directory."
} else {
  git clone $RepoUrl $AppDir
}

Set-Location $AppDir
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

Say "Installing dependencies..."
if (Test-Path "package-lock.json") {
  npm ci
} else {
  npm install
}

Say "Building Morpheus..."
npm run build

$Url = "http://${HostName}:${Port}/"

if ((Test-Path $PidFile) -and (Test-Running (Get-Content $PidFile -ErrorAction SilentlyContinue))) {
  Say "Morpheus is already running."
} else {
  Say "Starting Morpheus at $Url ..."
  $Command = "set HOST=$HostName&& set PORT=$Port&& npm start > `"$LogFile`" 2>&1"
  $Process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $Command -WorkingDirectory $AppDir -WindowStyle Hidden -PassThru
  Set-Content -Path $PidFile -Value $Process.Id
}

if (Wait-ForServer $Url) {
  Say "Morpheus is ready: $Url"
  Start-Process $Url
} else {
  Fail "server did not become ready. See log: $LogFile"
}
