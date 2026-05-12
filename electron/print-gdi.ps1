# Print via System.Drawing - réplique exactement le pipeline de l'app Windows Photos.
#
# Charge le JPG, détecte son orientation, récupère la pagebounds du driver
# (taille papier physique côté driver), rotate l'image si orientation image ≠
# orientation papier, puis draw fit-to-page → envoie au driver un raster déjà
# correctement orienté. C'est ce qui produit l'impression parfaite qu'on a
# avec le clic droit → Imprimer.
#
# Usage : powershell.exe -NoProfile -ExecutionPolicy Bypass -File print-gdi.ps1
#         -Path "C:\photo.jpg" -Printer "DP-DS620" [-PaperFormat "4x6"]

param(
  [Parameter(Mandatory=$true)][string]$Path,
  [Parameter(Mandatory=$true)][string]$Printer,
  [string]$PaperFormat = '4x6'
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

# Dimensions cibles en centièmes de pouce (unité native PrintDocument)
$paperDims = @{
  '4x6' = @(400, 600)
  '5x7' = @(500, 700)
  '6x8' = @(600, 800)
}
$targetDims = $paperDims[$PaperFormat]
if (-not $targetDims) { $targetDims = $paperDims['4x6'] }
$targetW = $targetDims[0]
$targetH = $targetDims[1]

Write-Host "[GDI] Path=$Path Printer=$Printer Paper=$PaperFormat (${targetW}x${targetH} hundredths-of-inch)"

$printDoc = New-Object System.Drawing.Printing.PrintDocument
$printDoc.PrinterSettings.PrinterName = $Printer
$printDoc.DocumentName = 'Photobooth'

if (-not $printDoc.PrinterSettings.IsValid) {
  throw "Imprimante invalide : $Printer"
}

# Cherche un PaperSize matching dans la liste du driver (les deux orientations sont OK)
$matched = $null
foreach ($ps in $printDoc.PrinterSettings.PaperSizes) {
  $w = $ps.Width
  $h = $ps.Height
  if (($w -eq $targetW -and $h -eq $targetH) -or ($w -eq $targetH -and $h -eq $targetW)) {
    $matched = $ps
    Write-Host "[GDI] Matched PaperSize : '$($ps.PaperName)' ${w}x${h}"
    break
  }
}

if ($matched) {
  $printDoc.DefaultPageSettings.PaperSize = $matched
} else {
  Write-Host "[GDI] Aucun PaperSize matching trouvé — utilisation du default driver"
  Write-Host "[GDI] PaperSizes disponibles :"
  foreach ($ps in $printDoc.PrinterSettings.PaperSizes) {
    Write-Host "  - '$($ps.PaperName)' $($ps.Width)x$($ps.Height)"
  }
}

# Pas de marges — full bleed
$printDoc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)

# Charge l'image UNE FOIS, avant le handler (sinon le file lock peut poser souci)
$img = [System.Drawing.Image]::FromFile($Path)
Write-Host "[GDI] Image loaded : $($img.Width)x$($img.Height) px"

$printDoc.add_PrintPage({
  param($s, $e)

  $pageBounds = $e.PageBounds
  $imgPortrait = $img.Height -gt $img.Width
  $pagePortrait = $pageBounds.Height -gt $pageBounds.Width

  Write-Host "[GDI] PageBounds : $($pageBounds.Width)x$($pageBounds.Height) (portrait=$pagePortrait)"
  Write-Host "[GDI] Image portrait=$imgPortrait"

  if ($imgPortrait -ne $pagePortrait) {
    Write-Host "[GDI] Rotation 90° pour matcher l'orientation papier"
    $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone)
  }

  # High quality interpolation
  $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $e.Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $e.Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $e.Graphics.DrawImage($img, $pageBounds)
})

try {
  $printDoc.Print()
  Write-Host "[GDI] Print job soumis avec succès"
} finally {
  $img.Dispose()
  $printDoc.Dispose()
}
