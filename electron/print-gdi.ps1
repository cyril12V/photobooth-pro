param(
  [Parameter(Mandatory=$true)][string]$Path,
  [Parameter(Mandatory=$true)][string]$Printer,
  [string]$PaperFormat = '4x6',
  [switch]$Preview
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing
if ($Preview) { Add-Type -AssemblyName System.Windows.Forms }

# Target paper dimensions in hundredths of inch (System.Drawing native unit)
$paperDims = @{
  '4x6' = @(400, 600)
  '5x7' = @(500, 700)
  '6x8' = @(600, 800)
}
$targetDims = $paperDims[$PaperFormat]
if (-not $targetDims) { $targetDims = $paperDims['4x6'] }
$targetW = [int]$targetDims[0]
$targetH = [int]$targetDims[1]

Write-Host "[GDI] Path=$Path"
Write-Host "[GDI] Printer=$Printer"
Write-Host "[GDI] PaperFormat=$PaperFormat target=${targetW}x${targetH}"

$printDoc = New-Object System.Drawing.Printing.PrintDocument
$printDoc.PrinterSettings.PrinterName = $Printer
$printDoc.DocumentName = 'Photobooth'

if (-not $printDoc.PrinterSettings.IsValid) {
  throw "Invalid printer: $Printer"
}

# Find a PaperSize matching target dims in either orientation
$matched = $null
foreach ($ps in $printDoc.PrinterSettings.PaperSizes) {
  $w = $ps.Width
  $h = $ps.Height
  if (($w -eq $targetW -and $h -eq $targetH) -or ($w -eq $targetH -and $h -eq $targetW)) {
    $matched = $ps
    Write-Host "[GDI] Matched PaperSize: $($ps.PaperName) ${w}x${h}"
    break
  }
}

if ($matched -ne $null) {
  $printDoc.DefaultPageSettings.PaperSize = $matched
}
else {
  Write-Host "[GDI] No matching PaperSize, using driver default. Available sizes:"
  foreach ($ps in $printDoc.PrinterSettings.PaperSizes) {
    Write-Host "  - $($ps.PaperName) $($ps.Width)x$($ps.Height)"
  }
}

# No margins - full bleed
$printDoc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)

# Load image once (file lock issue if loaded inside handler)
$img = [System.Drawing.Image]::FromFile($Path)
Write-Host "[GDI] Image loaded: $($img.Width)x$($img.Height)px"

$printDoc.add_PrintPage({
  param($s, $e)

  $pageBounds = $e.PageBounds
  $imgPortrait = $img.Height -gt $img.Width
  $pagePortrait = $pageBounds.Height -gt $pageBounds.Width

  Write-Host "[GDI] PageBounds: $($pageBounds.Width)x$($pageBounds.Height) portrait=$pagePortrait"
  Write-Host "[GDI] Image portrait=$imgPortrait"

  if ($imgPortrait -ne $pagePortrait) {
    Write-Host "[GDI] Rotating image 90 deg to match page orientation"
    $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone)
  }

  $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $e.Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $e.Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $e.Graphics.DrawImage($img, $pageBounds)
})

try {
  if ($Preview) {
    Write-Host "[GDI] Opening PrintPreviewDialog (close window to print, cancel to abort)"
    $dlg = New-Object System.Windows.Forms.PrintPreviewDialog
    $dlg.Document = $printDoc
    $dlg.Width = 900
    $dlg.Height = 1100
    $dlg.WindowState = [System.Windows.Forms.FormWindowState]::Normal
    $dlg.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
    $result = $dlg.ShowDialog()
    Write-Host "[GDI] Preview dialog closed with result: $result"
  }
  else {
    $printDoc.Print()
    Write-Host "[GDI] Print job submitted"
  }
}
finally {
  $img.Dispose()
  $printDoc.Dispose()
}
