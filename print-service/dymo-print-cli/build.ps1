# Build DymoPrint.exe (x86). Uses dotnet build (SDK-style) or MSBuild (legacy).
$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -LiteralPath $MyInvocation.MyCommand.Path

# 1) Try dotnet build (SDK-style project; requires .NET SDK with net48 targeting)
$sdkProj = Join-Path $scriptDir "DymoPrintCli.sdk.csproj"
$dotnet = (Get-Command dotnet -ErrorAction SilentlyContinue).Path
if (-not $dotnet -and (Test-Path "C:\Program Files\dotnet\dotnet.exe")) { $dotnet = "C:\Program Files\dotnet\dotnet.exe" }
if ($dotnet) {
    if (Test-Path $sdkProj) {
        Write-Host "Building with dotnet (DymoPrintCli.sdk.csproj)..."
        Push-Location $scriptDir
        try {
            & $dotnet build $sdkProj -c Release -p:Platform=x86
            if ($LASTEXITCODE -eq 0) {
                $exe = Join-Path $scriptDir "bin\Release\net48\DymoPrint.exe"
                if (Test-Path $exe) {
                    Write-Host "Built: $exe"
                    $binDir = Join-Path (Split-Path (Split-Path $scriptDir)) "bin"
                    if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir | Out-Null }
                    Copy-Item $exe $binDir -Force
                    Write-Host "Copied to: $binDir\DymoPrint.exe"
                    exit 0
                }
            }
        } finally { Pop-Location }
    }
}

# 2) Try MSBuild (legacy .csproj; requires Visual Studio with .NET desktop workload)
$msbuild = $null
$vswherePath = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswherePath) {
    $msbuild = & $vswherePath -latest -requires Microsoft.Component.MSBuild -find "MSBuild\**\Bin\MSBuild.exe" 2>$null | Select-Object -First 1
}
if (-not $msbuild -or -not (Test-Path $msbuild)) {
    $candidates = @(
        "C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe",
        "C:\Program Files\Microsoft Visual Studio\2022\Professional\MSBuild\Current\Bin\MSBuild.exe",
        "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $msbuild = $c; break }
    }
}
if ($msbuild -and (Test-Path $msbuild)) {
    Write-Host "Building with MSBuild: $msbuild"
    & $msbuild (Join-Path $scriptDir "DymoPrintCli.csproj") /p:Configuration=Release /p:Platform=x86 /v:minimal
    if ($LASTEXITCODE -eq 0) {
        $exe = Join-Path $scriptDir "bin\Release\DymoPrint.exe"
        if (Test-Path $exe) {
            Write-Host "Built: $exe"
            $binDir = Join-Path (Split-Path (Split-Path $scriptDir)) "bin"
            if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir | Out-Null }
            Copy-Item $exe $binDir -Force
            Write-Host "Copied to: $binDir\DymoPrint.exe"
            exit 0
        }
    }
}

Write-Error "Build failed. Install either: (1) .NET SDK and run 'dotnet build' from dymo-print-cli, or (2) Visual Studio with .NET desktop development and run build.ps1 again."
exit 1
