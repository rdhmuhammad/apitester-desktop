"""Minimal grp compatibility shim for Windows."""
from collections import namedtuple

struct_group = namedtuple("struct_group", ["gr_name", "gr_passwd", "gr_gid", "gr_mem"])


def getgrnam(name):
    raise KeyError("getgrnam(): name not found: %r" % name)


def getgrgid(gid):
    raise KeyError("getgrgid(): gid not found: %r" % gid)


def getgrall():
    return []
