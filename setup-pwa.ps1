$ErrorActionPreference = "Stop"

Write-Host "Setting up Weather Forecast Validation as a PWA..." -ForegroundColor Cyan

$projectRoot = Get-Location
$sourceIcon = Join-Path $projectRoot "assets\images\icon.png"
$publicDir = Join-Path $projectRoot "public"
$appDir = Join-Path $projectRoot "src\app"

if (-not (Test-Path $sourceIcon)) {
    throw "Could not find source icon: $sourceIcon"
}

New-Item -ItemType Directory -Force $publicDir | Out-Null
New-Item -ItemType Directory -Force $appDir | Out-Null

$manifest = @'
{
  "id": "/",
  "name": "Weather Forecast Validation",
  "short_name": "WFV",
  "description": "Observed weather vs. forecasts made 1-5 days earlier.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#f7f9fc",
  "theme_color": "#f97316",
  "icons": [
    {
      "src": "/pwa-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/pwa-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
'@

Set-Content `
    -Path (Join-Path $publicDir "manifest.json") `
    -Value $manifest `
    -Encoding UTF8

$html = @'
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        <meta name="theme-color" content="#f97316" />
        <meta
          name="application-name"
          content="Weather Forecast Validation"
        />
        <meta
          name="apple-mobile-web-app-capable"
          content="yes"
        />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <meta
          name="apple-mobile-web-app-title"
          content="WFV"
        />

        <link rel="manifest" href="/manifest.json" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16.png"
        />
        <link
          rel="apple-touch-icon"
          href="/apple-touch-icon.png"
        />

        <ScrollViewStyleReset />
      </head>

      <body>{children}</body>
    </html>
  );
}
'@

Set-Content `
    -Path (Join-Path $appDir "+html.tsx") `
    -Value $html `
    -Encoding UTF8

Add-Type -AssemblyName System.Drawing

$source = [System.Drawing.Image]::FromFile($sourceIcon)

function Save-ResizedPng {
    param(
        [int]$Size,
        [string]$OutputPath
    )

    $bitmap = [System.Drawing.Bitmap]::new(
        $Size,
        $Size,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = `
            [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = `
            [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = `
            [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = `
            [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

        $graphics.DrawImage(
            $source,
            0,
            0,
            $Size,
            $Size
        )

        $bitmap.Save(
            $OutputPath,
            [System.Drawing.Imaging.ImageFormat]::Png
        )
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

try {
    Save-ResizedPng `
        -Size 192 `
        -OutputPath (Join-Path $publicDir "pwa-192.png")

    Save-ResizedPng `
        -Size 512 `
        -OutputPath (Join-Path $publicDir "pwa-512.png")

    Save-ResizedPng `
        -Size 180 `
        -OutputPath (Join-Path $publicDir "apple-touch-icon.png")

    Save-ResizedPng `
        -Size 32 `
        -OutputPath (Join-Path $publicDir "favicon-32.png")

    Save-ResizedPng `
        -Size 16 `
        -OutputPath (Join-Path $publicDir "favicon-16.png")
}
finally {
    $source.Dispose()
}

Write-Host ""
Write-Host "PWA files created:" -ForegroundColor Green
Write-Host "  public\manifest.json"
Write-Host "  public\pwa-192.png"
Write-Host "  public\pwa-512.png"
Write-Host "  public\apple-touch-icon.png"
Write-Host "  public\favicon-32.png"
Write-Host "  public\favicon-16.png"
Write-Host "  src\app\+html.tsx"
Write-Host ""
Write-Host "Next run:" -ForegroundColor Cyan
Write-Host "  npx expo export --platform web"
Write-Host "  eas deploy --prod"
