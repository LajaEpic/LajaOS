Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "bin\node.exe server.js", 0, False
WScript.Sleep 1200
WshShell.Run "http://localhost:3000"
