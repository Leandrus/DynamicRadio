@echo off
chcp 65001 >nul
title Dynamic Radio - Conversor y Estandarizador MP3
color 0b

echo ====================================================================
echo        DYNAMIC RADIO - CONVERSOR Y ESTANDARIZADOR MP3
echo ====================================================================
echo.

:: 1. Buscar ejecutable de FFmpeg
set "FFMPEG=ffmpeg"
where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Buscando FFmpeg en carpetas locales de Windows...
    for /f "delims=" %%F in ('dir /b /s "%LOCALAPPDATA%\Microsoft\WinGet\Packages\ffmpeg.exe" 2^>nul') do set "FFMPEG=%%F"
    if not defined FFMPEG (
        for /f "delims=" %%F in ('dir /b /s "%ProgramFiles%\ffmpeg.exe" 2^>nul') do set "FFMPEG=%%F"
    )
)

"%FFMPEG%" -version >nul 2>nul
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] No se encontro FFmpeg en el sistema.
    echo Instalalo abriendo PowerShell y ejecutando: winget install Gyan.FFmpeg
    echo.
    pause
    exit /b 1
)

set /a CONVERTED=0
set /a FAILED=0

:: 2. Paso 1: Convertir cualquier audio no-MP3 a MP3 de alta fidelidad
echo [1/2] Convirtiendo audios al formato MP3 (VBR q2)...
for %%E in (m4a aac opus ogg wav flac wma webm) do (
    for %%F in ("*.%%E") do (
        if exist "%%F" (
            echo   [~] Convirtiendo: "%%~nxF" ...
            "%FFMPEG%" -y -v error -i "%%F" -vn -c:a libmp3lame -q:a 2 "%%~nF.mp3"
            if exist "%%~nF.mp3" (
                del /f /q "%%F"
                set /a CONVERTED+=1
                echo       -- OK: Convertido y eliminado archivo original.
            ) else (
                set /a FAILED+=1
                echo       -- ERROR: No se pudo convertir este archivo.
            )
        )
    )
)

echo.
echo [2/2] Estandarizando nombres al formato limpio 'Artista - Cancion.mp3'...

:: 3. Paso 2: Limpieza y formato estandarizado de nombres usando PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$count = 0;" ^
    "Get-ChildItem -Filter '*.mp3' | ForEach-Object {" ^
    "    $oldName = $_.Name;" ^
    "    $base = [System.IO.Path]::GetFileNameWithoutExtension($oldName);" ^
    "    $base = $base -replace '^\s*\[.*?Forza.*?\]\s*', '';" ^
    "    $base = $base -replace '^\s*Forza Horizon \d+ Soundtrack\s*[\:\;\|\¦\-]\s*', '';" ^
    "    $base = $base -replace '\s*\(128kbit_AAC\)', '';" ^
    "    $base = $base -replace '\s*\[MP3\]\s*HQ', '';" ^
    "    $base = $base -replace '\s*\(Forza Horizon \d+[\;\,\s]*[^\)]*OST\)', '';" ^
    "    $base = $base -replace '\s*\(Forza Horizon \d+[\;\,\s]*[^\)]*\)', '';" ^
    "    $base = $base -replace '\s*[\:\|\¦]\s*MoS\s*$', '';" ^
    "    $base = $base -replace '\s*\(Official (?:Video|Audio)\)', '';" ^
    "    $base = $base -replace '\s*\(\d+kbit[_A-Za-z]*\)', '';" ^
    "    $base = $base -replace '\s*\(\d+kbps[_A-Za-z]*\)', '';" ^
    "    $base = $base -replace '^\d+[\s_\-\.]+', '';" ^
    "    $base = ($base -replace '\s+', ' ').Trim(' -_');" ^
    "    $newName = $base + '.mp3';" ^
    "    if ($newName -ne $oldName -and $newName -ne '.mp3' -and -not (Test-Path -LiteralPath $newName)) {" ^
    "        Rename-Item -LiteralPath $_.FullName -NewName $newName -ErrorAction SilentlyContinue;" ^
    "        Write-Host ('   [RENOMBRADO] ' + $oldName + ' -> ' + $newName) -ForegroundColor Cyan;" ^
    "        $count++;" ^
    "    }" ^
    "};" ^
    "Write-Host ('   Total de canciones renombradas: ' + $count);"

echo.
echo ====================================================================
echo Proceso finalizado con exito:
echo   - Audios convertidos a MP3: %CONVERTED%
echo   - Fallos de conversion:     %FAILED%
echo ====================================================================
echo.
echo Presiona 'Ctrl + L' en BeamNG para recargar la musica en el juego.
echo.
pause
