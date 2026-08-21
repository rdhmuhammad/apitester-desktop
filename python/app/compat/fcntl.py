"""Minimal fcntl compatibility shim for Windows.

Provides the small subset of the POSIX fcntl API used by ansible-core and
ansible-runner on the controller side. File locking maps to msvcrt.locking;
other calls are best-effort no-ops.
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


def _fd(fileobj):
    if isinstance(fileobj, int):
        return fileobj
    return fileobj.fileno()


def flock(fileobj, operation):
    _lock(_fd(fileobj), operation)


def lockf(fileobj, command, length=0, start=0, whence=0):
    _lock(_fd(fileobj), command)


def fcntl(fd, cmd, arg=0):
    return 0


def ioctl(fd, request, arg=0, mutate_flag=True):
    return struct.pack("HHHH", 0, 80, 0, 0)
