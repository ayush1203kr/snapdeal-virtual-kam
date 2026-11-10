$ErrorActionPreference = "Stop"
$repoUrl = "https://github.com/ayush1203kr/snapdeal-virtual-kam.git"
$repoPath = Join-Path $HOME "source\snapdeal-virtual-kam"
$sourcePath = Split-Path -Parent $MyInvocation.MyCommand.Path

function Invoke-Git {
    param([string[]]$Arguments)
    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($Arguments -join ' ')"
    }
}

if (-not (Test-Path (Join-Path $repoPath ".git"))) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $repoPath) | Out-Null
    Invoke-Git @("clone", $repoUrl, $repoPath)
}

Get-ChildItem -LiteralPath $sourcePath -Force |
    Where-Object { $_.Name -notin @(".git", ".env", "node_modules", "dist", "coverage") } |
    ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $repoPath -Recurse -Force }

Push-Location $repoPath
try {
    Invoke-Git @("checkout", "main")
    Invoke-Git @("pull", "--ff-only", "origin", "main")
    Invoke-Git @("add", "-A")
    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 1) {
        Invoke-Git @("commit", "-m", "Polish voice-first AI Virtual KAM assignment")
    } elseif ($LASTEXITCODE -ne 0) {
        throw "Unable to inspect staged changes."
    }
    Invoke-Git @("push", "-u", "origin", "main")
    Write-Host "Updated repository: https://github.com/ayush1203kr/snapdeal-virtual-kam"
} finally {
    Pop-Location
}
