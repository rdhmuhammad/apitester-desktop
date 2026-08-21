"""sitecustomize hook for the managed Ansible interpreter on Windows.

ansible-core only supports POSIX control nodes, so the Windows desktop build
patches the bundled runtime (see deployment/desktop/build-ansible-runtime.ps1).
This hook applies the equivalent fixes at interpreter startup for any managed
ansible-playbook child process by monkeypatching the POSIX-only surfaces.

The child loads this module automatically because ``app/compat`` is prepended
to ``PYTHONPATH`` when the service starts (see app/compat/__init__.py).
"""

import os


def _install_locale():
    """ansible's initialize_locale() rejects non-UTF-8 locales (e.g. cp1252).
    PYTHONUTF8 keeps Python IO in UTF-8 but does not change locale.getlocale();
    make it report UTF-8 whenever the managed runner runs with PYTHONUTF8=1."""
    try:
        import locale

        _orig = locale.getlocale

        def getlocale(category=locale.LC_CTYPE, *args, **kwargs):
            try:
                lang, enc = _orig(category, *args, **kwargs)
            except Exception:
                lang, enc = None, None
            if not enc or enc.lower() not in ("utf-8", "utf8"):
                enc = "UTF-8"
            return (lang, enc)

        locale.getlocale = getlocale
    except Exception:
        pass


def _install_multiprocessing():
    """ansible/utils/multiprocessing.py hardcodes the 'fork' start method, which
    does not exist on Windows. Fall back to 'spawn' like the build script."""
    try:
        import multiprocessing

        if "fork" not in multiprocessing.get_all_start_methods():
            _orig = multiprocessing.get_context

            def get_context(method=None):
                if method == "fork":
                    method = "spawn"
                return _orig(method)

            multiprocessing.get_context = get_context
    except Exception:
        pass


def _install_posix_attr_shims():
    """Provide no-ops for POSIX-only os members ansible calls unconditionally:
    os.register_at_fork (ansible/utils/display.py), os.setsid and
    os.O_NONBLOCK (ansible/executor/process/worker.py)."""
    try:
        if not hasattr(os, "register_at_fork"):

            def register_at_fork(*args, **kwargs):
                return None

            os.register_at_fork = register_at_fork

        if not hasattr(os, "setsid"):

            def setsid():
                return None

            os.setsid = setsid

        if not hasattr(os, "O_NONBLOCK"):
            os.O_NONBLOCK = 0
    except Exception:
        pass


def _install_libc_stub():
    """ansible/utils/display.py loads libc via ctypes for wcwidth/wcswidth,
    which does not exist on Windows. Substitute a stub that treats every
    character as width 1, mirroring the build script's _LIBC fallback."""
    try:
        import ctypes

        if os.name != "nt":
            return

        _orig_load_library = ctypes.cdll.LoadLibrary

        class _LibCStub:
            def __getattr__(self, name):
                if name == "wcswidth":
                    return lambda text, limit: min(len(text), limit)
                if name == "wcwidth":
                    return lambda char: 1
                raise AttributeError(name)

        def load_library(name, mode=None):
            if name is None or name == "c":
                return _LibCStub()
            if mode is not None:
                return _orig_load_library(name, mode)
            return _orig_load_library(name)

        ctypes.cdll.LoadLibrary = load_library
    except Exception:
        pass


