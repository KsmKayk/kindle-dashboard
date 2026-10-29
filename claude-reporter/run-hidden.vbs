' Runs report.mjs without a console window (Task Scheduler starts this with wscript)
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "cmd /c node """ & dir & "\report.mjs"" > """ & dir & "\last-run.log"" 2>&1", 0, False
