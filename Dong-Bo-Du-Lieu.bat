@echo off
title Dong Bo Du Lieu LajaOS
cls
echo ==============================================================
echo        LAJAOS - TIEN TRINH DONG BO DU LIEU VE MAY
echo ==============================================================
echo.
echo Dang tien hanh dong bo tu Cloud ve may local...
echo.

if exist "bin\node.exe" (
    "bin\node.exe" sync.js %1
) else (
    node sync.js %1
)

echo.
echo Nhan phim bat ky de thoat...
pause >nul
