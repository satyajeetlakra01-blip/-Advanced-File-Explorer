Add-Type -AssemblyName System.Drawing

$bmp = New-Object System.Drawing.Bitmap 48, 48
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::Transparent)

# Drop shadow
$shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, 0, 0, 0))
$shadowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$shadowPath.AddRectangle([System.Drawing.RectangleF]::new(10, 6, 28, 36))
$g.FillPath($shadowBrush, $shadowPath)
$shadowBrush.Dispose()

# Main file card background
$cardBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
    [System.Drawing.PointF]::new(10, 4),
    [System.Drawing.PointF]::new(10, 40),
    [System.Drawing.Color]::FromArgb(255, 255, 255),
    [System.Drawing.Color]::FromArgb(235, 240, 248)
)
$borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(180, 148, 163, 184)), 1.2

# Path with folded corner
# Card: x=9, y=4, width=28, height=36
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddLine(12, 4, 27, 4)        # Top edge
$path.AddLine(37, 14, 37, 37)      # Right edge
$path.AddLine(37, 37, 34, 40)      # Bottom-right corner
$path.AddLine(34, 40, 12, 40)      # Bottom edge
$path.AddLine(9, 37, 9, 7)         # Left edge
$path.AddLine(9, 7, 12, 4)         # Top-left corner
$path.CloseFigure()

$g.FillPath($cardBrush, $path)
$g.DrawPath($borderPen, $path)

# Folded corner flap
$foldBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(203, 213, 225))
$foldPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$foldPath.AddPolygon([System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(27, 4),
    [System.Drawing.PointF]::new(37, 14),
    [System.Drawing.PointF]::new(27, 14)
))
$g.FillPath($foldBrush, $foldPath)
$g.DrawPath($borderPen, $foldPath)
$foldBrush.Dispose()

# Blue accent lines on the document
$linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 59, 130, 246)), 2.0
$linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawLine($linePen, 15, 20, 31, 20)
$g.DrawLine($linePen, 15, 26, 28, 26)
$g.DrawLine($linePen, 15, 32, 23, 32)
$linePen.Dispose()

$g.Dispose()
$outPath = Join-Path $PSScriptRoot '..\assets\drag-icon.png'
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "Clean drag icon created at: $outPath"
