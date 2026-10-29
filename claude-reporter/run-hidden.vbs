' Runs report.mjs without a console window and waits for it, so Task Scheduler's
' time limit and IgnoreNew apply; exits with node's exit code (Task Scheduler starts this with wscript).
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
' install.ps1 writes node's full path here so the task does not depend on PATH
nodeExe = "node"
nodeFile = dir & "\node-path.txt"
saved = ""
If fso.FileExists(nodeFile) Then
  Set f = fso.OpenTextFile(nodeFile, 1, False, -1)
  If Not f.AtEndOfStream Then saved = Trim(f.ReadLine())
  f.Close
  If saved <> "" Then
    If fso.FileExists(saved) Then nodeExe = saved
  End If
End If
q = Chr(34)
cmd = "cmd /c " & q & q & nodeExe & q & " " & q & dir & "\report.mjs" & q & " > " & q & dir & "\last-run.log" & q & " 2>&1" & q
WScript.Quit CreateObject("WScript.Shell").Run(cmd, 0, True)
