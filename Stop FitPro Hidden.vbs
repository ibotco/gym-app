' Stops the FitPro server on port 5173 with no console.
Option Explicit
Dim shell
Set shell = CreateObject("WScript.Shell")
shell.Run "cmd.exe /c for /f ""tokens=5"" %p in ('netstat -ano ^| findstr /R /C:"":5173 .*LISTENING""') do @taskkill /PID %p /F >nul 2>nul", 0, True
