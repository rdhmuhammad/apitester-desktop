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
