@echo off
chcp 65001 >nul
title Dynamic Radio - Conversor y Estandarizador de Emisoras
color 0b

echo ====================================================================
echo     DYNAMIC RADIO - CONVERSOR Y ESTANDARIZADOR DE EMISORAS
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

:: 2. Paso 1: Convertir emisiones al formato MP3
echo [1/2] Convirtiendo emisiones de radio al formato MP3 (VBR q2)...
for %%E in (m4a aac opus ogg wav flac wma webm) do (
    for %%F in ("*.%%E") do (
        if exist "%%F" (
            echo   [~] Convirtiendo emision: "%%~nxF" ...
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
echo [2/2] Estandarizando formato de emisoras '[Dial FM] - [Nombre].mp3'...

:: 3. Paso 2: Limpieza y formato estandarizado con dial FM usando PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$count = 0;" ^
    "Get-ChildItem -Filter '*.mp3' | ForEach-Object {" ^
    "    $oldName = $_.Name;" ^
    "    $base = [System.IO.Path]::GetFileNameWithoutExtension($oldName);" ^
    "    $base = $base -replace '\s*\(128kbit_AAC\)', '';" ^
    "    $base = $base -replace '\s*\(Grand Theft Auto[;\s]*[^\)]*\)', '';" ^
    "    $base = $base -replace '\s*\(\d+kbit[_A-Za-z]*\)', '';" ^
    "    $base = $base -replace '\s*\(\d+kbps[_A-Za-z]*\)', '';" ^
    "    $freq = '';" ^
    "    if ($base -match '(\d{2,3}(?:\.\d+)?\s*[Ff][Mm])') {" ^
    "        $freq = $matches[1].ToUpper() -replace '\s*FM', ' FM';" ^
    "    } elseif ($base -match '(\d{2,3}\.\d+)') {" ^
    "        $freq = $matches[1] + ' FM';" ^
    "    }" ^
    "    if ($freq) {" ^
    "        $cleanTitle = $base -replace '(\d{2,3}(?:\.\d+)?\s*[Ff][Mm])', '' -replace '(\d{2,3}\.\d+)', '';" ^
    "        $cleanTitle = ($cleanTitle -replace '\s+', ' ').Trim(' -_:');" ^
    "        if ($cleanTitle) {" ^
    "            $newName = $freq + ' - ' + $cleanTitle + '.mp3';" ^
    "            if ($newName -ne $oldName -and -not (Test-Path -LiteralPath $newName)) {" ^
    "                Rename-Item -LiteralPath $_.FullName -NewName $newName -ErrorAction SilentlyContinue;" ^
    "                Write-Host ('   [RENOMBRADA] ' + $oldName + ' -> ' + $newName) -ForegroundColor Cyan;" ^
    "                $count++;" ^
    "            }" ^
    "        }" ^
    "    }" ^
    "};" ^
    "Write-Host ('   Total de emisoras estandarizadas: ' + $count);"

echo.
echo ====================================================================
echo Proceso finalizado con exito:
echo   - Emisiones convertidas a MP3: %CONVERTED%
echo   - Fallos de conversion:        %FAILED%
echo ====================================================================
echo.
echo Presiona 'Ctrl + L' en BeamNG para recargar las emisoras en el juego.
echo.
pause
