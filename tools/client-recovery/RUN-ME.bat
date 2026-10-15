@echo off
title Find the lost bills
cd /d "%~dp0"
echo.
echo  This will look for the two missing bills on this computer.
echo  It does NOT change anything in the software or your data.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Collect-LostBills.ps1"
echo.
echo  ------------------------------------------------------------
echo  Finished. Please send the file named  LostBills-RESULT-...zip
echo  (it is on your Desktop) to Agam on WhatsApp.
echo  ------------------------------------------------------------
echo.
pause
