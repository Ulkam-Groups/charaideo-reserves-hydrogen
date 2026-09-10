$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$brandRoot = Join-Path $projectRoot 'river-thread-web\teacup-brand'
$svgDirectory = Join-Path $brandRoot 'svg'
$pngDirectory = Join-Path $brandRoot 'png'
$profileDirectory = Join-Path $brandRoot '.render-profile'

$chromeCandidates = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
)
$browser = $chromeCandidates | Where-Object { Test-Path -LiteralPath $_ } |
  Select-Object -First 1

if (-not $browser) {
  throw 'Chrome or Edge is required to render the SVG previews.'
}

New-Item -ItemType Directory -Force -Path $pngDirectory | Out-Null
New-Item -ItemType Directory -Force -Path $profileDirectory | Out-Null

try {
  Get-ChildItem -LiteralPath $svgDirectory -Filter '*.svg' | ForEach-Object {
    [xml]$document = Get-Content -LiteralPath $_.FullName -Raw
    $width = [int]$document.svg.width
    $height = [int]$document.svg.height
    $stem = [IO.Path]::GetFileNameWithoutExtension($_.Name)
    $output = Join-Path $pngDirectory "$stem-$($width)x$($height).png"
    $uri = [Uri]::new($_.FullName).AbsoluteUri

    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    & $browser --headless=new --disable-gpu --disable-software-rasterizer `
      --no-sandbox --hide-scrollbars --user-data-dir=$profileDirectory `
      --window-size="$width,$height" --screenshot=$output $uri 2>$null |
      Out-Null
    $ErrorActionPreference = $previousErrorAction

    if (-not (Test-Path -LiteralPath $output)) {
      throw "PNG render failed: $($_.Name)"
    }
  }
}
finally {
  $resolvedProfile = (Resolve-Path $profileDirectory -ErrorAction SilentlyContinue).Path
  if ($resolvedProfile -and $resolvedProfile.StartsWith($brandRoot)) {
    Remove-Item -LiteralPath $resolvedProfile -Recurse -Force
  }
}

Write-Output "Rendered $((Get-ChildItem -LiteralPath $pngDirectory -Filter '*.png').Count) PNG assets."
