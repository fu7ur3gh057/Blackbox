"""Live VPS snapshot — psutil/shutil reads, no DB. Frontend polls this for
the dashboard header. Deliberately fast: cpu_percent uses interval=None so
it returns a non-blocking sample."""

import os
import shutil
import time

import psutil
from fastapi import APIRouter, Query

from web.apis.system.schemas import DiskUsage, SystemSnapshot

router = APIRouter(tags=["system"])

_GB = 1024 ** 3


def _uptime_seconds() -> int:
    try:
        with open("/proc/uptime") as f:
            return int(float(f.read().split()[0]))
    except OSError:
        return int(time.time() - psutil.boot_time())


@router.get("", response_model=SystemSnapshot)
async def snapshot(
    paths: list[str] = Query(default=["/"], description="disk mount points to inspect"),
) -> SystemSnapshot:
    vm = psutil.virtual_memory()
    swap = psutil.swap_memory()
    load = os.getloadavg() if hasattr(os, "getloadavg") else (0.0, 0.0, 0.0)

    disks: list[DiskUsage] = []
    for p in paths:
        try:
            u = shutil.disk_usage(p)
        except OSError:
            continue
        disks.append(DiskUsage(
            path=p,
            total_gb=round(u.total / _GB, 2),
            used_gb=round(u.used / _GB, 2),
            free_gb=round(u.free / _GB, 2),
            pct=round(u.used / u.total * 100, 1),
        ))

    return SystemSnapshot(
        cpu_pct=psutil.cpu_percent(interval=None),
        memory_pct=vm.percent,
        memory_used_gb=round(vm.used / _GB, 2),
        memory_total_gb=round(vm.total / _GB, 2),
        swap_pct=swap.percent,
        load_1m=load[0],
        load_5m=load[1],
        load_15m=load[2],
        uptime_seconds=_uptime_seconds(),
        disks=disks,
    )
