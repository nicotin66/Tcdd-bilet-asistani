@echo off
chcp 65001 >nul
title TCDD Bilet Avcısı - GitHub'a Gönder
color 0B

echo ================================================================
echo       🚄 TCDD BİLET AVCISI - GITHUB'A KOD GÖNDERİCİ
echo ================================================================
echo.

:: Git klasörünü kontrol et
if not exist ".git" (
    if exist "..\.git" (
        cd ..
    ) else (
        echo ❌ Bu klasörde Git deposu bulunamadı!
        pause
        exit /b 1
    )
)

echo [1/3] Değişiklikler kontrol ediliyor...
echo ----------------------------------------------------------------
git status -s
echo ----------------------------------------------------------------
echo.

:: Kullanıcıdan commit mesajı al
set /p MESAJ="Güncelleme notunuzu yazın (Boş bırakmak için Enter'a basın): "

if "%MESAJ%"=="" (
    for /f "tokens=1-4 delims=/:. " %%a in ("%date% %time%") do (
        set MESAJ=chore: eklenti kod guncellemesi (%date% %time:~0,5%)
    )
)

echo.
echo [2/3] Dosyalar kaydediliyor ve paketleniyor...
git add .
git commit -m "%MESAJ%"

echo.
echo [3/3] GitHub'a yükleniyor (git push)...
git push origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ================================================================
    echo   🎉 TEBRİKLER! Kodlar başarıyla GitHub'a yüklendi!
    echo.
    echo   👉 Depo Adresi: https://github.com/nicotin66/tcdd-bilet-asistani
    echo   👉 Tüm arkadaşlarınız artık bu güncellemeyi alabilir.
    echo ================================================================
) else (
    echo.
    echo ================================================================
    echo   ❌ Yükleme sırasında bir hata oluştu!
    echo   İnternet bağlantınızı veya GitHub yetkinizi kontrol edin.
    echo ================================================================
)

echo.
echo Kapatmak için herhangi bir tuşa basın...
pause >nul
