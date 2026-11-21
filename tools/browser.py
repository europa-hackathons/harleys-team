"""The one safe way for tools to start a browser (Edge, or Chrome/Chromium). No packages needed.

Every browser started here dies with the tool that started it, even if that tool crashes, times out
or is killed from outside, and none may run longer than its time limit. Leftover check browsers from
anything else (an old crash, a hand-written script) are swept away by `sweep()`.

    python tools/browser.py --sweep     # stop leftover check browsers, delete their temp profiles

Why this exists: on 2026-11-21 dozens of hand-launched headless Edge windows, each drawing the
game in software, were never closed; the machine ground to a halt and had to be switched off.
Agents: never launch a browser yourself; use tools/shot.py or tools/live.py.
"""
import ctypes, os, re, shutil, signal, subprocess, sys, tempfile, threading, time

BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "msedge", "chrome", "google-chrome", "chromium", "chromium-browser",
]
PREFIX = "jam-browser-"   # temp profile folders made here
MAX_SECONDS = 300         # no check browser may live longer than this
STALE_SECONDS = 600       # a check browser older than this is a leftover (sweep)
WIN = os.name == "nt"


def find():
    for b in BROWSERS:
        path = b if os.path.isfile(b) else shutil.which(b)
        if path:
            return path
    return None


def clean_env():
    # Git Bash leaks variables (e.g. __COMPAT_LAYER, MSYSTEM, HOME) that make Edge exit silently.
    return {k: v for k, v in os.environ.items() if not k.startswith(("MSYS", "MINGW", "__COMPAT", "EXEPATH", "SHELL",
                                                                     "TERM", "SHLVL", "OLDPWD", "PWD", "_"))
            and k not in ("HOME",)}


# --- Windows: put this tool in a job object, so the OS kills every child when the tool ends ---------
_job = None


def _join_kill_job():
    global _job
    if not WIN or _job:
        return
    from ctypes import wintypes as w
    k32 = ctypes.WinDLL("kernel32", use_last_error=True)

    class IO(ctypes.Structure):
        _fields_ = [(n, ctypes.c_ulonglong) for n in ("r", "w", "o", "rb", "wb", "ob")]

    class Basic(ctypes.Structure):
        _fields_ = [("PerProcessUserTimeLimit", ctypes.c_int64), ("PerJobUserTimeLimit", ctypes.c_int64),
                    ("LimitFlags", w.DWORD), ("MinimumWorkingSetSize", ctypes.c_size_t),
                    ("MaximumWorkingSetSize", ctypes.c_size_t), ("ActiveProcessLimit", w.DWORD),
                    ("Affinity", ctypes.c_size_t), ("PriorityClass", w.DWORD), ("SchedulingClass", w.DWORD)]

    class Extended(ctypes.Structure):
        _fields_ = [("Basic", Basic), ("Io", IO), ("ProcessMemoryLimit", ctypes.c_size_t),
                    ("JobMemoryLimit", ctypes.c_size_t), ("PeakProcessMemoryUsed", ctypes.c_size_t),
                    ("PeakJobMemoryUsed", ctypes.c_size_t)]

    k32.CreateJobObjectW.restype = w.HANDLE
    k32.CreateJobObjectW.argtypes = [ctypes.c_void_p, w.LPCWSTR]
    k32.SetInformationJobObject.argtypes = [w.HANDLE, ctypes.c_int, ctypes.c_void_p, w.DWORD]
    k32.AssignProcessToJobObject.argtypes = [w.HANDLE, w.HANDLE]
    k32.GetCurrentProcess.restype = w.HANDLE
    job = k32.CreateJobObjectW(None, None)
    info = Extended()
    info.Basic.LimitFlags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    if job and k32.SetInformationJobObject(job, 9, ctypes.byref(info), ctypes.sizeof(info)) \
            and k32.AssignProcessToJobObject(job, k32.GetCurrentProcess()):
        _job = job   # never closed: Windows closes it when this process ends, killing the browser too
    else:
        print("note: couldn't tie the browser to this tool; relying on the time limit and sweep()", file=sys.stderr)


def _linux_die_with_parent():
    try:
        ctypes.CDLL("libc.so.6", use_errno=True).prctl(1, signal.SIGKILL)  # PR_SET_PDEATHSIG
    except OSError:
        pass


def kill_tree(proc):
    if proc.poll() is not None and not WIN:
        return
    if WIN:
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)], capture_output=True)
    else:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        pass


