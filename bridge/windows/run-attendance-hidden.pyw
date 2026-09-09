import subprocess
import sys

POWERSHELL = r"C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"

if len(sys.argv) < 2:
    raise SystemExit(2)

command = [
    POWERSHELL,
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    sys.argv[1],
    *sys.argv[2:],
]
subprocess.Popen(
    command,
    creationflags=subprocess.CREATE_NO_WINDOW,
    stdin=subprocess.DEVNULL,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
    close_fds=True,
)
