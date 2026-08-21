"""POSIX-only module shims so ansible-runner can import and run on Windows."""

import os
import sys

# Ansible requires UTF-8 I/O; keep it working regardless of the system C
# locale (the bundled-runtime build script applies the same setting).
os.environ.setdefault("PYTHONUTF8", "1")

if sys.platform == "win32":
    # Make the child ansible-playbook interpreter load this package's
    # sitecustomize.py (it relaxes ansible's locale check under PYTHONUTF8).
    _compat_dir = os.path.dirname(os.path.abspath(__file__))
    _pypath = os.environ.get("PYTHONPATH")
    if _pypath:
        if _compat_dir not in _pypath.split(os.pathsep):
            os.environ["PYTHONPATH"] = _compat_dir + os.pathsep + _pypath
    else:
        os.environ["PYTHONPATH"] = _compat_dir

_patched_runner = False


def patch_ansible_runner():
    """Apply the runtime patches ansible-runner needs on Windows. Must run
    after ``ansible_runner`` has been imported (the module-level shims below
    must be in place first). Safe to call repeatedly."""
    global _patched_runner
    if _patched_runner:
        return
    _patch_pexpect()
    _patch_handle_termination()
    _patched_runner = True


def _patch_pexpect():
    """ansible-runner calls pexpect.spawn, which pexpect does not expose on
    win32 (pty_spawn is skipped). Map it to the pipe-based PopenSpawn,
    providing the isalive/close/terminate API that lives in pty_spawn."""
    try:
        import pexpect
    except ImportError:
        return
    if hasattr(pexpect, "spawn"):
        return

    import signal
    from pexpect.popen_spawn import PopenSpawn

    class WindowsSpawn(PopenSpawn):
        """PopenSpawn inherits expect/sendline/logfile_read from SpawnBase but
        lacks isalive/close/terminate, which pty_spawn provides only on POSIX.
        Back them with the underlying subprocess.Popen."""

        def isalive(self):
            return self.proc is not None and self.proc.poll() is None

        def _finish(self):
            if self.proc is None:
                return
            try:
                if self.proc.poll() is None:
                    try:
                        self.proc.stdin.close()
                    except Exception:
                        pass
                    self.proc.wait()
            except Exception:
                pass
            self.exitstatus = self.proc.returncode
            self.terminated = True

        def close(self, force=True):
            self._finish()

        def terminate(self, force=False):
            if self.isalive():
                try:
                    self.kill(signal.SIGTERM)
                except OSError:
                    pass
            self._finish()

    def spawn(command, args=(), **kwargs):
        for key in ("ignore_sighup", "echo", "use_poll"):
            kwargs.pop(key, None)
        return WindowsSpawn([command, *args], **kwargs)

    pexpect.spawn = spawn


def _patch_handle_termination():
    """Runner.handle_termination uses os.getpgid/os.killpg, which do not exist
    on Windows. Only reached on timeout/cancel, but keep it from crashing."""
    try:
        import ansible_runner.runner as runner_mod
    except ImportError:
        return

    import os

    if hasattr(os, "getpgid"):
        return

    def handle_termination(cls, pid, pidfile=None):
        try:
            if hasattr(os, "kill"):
                try:
                    os.kill(pid, 9)
                except OSError:
                    pass
        except Exception:
            pass
        try:
            os.remove(pidfile)
        except (TypeError, OSError):
            pass

    runner_mod.Runner.handle_termination = classmethod(handle_termination)


if sys.platform == "win32":
    from . import fcntl as _fcntl
    from . import grp as _grp
    from . import pwd as _pwd
    from . import termios as _termios

    _shims = {
        "fcntl": _fcntl,
        "termios": _termios,
        "pwd": _pwd,
        "grp": _grp,
    }
    for _name, _module in _shims.items():
        if _name not in sys.modules:
            sys.modules[_name] = _module
