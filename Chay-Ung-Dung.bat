@echo off
title LajaOS - Quan Ly Doi Song Ca Nhan
cls
echo ==============================================================
echo        LAJAOS - HE DIEU HANH QUAN LY DOI SONG CA NHAN
echo ==============================================================
echo.
echo [1/3] Kiem tra va dong bo du lieu Cloud (neu co mang)...
if exist ".env" (
    if exist "bin\node.exe" (
        "bin\node.exe" sync.js
    ) else (
        node sync.js
    )
)
echo.
echo [2/3] Dang khoi dong may chu cuc bo...
echo [3/3] Dang mo trinh duyet tai: http://localhost:3000
echo.
echo --------------------------------------------------------------
echo - Web dang chay tai: http://localhost:3000
echo - De tat ung dung: Dong cua so nay hoac nhan Ctrl + C
echo --------------------------------------------------------------
echo.
start "" "http://localhost:3000"
if exist "bin\node.exe" (
    "bin\node.exe" server.js
) else (
    node server.js
)
pause
