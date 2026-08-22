' Starts the Vite server with no console. Logs to fitpro-server.log.
Option Explicit

Dim fso, shell, folder, logFile, i
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

folder = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = folder
logFile = folder & "\fitpro-server.log"

If Not fso.FileExists(folder & "\package.json") Then
  MsgBox "package.json not found. Put this file inside your fitpro folder.", 16, "FitPro"
  WScript.Quit 1
End If

If Not NodeOk() Then
  MsgBox "Node.js was not found. Install LTS from https://nodejs.org then restart Windows.", 16, "FitPro"
  WScript.Quit 1
End If

If Not fso.FolderExists(folder & "\node_modules") Then
  shell.Run HideCmd("npm install > """ & logFile & """ 2>&1"), 0, True
End If

KillPort 5173

shell.Run HideCmd("npx vite --host 127.0.0.1 --port 5173 > """ & logFile & """ 2>&1"), 0, False

For i = 1 To 60
  WScript.Sleep 500
  If IsListening(5173) Then
    shell.Run "http://127.0.0.1:5173", 1, False
    WScript.Quit 0
  End If
Next

MsgBox "FitPro did not start on port 5173." & vbCrLf & vbCrLf & _
       "Check fitpro-server.log in the fitpro folder.", 16, "FitPro"

Function HideCmd(inner)
  HideCmd = "cmd.exe /c cd /d """ & folder & """ && " & inner
End Function

Function NodeOk()
  NodeOk = (shell.Run("cmd.exe /c where node >nul 2>nul", 0, True) = 0)
End Function

Function IsListening(port)
  IsListening = (shell.Run( _
    "cmd.exe /c netstat -ano | findstr /R /C:"":" & port & " .*LISTENING""", _
    0, True) = 0)
End Function

Sub KillPort(port)
  shell.Run "cmd.exe /c for /f ""tokens=5"" %p in ('netstat -ano ^| findstr /R /C:"":" & port & " .*LISTENING""') do @taskkill /PID %p /F >nul 2>nul", 0, True
End Sub
