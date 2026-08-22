' Runs another script or command with no console window.
Option Explicit
If WScript.Arguments.Count < 1 Then WScript.Quit 1
Dim sh, cmd, i
Set sh = CreateObject("WScript.Shell")
cmd = """" & WScript.Arguments(0) & """"
For i = 1 To WScript.Arguments.Count - 1
  cmd = cmd & " " & Quote(WScript.Arguments(i))
Next
sh.Run cmd, 0, False

Function Quote(s)
  If InStr(s, " ") > 0 Then
    Quote = """" & s & """"
  Else
    Quote = s
  End If
End Function
