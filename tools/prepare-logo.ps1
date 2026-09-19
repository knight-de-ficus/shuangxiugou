$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$publicDir = Join-Path $projectRoot 'public'
$extensionIconDir = Join-Path $projectRoot 'extension\icons'

New-Item -ItemType Directory -Force -Path $publicDir, $extensionIconDir | Out-Null

function New-LogoPng {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Size,
    [Parameter(Mandatory = $true)]
    [string]$OutputPath
  )

  $bitmap = [System.Drawing.Bitmap]::new(
    $Size,
    $Size,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $scale = $Size / 120.0
  $cartColor = [System.Drawing.ColorTranslator]::FromHtml('#f04d90')
  $wheelColor = [System.Drawing.ColorTranslator]::FromHtml('#3498c9')
  $pen = [System.Drawing.Pen]::new($cartColor, 13 * $scale)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $points = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(24 * $scale, 30 * $scale),
    [System.Drawing.PointF]::new(27 * $scale, 38 * $scale),
    [System.Drawing.PointF]::new(91 * $scale, 38 * $scale),
    [System.Drawing.PointF]::new(87 * $scale, 57 * $scale),
    [System.Drawing.PointF]::new(34 * $scale, 57 * $scale),
    [System.Drawing.PointF]::new(41 * $scale, 76 * $scale),
    [System.Drawing.PointF]::new(81 * $scale, 76 * $scale)
  )
  $graphics.DrawLines($pen, $points)

  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $transparentBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::Transparent)
  foreach ($centerX in 48, 75) {
    $graphics.FillEllipse(
      $transparentBrush,
      ($centerX - 8.5) * $scale,
      (88 - 8.5) * $scale,
      17 * $scale,
      17 * $scale
    )
  }
  $transparentBrush.Dispose()

  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $wheelBrush = [System.Drawing.SolidBrush]::new($wheelColor)
  foreach ($centerX in 48, 75) {
    $graphics.FillEllipse(
      $wheelBrush,
      ($centerX - 6.5) * $scale,
      (88 - 6.5) * $scale,
      13 * $scale,
      13 * $scale
    )
  }

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $wheelBrush.Dispose()
  $pen.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

$masterPath = Join-Path $publicDir 'logo.png'
New-LogoPng -Size 1024 -OutputPath $masterPath

foreach ($size in 16, 48, 128) {
  New-LogoPng -Size $size -OutputPath (Join-Path $extensionIconDir "icon$size.png")
}

Write-Output $masterPath