def _install_import_patchers():
    """Intercept specific ansible modules at import time and repair POSIX-only
    constructs, mirroring the build script's site-packages patches."""
    try:
        import importlib.abc
        import re
        import sys
    except Exception:
        return

    if sys.platform != "win32":
        return

    def dataloader_exec(loader, module):
        # ansible/parsing/dataloader.py compiles a regex from os.path.sep at
        # import time; on Windows the raw backslash yields an unterminated
        # subpattern. Retry with escaped separators.
        _orig_compile = re.compile

        def compile_wrapper(pattern, flags=0):
            try:
                return _orig_compile(pattern, flags)
            except re.error:
                if isinstance(pattern, str) and "\\" in pattern:
                    return _orig_compile(pattern.replace("\\", "\\\\"), flags)
                raise

        try:
            re.compile = compile_wrapper
            loader.exec_module(module)
        finally:
            re.compile = _orig_compile

    def tags_patch(loader, module):
        # ansible/_internal/_datatag/_tags.py rejects absolute Windows paths
        # because it only accepts a leading '/'. Use os.path.isabs instead.
        loader.exec_module(module)
        origin = getattr(module, "Origin", None)
        if origin is None or getattr(origin, "_post_validate", None) is None:
            return

        def _post_validate(self):
            if self.path:
                if not os.path.isabs(self.path):
                    raise RuntimeError("The `src` field must be an absolute path.")
            elif not self.description:
                raise RuntimeError(
                    "The `src` or `description` field must be specified."
                )

        origin._post_validate = _post_validate

    def worker_patch(loader, module):
        # Under spawn the worker starts a fresh interpreter, so it must install
        # the collection import finder itself before resolving modules/action
        # plugins from collections (normally done by CLI.run in the parent).
        loader.exec_module(module)
        worker_cls = getattr(module, "WorkerProcess", None)
        if worker_cls is None or getattr(worker_cls, "run", None) is None:
            return
        _orig_run = worker_cls.run

        def run(self):
            try:
                from ansible.plugins.loader import init_plugin_loader

                init_plugin_loader()
            except Exception:
                pass
            return _orig_run(self)

        worker_cls.run = run

    def shell_patch(loader, module):
        # On Windows the POSIX system_tmpdirs defaults ('/tmp', '/var/tmp')
        # are relative paths and are rejected; substitute the real temp dir.
        loader.exec_module(module)
        shell_base = getattr(module, "ShellBase", None)
        if shell_base is None or getattr(shell_base, "_normalize_system_tmpdirs", None) is None:
            return

        def _normalize_system_tmpdirs(self):
            tmpdirs = self.get_option("system_tmpdirs")
            if os.name == "nt" and (
                not tmpdirs or set(tmpdirs) <= {"/var/tmp", "/tmp", "/usr/tmp"}
            ):
                import tempfile

                tmpdirs = [tempfile.gettempdir()]
            normalized_paths = [d.rstrip("/") for d in tmpdirs]
            if not all(os.path.isabs(d) for d in normalized_paths):
                from ansible.errors import AnsibleError
                from ansible.module_utils.common.text.converters import to_native

                raise AnsibleError(
                    "The configured system_tmpdirs contains a relative path: {0}. All"
                    " system_tmpdirs must be absolute".format(to_native(normalized_paths))
                )
            self.set_option("system_tmpdirs", normalized_paths)

        shell_base._normalize_system_tmpdirs = _normalize_system_tmpdirs

    patchers = {
        "ansible.parsing.dataloader": dataloader_exec,
        "ansible._internal._datatag._tags": tags_patch,
        "ansible.executor.process.worker": worker_patch,
        "ansible.plugins.shell": shell_patch,
    }
    done = set()

    class _Patcher(importlib.abc.MetaPathFinder):
        def find_spec(self, fullname, path=None, target=None):
            patch = patchers.get(fullname)
            if patch is None or fullname in done:
                return None
            done.add(fullname)
            spec = None
            for finder in sys.meta_path:
                if finder is self:
                    continue
                try:
                    spec = finder.find_spec(fullname, path, target)
                except (AttributeError, ImportError):
                    spec = None
                if spec is not None:
                    break
            if spec is None or spec.loader is None:
                return None

            _loader = spec.loader

            class _Loader(importlib.abc.Loader):
                def create_module(self, module_spec):
                    create = getattr(_loader, "create_module", None)
                    if create is not None:
                        return create(module_spec)
                    return None

                def exec_module(self, module):
                    patch(_loader, module)

            spec.loader = _Loader()
            return spec

    sys.meta_path.insert(0, _Patcher())


def _install():
    if os.environ.get("PYTHONUTF8") != "1" or os.name != "nt":
        return
    _install_locale()
    _install_multiprocessing()
    _install_posix_attr_shims()
    _install_libc_stub()
    _install_import_patchers()
    _install_proxy_pickle()


def _restore_proxy(module_name, qualname, wrapped):
    """Pickle reconstructor: rebuild a wrapt ObjectProxy around its wrapped
    object (or return the plain object if the proxy cannot be rebuilt)."""
    try:
        import importlib

        cls = importlib.import_module(module_name)
        for part in qualname.split("."):
            cls = getattr(cls, part)
        return cls(wrapped)
    except Exception:
        return wrapped


def _install_proxy_pickle():
    """ansible's vendored wrapt ObjectProxy refuses to pickle, but the worker
    processes are spawned (no fork on Windows) so the whole WorkerProcess state
    is pickled — including proxies such as PluginInterposer and HostVars.
    Restore them by wrapping the pickled wrapped object again."""
    try:
        import inspect
    except Exception:
        return

    try:
        from ansible._internal import _wrapt
    except Exception:
        return

    def _reduce(self):
        wrapped = getattr(self, "__wrapped__", None)
        if wrapped is None:
            raise NotImplementedError("object proxy must define __reduce_ex__()")
        cls = type(self)
        try:
            module = inspect.getmodule(cls)
            module_name = module.__name__ if module is not None else None
        except Exception:
            module_name = None
        return (_restore_proxy, (module_name, cls.__qualname__, wrapped))

    def _reduce_ex(self, protocol):
        return _reduce(self)

    _wrapt.ObjectProxy.__reduce__ = _reduce
    _wrapt.ObjectProxy.__reduce_ex__ = _reduce_ex


_install()
