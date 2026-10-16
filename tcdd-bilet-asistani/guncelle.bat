@echo off
chcp 65001 >nul
title TCDD Bilet Avcısı - Otomatik Güncelleyici
color 0B

echo =======================================================
echo   🚄 TCDD BİLET AVCISI - OTOMATİK GÜNCELLEYİCİ
echo =======================================================
echo.
echo GitHub üzerinden en son sürüm kontrol ediliyor...
echo.

where git >nul 2>&1
if exist ".git" (
    echo [1/2] Git deposu tespit edildi, son değişiklikler çekiliyor...
    git pull origin main
    if %ERRORLEVEL% equ 0 (
        echo.
        echo [2/2] ✅ Başarıyla en son sürüme güncellendi!
        goto BASARILI
    )
)

echo [1/2] GitHub üzerinden en son dosyalar indiriliyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$repo = 'nicotin66/tcdd-bilet-asistani';" ^
    "$zipUrl = \"https://github.com/$repo/archive/refs/heads/main.zip\";" ^
    "$destZip = Join-Path $env:TEMP 'tcdd-update.zip';" ^
    "$tempExtract = Join-Path $env:TEMP 'tcdd-update-extract';" ^
    "try {" ^
    "    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^
    "    Write-Host 'İndiriliyor: ' $zipUrl;" ^
    "    Invoke-WebRequest -Uri $zipUrl -OutFile $destZip -UseBasicParsing;" ^
    "    if (Test-Path $tempExtract) { Remove-Item -Recurse -Force $tempExtract };" ^
    "    Expand-Archive -Path $destZip -DestinationPath $tempExtract -Force;" ^
    "    $subFolder = Get-ChildItem -Path $tempExtract -Directory | Select-Object -First 1;" ^
    "    if ($subFolder) {" ^
    "        Copy-Item -Path \"$($subFolder.FullName)\*\" -Destination '.' -Recurse -Force;" ^
    "    }" ^
    "    Remove-Item -Force $destZip -ErrorAction SilentlyContinue;" ^
    "    Remove-Item -Recurse -Force $tempExtract -ErrorAction SilentlyContinue;" ^
    "    Write-Host 'Tamamlandı!' -ForegroundColor Green;" ^
    "    exit 0;" ^
    "} catch {" ^
    "    Write-Host 'Hata: ' $_.Exception.Message -ForegroundColor Red;" ^
    "    exit 1;" ^
    "}"

if %ERRORLEVEL% equ 0 (
    echo.
    echo [2/2] ✅ Eklenti başarıyla en son sürüme güncellendi!
    goto BASARILI
) else (
    echo.
    echo ❌ Güncelleme sırasında bir sorun oluştu. İnternet bağlantınızı kontrol edin.
    goto SON
)

:BASARILI
echo.
echo =======================================================
echo   🎉 İŞLEM BAŞARILI!
echo   Chrome'daki eklenti penceresinden "🔄 Yenile" 
echo   butonuna basmanız yeterlidir.
echo =======================================================

:SON
echo.
pause
