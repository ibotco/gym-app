@echo off
cd /d "%~dp0"
start "" "%SystemRoot%\System32\wscript.exe" //nologo "%~dp0Start FitPro Hidden.vbs"
exit
