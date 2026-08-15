@echo off
set "SRC=%~dp0Start FitPro Hidden.vbs"
set "DEST=%USERPROFILE%\Desktop\FitPro.lnk"

powershell -NoProfile -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%DEST%');" ^
  "$s.TargetPath = 'wscript.exe';" ^
  "$s.Arguments = '//nologo ""%SRC%""';" ^
  "$s.WorkingDirectory = '%~dp0';" ^
  "$s.WindowStyle = 7;" ^
  "$s.Description = 'FitPro Gym Management';" ^
  "$s.Save()"

echo Desktop shortcut created: %DEST%
echo It starts FitPro with no Command Prompt.
pause
