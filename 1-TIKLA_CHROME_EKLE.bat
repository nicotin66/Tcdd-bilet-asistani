@echo off
chcp 65001 >nul
title TCDD Bilet Avcısı - Kolay Kurulum
color 0A

echo ================================================================
echo      🚄 TCDD BİLET AVCISI - 1 TIKLA CHROME KURULUMU
echo ================================================================
echo.

:: 1. Bulunduğumuz klasör yolunu panoya (clipboard) kopyala
powershell -NoProfile -Command "Set-Clipboard -Value (Get-Location).Path" >nul 2>&1

echo [✓] 1. Bu eklentinin klasör yolu panoya otomatik kopyalandı!
echo.
echo [✓] 2. Google Chrome Uzantılar sayfası açılıyor...
echo.

:: 2. Chrome'da chrome://extensions sayfasını aç
start chrome.exe "chrome://extensions"

echo ================================================================
echo                 📌 ŞİMDİ YAPILACAK 3 BASİT ADIM:
echo ================================================================
echo.
echo   1. Açılan Chrome sayfasının sağ üstündeki 
echo      "Geliştirici Modu" anahtarını AÇIN (Mavi olsun).
echo.
echo   2. Sol üstte beliren "Paketlenmemiş öğe yükle" butonuna basın.
echo.
echo   3. Açılan klasör seçme kutucuğunda "Klasör:" kısmına 
echo      CTRL + V (Yapıştır) yapıp "Klasör Seç" deyin!
echo.
echo ================================================================
echo   🎉 TEBRİKLER! Eklenti anında Chrome'unuza eklenecektir.
echo ================================================================
echo.

set /p KISAYOL="Masaüstünüze hızlı başlatma kısayolu eklensin mi? (E/H): "
if /i "%KISAYOL%"=="E" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$WshShell = New-Object -ComObject WScript.Shell;" ^
        "$Shortcut = $WshShell.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\TCDD Bilet Avcısı.lnk');" ^
        "$regChrome = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe' -ErrorAction SilentlyContinue).'(Default)';" ^
        "if (-not $regChrome) { $regChrome = 'chrome.exe' };" ^
        "$Shortcut.TargetPath = $regChrome;" ^
        "$Shortcut.Arguments = '--load-extension=\"' + (Get-Location).Path + '\" https://ebilet.tcddtasimacilik.gov.tr/';" ^
        "$Shortcut.WorkingDirectory = (Get-Location).Path;" ^
        "$iconPath = Join-Path (Get-Location).Path 'icons\icon128.png';" ^
        "$Shortcut.Description = 'TCDD Hızlı Tren Bilet Avcısı';" ^
        "$Shortcut.Save();"
    echo.
    echo [✓] Masaüstünüze "TCDD Bilet Avcısı" kısayolu başarıyla oluşturuldu!
)

echo.
echo Kurulum sihirbazını kapatmak için herhangi bir tuşa basın...
pause >nul
