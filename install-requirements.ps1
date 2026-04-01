# Mobile Garage – install Node and Python dependencies on Windows.
# From the repo folder, run:  .\install-requirements.ps1
# (PowerShell requires .\ to run a script in the current directory.)
# If scripts are blocked:  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force

param(
    [switch] $SkipPython,
    [switch] $SkipDymotest,
    [switch] $SkipDbMigrate
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

function Test-Command {
    param([string] $Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

# dymotest pins old deps; wheels exist for 3.11–3.13. 3.14 often tries to compile pydantic_core (needs Rust on PATH).
function Get-DymotestVenvPythonLauncher {
    if (-not (Test-Command "py")) { return $null }
    foreach ($spec in @("-3.12", "-3.13", "-3.11")) {
        & py $spec -c "pass" 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { return $spec }
    }
    return $null
}

function Get-PythonVersionTuple {
    param([string] $PythonExe)
    $out = & $PythonExe -c "import sys; print(sys.version_info[0], sys.version_info[1])" 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    $parts = $out -split '\s+'
    return @{ Major = [int]$parts[0]; Minor = [int]$parts[1] }
}

Write-Host "== Mobile Garage: install requirements ==" -ForegroundColor Cyan

# --- Node.js ---
if (-not (Test-Command "node")) {
    Write-Error "Node.js is not installed or not on PATH. Install LTS from https://nodejs.org/ then re-run this script."
}
if (-not (Test-Command "npm")) {
    Write-Error "npm is not on PATH. Reinstall Node.js or fix your PATH."
}

$nodeVer = node -v
Write-Host "Using Node $nodeVer" -ForegroundColor Gray

Write-Host "`n[npm] project root (concurrently)" -ForegroundColor Yellow
npm install

Write-Host "`n[npm] server" -ForegroundColor Yellow
Push-Location (Join-Path $Root "server")
try {
    npm install
    # Native addon must match current Node (e.g. after upgrading 22 -> 24)
    Write-Host "`n[npm] rebuild better-sqlite3 for this Node version" -ForegroundColor Gray
    npm rebuild better-sqlite3
} finally {
    Pop-Location
}

Write-Host "`n[npm] print-service" -ForegroundColor Yellow
Push-Location (Join-Path $Root "print-service")
try {
    npm install
} finally {
    Pop-Location
}

if (-not $SkipDbMigrate) {
    Write-Host "`n[db] SQLite migrate (server)" -ForegroundColor Yellow
    Push-Location (Join-Path $Root "server")
    try {
        npm run db:migrate
    } finally {
        Pop-Location
    }
} else {
    Write-Host "`n[db] Skipped db:migrate (-SkipDbMigrate)" -ForegroundColor Gray
}

# --- Python (DYMO COM / tooling) ---
if (-not $SkipPython) {
    $py = $null
    foreach ($cmd in @("py", "python3", "python")) {
        if (Test-Command $cmd) {
            $py = $cmd
            break
        }
    }
    if (-not $py) {
        Write-Warning "Python not found on PATH. Skipping pip installs. Install from https://www.python.org/ (check 'Add to PATH') or use -SkipPython intentionally."
    } else {
        Write-Host "`n[pip] root requirements.txt (pywin32, etc.)" -ForegroundColor Yellow
        & $py -m pip install --upgrade pip
        & $py -m pip install -r (Join-Path $Root "requirements.txt")

        if (-not $SkipDymotest) {
            $dymoDir = Join-Path $Root "dymotest"
            $venvPath = Join-Path $dymoDir ".venv"
            if (Test-Path (Join-Path $dymoDir "requirements.txt")) {
                Write-Host "`n[pip] dymotest virtual env (.venv)" -ForegroundColor Yellow
                $venvPy = Join-Path $venvPath "Scripts\python.exe"
                if (Test-Path $venvPy) {
                    $vt = Get-PythonVersionTuple $venvPy
                    if ($null -ne $vt -and $vt.Major -eq 3 -and $vt.Minor -ge 14) {
                        Write-Host "Removing existing dymotest\.venv (Python 3.$($vt.Minor): pinned packages lack wheels; use 3.12/3.13)." -ForegroundColor Yellow
                        Remove-Item -LiteralPath $venvPath -Recurse -Force
                    }
                }
                $launcher = Get-DymotestVenvPythonLauncher
                if (-not (Test-Path $venvPy)) {
                    if ($null -ne $launcher) {
                        Write-Host "Creating dymotest venv with: py $launcher (wheels for pinned deps; avoid Python 3.14+ here)" -ForegroundColor Gray
                        & py $launcher -m venv $venvPath
                        if ($LASTEXITCODE -ne 0) { throw "dymotest: py $launcher -m venv failed" }
                    } else {
                        $exeLines = @(& $py -c "import sys; print(sys.executable)" 2>$null | Select-Object -First 1)
                        $exeForCheck = if ($exeLines.Count -gt 0 -and $exeLines[0]) { [string]$exeLines[0].Trim() } else { $null }
                        if ($LASTEXITCODE -ne 0 -or -not $exeForCheck) {
                            Write-Warning "dymotest: Could not resolve Python executable; skipping dymotest venv."
                        } else {
                            $rootVt = Get-PythonVersionTuple $exeForCheck
                            if ($null -ne $rootVt -and $rootVt.Major -eq 3 -and $rootVt.Minor -ge 14) {
                                Write-Warning "dymotest: Install Python 3.12 (or use the 'py' launcher with 3.12/3.13), then rerun. Or use -SkipDymotest. Skipping dymotest venv."
                            } else {
                                & $py -m venv $venvPath
                                if ($LASTEXITCODE -ne 0) { throw "dymotest: venv creation failed" }
                            }
                        }
                    }
                }
                if (-not (Test-Path $venvPy)) {
                    Write-Warning "dymotest .venv was not created; skipped."
                } else {
                    # Always use python -m pip (avoids 'To modify pip, please run python -m pip' on Windows)
                    & $venvPy -m pip install --upgrade pip
                    if ($LASTEXITCODE -ne 0) { throw "dymotest: pip upgrade failed" }
                    & $venvPy -m pip install -r (Join-Path $dymoDir "requirements.txt")
                    if ($LASTEXITCODE -ne 0) { throw "dymotest: pip install failed" }
                    Write-Host "Activate dymotest venv:  .\.venv\Scripts\Activate.ps1  (from dymotest folder)" -ForegroundColor Gray
                }
            }
        } else {
            Write-Host "`n[pip] Skipped dymotest (-SkipDymotest)" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "`n[pip] Skipped Python (-SkipPython)" -ForegroundColor Gray
}

Write-Host "`nDone. Next: copy/configure .env files (see README.md and DYMO_SETUP.md), then run start_mobile_garage.bat or npm start." -ForegroundColor Green
