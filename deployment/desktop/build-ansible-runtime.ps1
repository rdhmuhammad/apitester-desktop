[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PythonHome,
    [string]$Wheelhouse = (Join-Path $PSScriptRoot "wheelhouse"),
    [string]$CollectionArtifacts = (Join-Path $PSScriptRoot "collections"),
    [string]$OutputRoot = (Join-Path $PSScriptRoot "build\runtime\ansible"),
    [string]$AnsibleCoreVersion = "2.19.1"
)

$ErrorActionPreference = "Stop"

function Require-Directory([string]$Path, [string]$Description) {
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "$Description was not found: $Path"
    }
}

Require-Directory $PythonHome "Python build runtime"
Require-Directory $Wheelhouse "Python wheelhouse"

$requirementsFile = Join-Path $PSScriptRoot "ansible-requirements.txt"
if (-not (Test-Path -LiteralPath $requirementsFile -PathType Leaf)) {
    throw "Pinned Ansible requirements file was not found: $requirementsFile"
}

$buildRoot = Split-Path -Parent $OutputRoot
if (-not (Test-Path -LiteralPath $buildRoot -PathType Container)) {
    throw "Build output parent was not found: $buildRoot"
}

if (Test-Path -LiteralPath $OutputRoot) {
    Remove-Item -LiteralPath $OutputRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null

$pythonRoot = Join-Path $OutputRoot "python"
$collectionsRoot = Join-Path $OutputRoot "collections"
New-Item -ItemType Directory -Path $pythonRoot -Force | Out-Null
Copy-Item -Path (Join-Path $PythonHome "*") -Destination $pythonRoot -Recurse -Force
New-Item -ItemType Directory -Path $collectionsRoot -Force | Out-Null

$python = Join-Path $pythonRoot "python.exe"
$pipArguments = @(
    "-m", "pip", "install", "--no-index", "--find-links", $Wheelhouse,
    "--prefix", $pythonRoot, "--requirement", $requirementsFile
)
& $python @pipArguments
if ($LASTEXITCODE -ne 0) {
    throw "Installing the pinned Ansible requirements failed with exit code $LASTEXITCODE"
}

$ansiblePlaybook = Join-Path $pythonRoot "Scripts\ansible-playbook.exe"
if (-not (Test-Path -LiteralPath $ansiblePlaybook -PathType Leaf)) {
    throw "ansible-playbook.exe was not created at $ansiblePlaybook"
}

function Invoke-BundledExe {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $FilePath
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.CreateNoWindow = $true
    $startInfo.EnvironmentVariables["PYTHONUTF8"] = "1"
    $quotedArguments = @()
    foreach ($argument in $Arguments) {
        if ($argument -match '[\s"]') {
            $quotedArguments += '"' + ($argument -replace '"', '\"') + '"'
        }
        else {
            $quotedArguments += $argument
        }
    }
    $startInfo.Arguments = $quotedArguments -join ' '

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $process.StandardInput.Close()
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $output = (($stdoutTask.Result + $stderrTask.Result).Trim())
    return [pscustomobject]@{ ExitCode = $process.ExitCode; Output = $output }
}

$launcherFix = @'
import io, os, shutil, sys, tempfile, zipfile

scripts_dir = sys.argv[1]

def extract_main(exe_path):
    with open(exe_path, "rb") as f:
        data = f.read()
    pos = data.find(b"#!")
    if pos < 0:
        return None
    zip_pos = data.find(b"PK\x03\x04", pos)
    if zip_pos < 0:
        return None
    with zipfile.ZipFile(io.BytesIO(data[zip_pos:])) as zf:
        return zf.read("__main__.py").decode("utf-8")

src_dir = tempfile.mkdtemp(prefix="launcher-src-")
names = []
try:
    for entry in sorted(os.listdir(scripts_dir)):
        if not entry.lower().endswith(".exe"):
            continue
        exe_path = os.path.join(scripts_dir, entry)
        if not os.path.isfile(exe_path):
            continue
        content = extract_main(exe_path)
        if content is None:
            continue
        name = entry[:-4]
        names.append(name)
        with open(os.path.join(src_dir, name + ".py"), "w", encoding="utf-8", newline="") as f:
            f.write("#!/usr/bin/env python\n" + content)
    if not names:
        print("No launchers to regenerate")
        sys.exit(0)
    from pip._vendor.distlib.scripts import ScriptMaker
    sm = ScriptMaker(src_dir, scripts_dir, add_launchers=True)
    sm.executable = "<launcher_dir>\\..\\python.exe"
    sm.clobber = True
    made = sm.make_multiple([n + ".py" for n in names])
    print("Regenerated %d portable launchers" % len(made))
finally:
    shutil.rmtree(src_dir, ignore_errors=True)
'@
$launcherFixFile = Join-Path $env:TEMP ("apitester-launcher-fix-" + [guid]::NewGuid() + ".py")
Set-Content -LiteralPath $launcherFixFile -Value $launcherFix -Encoding UTF8
try {
    & $python $launcherFixFile $pythonRoot\Scripts
    if ($LASTEXITCODE -ne 0) {
        throw "Regenerating portable launchers failed with exit code $LASTEXITCODE"
    }
}
finally {
    Remove-Item -LiteralPath $launcherFixFile -Force -ErrorAction SilentlyContinue
}

$stubModules = @{
    "fcntl.py" = @'
"""Minimal fcntl compatibility shim for Windows.

Provides the small subset of the POSIX fcntl API used by ansible-core on
the controller side. File locking maps to msvcrt.locking; other calls are
best-effort no-ops. Only the bundled runtime uses this module.
"""
import msvcrt
import struct

F_DUPFD = 0
F_GETFD = 1
F_SETFD = 2
F_GETFL = 3
F_SETFL = 4
F_GETLK = 5
F_SETLK = 6
F_SETLKW = 7
FD_CLOEXEC = 1

LOCK_SH = 1
LOCK_EX = 2
LOCK_NB = 4
LOCK_UN = 8


def _lock(fd, mode):
    try:
        if mode == LOCK_UN:
            msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
        elif mode == LOCK_SH:
            msvcrt.locking(fd, msvcrt.LK_RLCK, 1)
        else:
            msvcrt.locking(fd, msvcrt.LK_LOCK, 1)
    except OSError:
        pass


def flock(fileobj, operation):
    _lock(fileobj.fileno(), operation)


def lockf(fileobj, command, length=0, start=0, whence=0):
    _lock(fileobj.fileno(), command)


def fcntl(fd, cmd, arg=0):
    return 0


def ioctl(fd, request, arg=0, mutate_flag=True):
    return struct.pack("HHHH", 0, 80, 0, 0)
'@
    "termios.py" = @'
"""Minimal termios compatibility shim for Windows."""
IGNBRK = 0x0001
BRKINT = 0x0002
IGNPAR = 0x0004
PARMRK = 0x0008
INPCK = 0x0010
ISTRIP = 0x0020
INLCR = 0x0040
IGNCR = 0x0080
ICRNL = 0x0100
IUCLC = 0x0200
IXON = 0x0400
IXANY = 0x0800
IXOFF = 0x1000
IMAXBEL = 0x2000
IUTF8 = 0x4000

OPOST = 0x0001

CSIZE = 0x0030
CS5 = 0x0000
CS6 = 0x0010
CS7 = 0x0020
CS8 = 0x0030
CSTOPB = 0x0040
CREAD = 0x0080
PARENB = 0x0100
PARODD = 0x0200
CLOCAL = 0x0800

ISIG = 0x0001
ICANON = 0x0002
ECHO = 0x0008
ECHOE = 0x0010
ECHOK = 0x0020
ECHONL = 0x0040
NOFLSH = 0x0080
TOSTOP = 0x0100
IEXTEN = 0x8000

TCSANOW = 0
TCSADRAIN = 1
TCSAFLUSH = 2

TCGETS = 0x5401
TCSETS = 0x5402
TIOCGWINSZ = 0x5413
TIOCOUTQ = 0x5411

VMIN = 6
VTIME = 5


def tcgetattr(fd):
    return [0, 0, 0, 0, 0, 0, [0] * 32]


def tcsetattr(fd, when, attrs):
    return None
'@
    "pwd.py" = @'
"""Minimal pwd compatibility shim for Windows."""
import os
from collections import namedtuple

struct_passwd = namedtuple(
    "struct_passwd",
    ["pw_name", "pw_passwd", "pw_uid", "pw_gid", "pw_gecos", "pw_dir", "pw_shell"],
)


def getpwuid(uid):
    name = "root" if uid == 0 else "uid%d" % uid
    return struct_passwd(name, "x", uid, uid, "", os.path.expanduser("~"), "")


def getpwnam(name):
    raise KeyError("getpwnam(): name not found: %r" % name)


def getpwall():
    return [getpwuid(0)]
'@
    "grp.py" = @'
"""Minimal grp compatibility shim for Windows."""
from collections import namedtuple

struct_group = namedtuple("struct_group", ["gr_name", "gr_passwd", "gr_gid", "gr_mem"])


def getgrnam(name):
    raise KeyError("getgrnam(): name not found: %r" % name)


def getgrgid(gid):
    raise KeyError("getgrgid(): gid not found: %r" % gid)


def getgrall():
    return []
'@
}

$sitePackages = Join-Path $pythonRoot "Lib\site-packages"
foreach ($stubName in $stubModules.Keys) {
    Set-Content -LiteralPath (Join-Path $sitePackages $stubName) -Value $stubModules[$stubName] -Encoding ASCII
}

$localePatch = @'
    if not encoding or encoding.lower() not in ('utf-8', 'utf8'):
        if not sys.flags.utf8_mode:  # PYTHONUTF8=1 keeps Python IO in UTF-8 regardless of the C locale
            raise SystemExit('ERROR: Ansible requires the locale encoding to be UTF-8; Detected %s.' % encoding)
'@
$localePatch = $localePatch.TrimEnd("`r", "`n")
$cliInit = Join-Path $pythonRoot "Lib\site-packages\ansible\cli\__init__.py"
$content = Get-Content -LiteralPath $cliInit -Raw
$localeCheck = "    if not encoding or encoding.lower() not in ('utf-8', 'utf8'):`n        raise SystemExit('ERROR: Ansible requires the locale encoding to be UTF-8; Detected %s.' % encoding)"
if (-not $content.Contains($localeCheck)) {
    throw "Locale check pattern not found in $cliInit"
}
Set-Content -LiteralPath $cliInit -Value $content.Replace($localeCheck, $localePatch) -Encoding UTF8 -NoNewline

$mpPatch = @'
if 'fork' in multiprocessing.get_all_start_methods():
    context = multiprocessing.get_context('fork')
else:
    context = multiprocessing.get_context('spawn')  # Windows: no fork start method
'@
$mpPatch = $mpPatch.TrimEnd("`r", "`n")
$mpInit = Join-Path $pythonRoot "Lib\site-packages\ansible\utils\multiprocessing.py"
$mpContent = Get-Content -LiteralPath $mpInit -Raw
$mpCheck = "context = multiprocessing.get_context('fork')"
if (-not $mpContent.Contains($mpCheck)) {
    throw "Multiprocessing context pattern not found in $mpInit"
}
Set-Content -LiteralPath $mpInit -Value $mpContent.Replace($mpCheck, $mpPatch) -Encoding UTF8 -NoNewline

$displayLibcPatch = @'
if os.name == 'nt':
    class _LIBC:  # Windows: no libc; assume width 1 per character
        @staticmethod
        def wcwidth(char):
            return 1

        @staticmethod
        def wcswidth(text, limit):
            return min(len(text), limit)
else:
    _LIBC = ctypes.cdll.LoadLibrary(ctypes.util.find_library('c'))
    _LIBC.wcwidth.argtypes = (ctypes.c_wchar,)
    _LIBC.wcswidth.argtypes = (ctypes.c_wchar_p, ctypes.c_int)
'@
$displayLibcPatch = $displayLibcPatch.TrimEnd("`r", "`n")
$displayLibcCheck = @'
_LIBC = ctypes.cdll.LoadLibrary(ctypes.util.find_library('c'))
# Set argtypes, to avoid segfault if the wrong type is provided,
# restype is assumed to be c_int
_LIBC.wcwidth.argtypes = (ctypes.c_wchar,)
_LIBC.wcswidth.argtypes = (ctypes.c_wchar_p, ctypes.c_int)
'@
$displayLibcCheck = $displayLibcCheck.TrimEnd("`r", "`n")
$displayInit = Join-Path $pythonRoot "Lib\site-packages\ansible\utils\display.py"
$displayContent = Get-Content -LiteralPath $displayInit -Raw
if (-not $displayContent.Contains($displayLibcCheck)) {
    throw "Libc pattern not found in $displayInit"
}
Set-Content -LiteralPath $displayInit -Value $displayContent.Replace($displayLibcCheck, $displayLibcPatch) -Encoding UTF8 -NoNewline

$forkPatch = @'
        if hasattr(os, 'register_at_fork'):
            os.register_at_fork(after_in_child=disable_lock)
'@
$forkPatch = $forkPatch.TrimEnd("`r", "`n")
$forkCheck = "        os.register_at_fork(after_in_child=disable_lock)"
$displayContent = Get-Content -LiteralPath $displayInit -Raw
if (-not $displayContent.Contains($forkCheck)) {
    throw "register_at_fork pattern not found in $displayInit"
}
Set-Content -LiteralPath $displayInit -Value $displayContent.Replace($forkCheck, $forkPatch) -Encoding UTF8 -NoNewline

$dlCheck = "RE_TASKS = re.compile(u'(?:^|%s)+tasks%s?$' % (os.path.sep, os.path.sep))"
$dlPatch = "RE_TASKS = re.compile(u'(?:^|%s)+tasks%s?$' % (re.escape(os.path.sep), re.escape(os.path.sep)))  # Windows: escape path separator"
$dlInit = Join-Path $pythonRoot "Lib\site-packages\ansible\parsing\dataloader.py"
$dlContent = Get-Content -LiteralPath $dlInit -Raw
if (-not $dlContent.Contains($dlCheck)) {
    throw "RE_TASKS pattern not found in $dlInit"
}
Set-Content -LiteralPath $dlInit -Value $dlContent.Replace($dlCheck, $dlPatch) -Encoding UTF8 -NoNewline

$tagsPatch = @'
    def _post_validate(self) -> None:
        if self.path:
            if not os.path.isabs(self.path):  # Windows: absolute paths use drive letters
                raise RuntimeError('The `src` field must be an absolute path.')
        elif not self.description:
            raise RuntimeError('The `src` or `description` field must be specified.')
'@
$tagsPatch = $tagsPatch.TrimEnd("`r", "`n")
$tagsCheck = @'
    def _post_validate(self) -> None:
        if self.path:
            if not self.path.startswith('/'):
                raise RuntimeError('The `src` field must be an absolute path.')
        elif not self.description:
            raise RuntimeError('The `src` or `description` field must be specified.')
'@
$tagsCheck = $tagsCheck.TrimEnd("`r", "`n")
$tagsInit = Join-Path $pythonRoot "Lib\site-packages\ansible\_internal\_datatag\_tags.py"
$tagsContent = Get-Content -LiteralPath $tagsInit -Raw
if (-not $tagsContent.Contains($tagsCheck)) {
    throw "Origin._post_validate pattern not found in $tagsInit"
}
Set-Content -LiteralPath $tagsInit -Value $tagsContent.Replace($tagsCheck, $tagsPatch) -Encoding UTF8 -NoNewline

$workerInit = Join-Path $pythonRoot "Lib\site-packages\ansible\executor\process\worker.py"
$workerContent = Get-Content -LiteralPath $workerInit -Raw
$workerChecks = @(
    @("            os.setsid()", "            if hasattr(os, 'setsid'):  # Windows: no process groups`n                os.setsid()"),
    @("((STDIN_FILENO,), os.O_RDWR | os.O_NONBLOCK),", "((STDIN_FILENO,), os.O_RDWR),  # Windows: O_NONBLOCK unsupported"),
    @("        display.set_queue(self._final_q)`n        self._detach()", "        display.set_queue(self._final_q)`n        # Windows: the collection import finder is installed by CLI.run in the main`n        # process. Under spawn, the worker starts fresh and must install it before`n        # resolving module/action plugins from collections.`n        from ansible.plugins.loader import init_plugin_loader`n        init_plugin_loader()`n        self._detach()")
)
foreach ($workerCheck in $workerChecks) {
    if (-not $workerContent.Contains($workerCheck[0])) {
        throw "Worker pattern not found in $workerInit : $($workerCheck[0])"
    }
    $workerContent = $workerContent.Replace($workerCheck[0], $workerCheck[1])
}
Set-Content -LiteralPath $workerInit -Value $workerContent -Encoding UTF8 -NoNewline

$shellPatch = @'
        tmpdirs = self.get_option('system_tmpdirs')
        if os.name == 'nt' and (not tmpdirs or set(tmpdirs) <= {'/var/tmp', '/tmp', '/usr/tmp'}):
            import tempfile
            tmpdirs = [tempfile.gettempdir()]  # Windows: the POSIX defaults are not absolute paths
        normalized_paths = [d.rstrip('/') for d in tmpdirs]
'@
$shellPatch = $shellPatch.TrimEnd("`r", "`n")
$shellInit = Join-Path $pythonRoot "Lib\site-packages\ansible\plugins\shell\__init__.py"
$shellContent = Get-Content -LiteralPath $shellInit -Raw
$shellCheck = "        normalized_paths = [d.rstrip('/') for d in self.get_option('system_tmpdirs')]"
if (-not $shellContent.Contains($shellCheck)) {
    throw "system_tmpdirs pattern not found in $shellInit"
}
Set-Content -LiteralPath $shellInit -Value $shellContent.Replace($shellCheck, $shellPatch) -Encoding UTF8 -NoNewline

if (Test-Path -LiteralPath $CollectionArtifacts -PathType Container) {
    $collectionArchives = Get-ChildItem -LiteralPath $CollectionArtifacts -File |
        Where-Object { $_.Extension -in ".tar", ".gz" }
    foreach ($archive in $collectionArchives) {
        $result = Invoke-BundledExe -FilePath (Join-Path $pythonRoot "Scripts\ansible-galaxy.exe") `
            -Arguments @("collection", "install", "--offline", "--collections-path", $collectionsRoot, $archive.FullName)
        if ($result.ExitCode -ne 0) {
            throw "Installing collection $($archive.Name) failed with exit code $($result.ExitCode): $($result.Output)"
        }
    }
}

$versionResult = Invoke-BundledExe -FilePath $ansiblePlaybook -Arguments @("--version")
if ($versionResult.ExitCode -ne 0) {
    throw "The bundled ansible-playbook failed its version check: $($versionResult.Output)"
}
$versionOutput = $versionResult.Output

$pythonVersion = (& $python --version 2>&1 | Out-String).Trim()
$collections = @(Get-ChildItem -LiteralPath (Join-Path $collectionsRoot "ansible_collections") -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { $_.Name })
$manifest = [ordered]@{
    provider = "embedded-python-windows"
    pythonVersion = $pythonVersion
    ansibleCoreVersion = $AnsibleCoreVersion
    ansiblePlaybookVersion = $versionOutput.Split([Environment]::NewLine)[0]
    collections = $collections
    buildId = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $OutputRoot "manifest.json") -Encoding UTF8

Write-Host "Bundled Ansible runtime created at $OutputRoot"
