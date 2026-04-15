Add-Type -AssemblyName System.Drawing
$dir = "d:\open-source-project-my-contribution\leave-tracker\icons"
foreach ($sz in @(16, 48, 128)) {
    $path = "$dir\icon$sz.png"
    if (Test-Path $path) {
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $ms = New-Object System.IO.MemoryStream(,$bytes)
        $src = [System.Drawing.Image]::FromStream($ms)
        
        $bmp = New-Object System.Drawing.Bitmap($sz, $sz)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.Clear([System.Drawing.Color]::Transparent)
        
        # Add 20% padding around the image so it doesn't look monstrously huge in Chrome UI
        $pad = [math]::Floor($sz * 0.2)
        $innerSize = $sz - ($pad * 2)
        
        $rect = New-Object System.Drawing.Rectangle($pad, $pad, $innerSize, $innerSize)
        $g.DrawImage($src, $rect)
        $g.Dispose()
        
        $src.Dispose()
        $ms.Dispose()
        
        $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        Write-Host "Padded icon$sz.png"
    }
}
