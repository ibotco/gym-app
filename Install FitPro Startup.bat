@echo off
:: Puts a hidden-start shortcut in the Windows Startup folder
:: so FitPro opens after you sign in to Windows.

set "SRC=%~dp0Start FitPro Hidden.vbs"
set "DEST=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\FitPro.lnk"

powershell -NoProfile -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%DEST%');" ^
  "$s.TargetPath = '%SRC%';" ^
  "$s.WorkingDirectory = '%~dp0';" ^
  "$s.WindowStyle = 7;" ^
  "$s.Description = 'Start FitPro Gym Management';" ^
  "$s.Save()"

echo.
echo FitPro will now start automatically when you sign in to Windows.
echo Shortcut created:
echo   %DEST%
echo.
echo To undo: delete that shortcut, or run "Uninstall FitPro Startup.bat"
echo.
pause
