$enc = [System.Text.Encoding]::GetEncoding(950)
$files = @('index.html', 'index.css', 'script.js')
foreach ($file in $files) {
    $path = Join-Path 'd:\特教課表Special Education Curriculum' $file
    $content = $enc.GetString([System.IO.File]::ReadAllBytes($path))
    [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
    Write-Output "Converted $file to UTF-8"
}