class Browser:
    """with Browser(args, seconds=60) as b: ...  ->  b.proc, b.profile. Always gone afterwards."""

    def __init__(self, args, seconds=120, headless=True):
        self.args, self.seconds, self.headless = list(args), min(int(seconds), MAX_SECONDS), headless
        self.proc = self.profile = self._timer = None

    def __enter__(self):
        path = find()
        if not path:
            sys.exit("No Edge or Chrome found; ask the human to look instead")
        _join_kill_job()
        self.profile = tempfile.mkdtemp(prefix=PREFIX)
        cmd = [path, f"--user-data-dir={self.profile}", "--no-first-run", "--no-default-browser-check",
               "--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
        if self.headless:
            cmd.append("--headless=new")
        kw = {"env": clean_env(), "stdout": subprocess.PIPE, "stderr": subprocess.PIPE, "stdin": subprocess.DEVNULL}
        if not WIN:
            kw["start_new_session"] = True
            if sys.platform.startswith("linux"):
                kw["preexec_fn"] = _linux_die_with_parent
        self.proc = subprocess.Popen(cmd + self.args, **kw)
        self._timer = threading.Timer(self.seconds, self._overtime)
        self._timer.daemon = True
        self._timer.start()
        return self

    def _overtime(self):
        print(f"error: browser hit its {self.seconds}s limit and was stopped", file=sys.stderr)
        kill_tree(self.proc)

    def __exit__(self, *exc):
        self._timer.cancel()
        kill_tree(self.proc)
        for _ in range(20):   # Windows holds profile files for a moment after the browser dies
            shutil.rmtree(self.profile, ignore_errors=True)
            if not os.path.exists(self.profile):
                break
            time.sleep(0.25)
        return False


# --- sweep: leftovers from crashes or hand-written scripts -------------------------------------------
def _temp_browsers():
    """(pid, age_seconds, profile, is_check) for browser main processes using a profile in the temp folder."""
    temp = os.path.normcase(os.path.realpath(tempfile.gettempdir()))
    out = []
    if WIN:
        ps = ("Get-CimInstance Win32_Process -Filter \"Name='msedge.exe' or Name='chrome.exe' or Name='chromium.exe'\" | "
              "% { '{0}|{1}|{2}' -f $_.ProcessId, [int]((Get-Date) - $_.CreationDate).TotalSeconds, $_.CommandLine }")
        r = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True, timeout=60)
        rows = [l.split("|", 2) for l in r.stdout.splitlines() if l.count("|") >= 2]
    else:
        r = subprocess.run(["ps", "-axo", "pid=,etime=,command="], capture_output=True, text=True, timeout=30)
        rows = []
        for l in r.stdout.splitlines():
            parts = l.split(None, 2)
            if len(parts) == 3 and re.search(r"chrom|edge", parts[2], re.I):
                t = [int(x) for x in re.split("[-:]", parts[1])]
                t = [0] * (4 - len(t)) + t
                rows.append((parts[0], t[0] * 86400 + t[1] * 3600 + t[2] * 60 + t[3], parts[2]))
    for pid, age, cmd in rows:
        m = re.search(r'--user-data-dir=("([^"]+)"|(\S+))', cmd or "")
        if not m or "--type=" in cmd:
            continue
        profile = os.path.normcase(os.path.realpath(m.group(2) or m.group(3)))
        if profile.startswith(temp):
            out.append((int(pid), int(age), profile, bool(re.search(r"--headless|--remote-debugging|--use-fake-device", cmd))))
    return out


def sweep(quiet=False):
    """Stop check browsers older than STALE_SECONDS; delete stale temp browser profiles. Returns (stopped, deleted)."""
    stopped = 0
    try:
        found = _temp_browsers()
    except (OSError, subprocess.SubprocessError):
        found = []
    in_use = set()
    for pid, age, profile, check in found:
        if not (check and age > STALE_SECONDS):
            in_use.add(profile)
        else:
            if WIN:
                subprocess.run(["taskkill", "/T", "/F", "/PID", str(pid)], capture_output=True)
            else:
                try:
                    os.kill(pid, signal.SIGKILL)
                except (ProcessLookupError, PermissionError):
                    continue
            stopped += 1
    deleted, temp, now = 0, tempfile.gettempdir(), time.time()
    for name in os.listdir(temp):
        d = os.path.join(temp, name)
        try:
            is_profile = os.path.isfile(os.path.join(d, "Local State")) or (name.startswith(PREFIX) and os.path.isdir(d))
            if not is_profile or os.path.normcase(os.path.realpath(d)) in in_use or now - os.path.getmtime(d) < 3600:
                continue
        except OSError:
            continue
        shutil.rmtree(d, ignore_errors=True)
        deleted += not os.path.exists(d)
    if not quiet and (stopped or deleted):
        print(f"swept leftovers: stopped {stopped} check browser(s), deleted {deleted} old temp profile(s)", file=sys.stderr)
    return stopped, deleted


if __name__ == "__main__":
    if "--sweep" not in sys.argv:
        sys.exit(__doc__)
    s, d = sweep(quiet=True)
    print(f"Stopped {s} leftover check browser(s); deleted {d} old temp browser profile(s).")
