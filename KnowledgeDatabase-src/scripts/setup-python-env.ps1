# setup-python-env.ps1
# Setup Python environment variables for development and production

param(
    [switch]$Dev,
    [switch]$Prod,
    [switch]$Show
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Development paths (relative to project root)
$DevPythonEmbed = Join-Path $ProjectRoot "vendor\python-3.12.0-embed-amd64"
$DevPythonService = Join-Path $ProjectRoot "service\python-service"
$DevPythonEnv = Join-Path $ProjectRoot "environment\python-env"

# Production paths (relative to app resources)
function Get-ProductionRoot {
    # In production, resources are in: <app>/resources/
    $appPath = Split-Path -Parent (Split-Path -Parent $ScriptDir)
    return Join-Path $appPath "resources"
}

function Set-DevEnvironment {
    Write-Host "[INFO] Setting development environment..." -ForegroundColor Cyan
    
    $env:PYTHON_EMBED_PATH = $DevPythonEmbed
    $env:PYTHON_SERVICE_PATH = $DevPythonService
    $env:PYTHON_ENV_PATH = $DevPythonEnv
    
    # Set PYTHONPATH to use dependencies from python-env
    $sitePackages = Join-Path $DevPythonEnv "Lib\site-packages"
    $env:PYTHONPATH = $sitePackages
    
    # Add python embed to PATH
    $env:PATH = "$DevPythonEmbed;$env:PATH"
    
    Write-Host "[OK] Development environment configured" -ForegroundColor Green
}

function Set-ProdEnvironment {
    Write-Host "[INFO] Setting production environment..." -ForegroundColor Cyan
    
    $resourcesRoot = Get-ProductionRoot
    
    $env:PYTHON_EMBED_PATH = Join-Path $resourcesRoot "python-embed"
    $env:PYTHON_SERVICE_PATH = Join-Path $resourcesRoot "python-service"
    $env:PYTHON_ENV_PATH = Join-Path $resourcesRoot "python-env"
    
    # Set PYTHONPATH to use dependencies from python-env
    $sitePackages = Join-Path $env:PYTHON_ENV_PATH "Lib\site-packages"
    $env:PYTHONPATH = $sitePackages
    
    # Add python embed to PATH
    $env:PATH = "$env:PYTHON_EMBED_PATH;$env:PATH"
    
    Write-Host "[OK] Production environment configured" -ForegroundColor Green
}

function Show-Environment {
    Write-Host ""
    Write-Host "=== Python Environment Variables ===" -ForegroundColor Yellow
    Write-Host "PYTHON_EMBED_PATH:   $env:PYTHON_EMBED_PATH"
    Write-Host "PYTHON_SERVICE_PATH: $env:PYTHON_SERVICE_PATH"
    Write-Host "PYTHON_ENV_PATH:     $env:PYTHON_ENV_PATH"
    Write-Host "PYTHONPATH:          $env:PYTHONPATH"
    Write-Host ""
    
    # Verify paths exist
    Write-Host "=== Path Verification ===" -ForegroundColor Yellow
    $paths = @(
        @{Name="Python Embed"; Path=$env:PYTHON_EMBED_PATH},
        @{Name="Python Service"; Path=$env:PYTHON_SERVICE_PATH},
        @{Name="Python Env"; Path=$env:PYTHON_ENV_PATH}
    )
    
    foreach ($item in $paths) {
        if (Test-Path $item.Path) {
            Write-Host "[OK] $($item.Name): $($item.Path)" -ForegroundColor Green
        } else {
            Write-Host "[MISSING] $($item.Name): $($item.Path)" -ForegroundColor Red
        }
    }
}

function Auto-Detect {
    # Auto detect environment based on directory structure
    if (Test-Path $DevPythonEmbed) {
        Set-DevEnvironment
    } else {
        Set-ProdEnvironment
    }
}

# Main logic
if ($Dev) {
    Set-DevEnvironment
} elseif ($Prod) {
    Set-ProdEnvironment
} else {
    Auto-Detect
}

if ($Show) {
    Show-Environment
}
