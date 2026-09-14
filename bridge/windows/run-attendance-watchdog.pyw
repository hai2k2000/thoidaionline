import subprocess
import sys
import time

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
creationflags = subprocess.CREATE_NO_WINDOW

while True:
    try:
        process = subprocess.Popen(
            command,
            creationflags=creationflags,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            close_fds=True,
        )
        process.wait()
    except Exception:
        pass
    time.sleep(15)
