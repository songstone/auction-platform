"""Actual JVM halt and restart integration cases; only the dedicated spike server.

Requires the isolated server started by experiments/spike-001/start.ps1. The
fault hook terminates that server itself. This runner never enumerates or kills
other processes. Windows process handles retain the actual exit code evidence.
"""
from __future__ import annotations

import argparse
import ctypes
import json
import os
import subprocess
import time
from pathlib import Path

from correctness import Suite


class ProcessEvidence:
    def __init__(self, pid):
        self.pid = pid
        self.handle = None
        if os.name == "nt":
            self.kernel = ctypes.WinDLL("kernel32", use_last_error=True)
            self.kernel.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_int, ctypes.c_uint32]
            self.kernel.OpenProcess.restype = ctypes.c_void_p
            self.kernel.GetExitCodeProcess.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint32)]
            self.kernel.CloseHandle.argtypes = [ctypes.c_void_p]
            self.handle = self.kernel.OpenProcess(0x1000 | 0x100000, False, pid)
            if not self.handle:
                raise OSError(ctypes.get_last_error(), f"Cannot open dedicated spike PID {pid}")

    def exit_code(self):
        if not self.handle:
            return None
        code = ctypes.c_uint32()
        if not self.kernel.GetExitCodeProcess(self.handle, ctypes.byref(code)):
            raise OSError(ctypes.get_last_error(), "GetExitCodeProcess failed")
        return code.value

    def close(self):
        if self.handle:
            self.kernel.CloseHandle(self.handle)
            self.handle = None


class CrashSuite(Suite):
    def __init__(self,args):
        super().__init__(args)
        self.root=Path(__file__).resolve().parents[1]
        self.pid_file=self.root/".runtime"/f"server-{self.primary.parts.port}.pid"
        self.process_termination_scope = "Actual dedicated JVM Runtime.halt; Windows exit code and restart command recorded per case. No database process restart or power loss."

    def restart(self):
        self.primary.close_all()
        command=["powershell","-NoProfile","-ExecutionPolicy","Bypass","-File",str(self.root/"start.ps1"),
                 "-Port",str(self.primary.parts.port),"-PidFile",str(self.pid_file),"-Recover"]
        started=time.monotonic()
        capture=self.directory/f"restart-{len(self.cases)+1}.log"
        # File-backed stdout avoids waiting for pipe EOF inherited by a detached
        # Windows grandchild. The launched Java service writes its own logs.
        with capture.open("wb") as output:
            result=subprocess.run(command,stdin=subprocess.DEVNULL,stdout=output,stderr=subprocess.STDOUT,
                                  timeout=30,close_fds=True,creationflags=subprocess.CREATE_NO_WINDOW)
        captured=capture.read_text(encoding="utf-8",errors="replace")
        self.active["observations"]["restart"]={"command":command,"returnCode":result.returncode,
                                                   "output":captured}
        self.check("dedicated server launch command succeeds",result.returncode==0,captured,0)
        ready=False
        while time.monotonic()-started<60:
            response=self.primary.get("/health")
            if response.status==200:
                ready=True
                break
            time.sleep(.15)
        self.check("restarted server becomes healthy",ready,{"waitSeconds":time.monotonic()-started})
        self.active["observations"]["restart"]["readySeconds"]=time.monotonic()-started
        self.active["observations"]["restart"]["newPid"]=int(self.pid_file.read_text(encoding="utf-8-sig").strip())
        for api in self.apis:self.ok(api.post("/admin/mode",{"manual":True}))
        self.clock(1000)

    def halt_case(self,point):
        self.reset()
        pid=int(self.pid_file.read_text(encoding="utf-8-sig").strip())
        evidence=ProcessEvidence(pid)
        body=self.body("crash-member",f"halt-{point}")
        self.ok(self.intent(body))
        self.arm(point,"halt",body["key"])
        if "receipt" in point:
            response=self.submit(body)
        else:
            self.ok(self.submit(body))
            response=self.primary.post("/admin/process",{"lane":1,"nowMs":1000,"max":100})
        self.active["observations"]["fault"]={"point":point,"oldPid":pid,"httpStatus":response.status,"networkError":response.error}
        self.check("halt disconnects in-flight HTTP request",response.status==0 and response.error is not None,response.__dict__)
        deadline=time.monotonic()+10
        code=evidence.exit_code()
        while code==259 and time.monotonic()<deadline:
            time.sleep(.01)
            code=evidence.exit_code()
        evidence.close()
        self.active["observations"]["fault"]["processExitCode"]=code
        self.check("JVM actually exited",code not in (None,259,0),code,"nonzero process exit")
        self.primary.close_all()
        observed=self.request(body,self.peer)
        expected={"before_receipt_commit":"NOT_FOUND","after_receipt_commit":"PENDING",
                  "before_decision_commit":"PENDING","after_decision_commit":"ACCEPTED"}[point]
        self.check("surviving process observes exact commit boundary",observed["outcome"]==expected,observed,expected)
        audit=self.ok(self.peer.get("/admin/audit?lane=1"))
        expected_effects=1 if point=="after_decision_commit" else 0
        self.check("transaction has no partially committed bid effect",len(audit["bids"])==expected_effects,audit,expected_effects)
        self.active["observations"]["beforeRestartAudit"]=audit
        self.restart()
        states=self.lanes()
        self.check("restart holds unfinished lanes pending operator review",all(s["held"] for s in states),states)
        if point=="before_receipt_commit":
            self.outcome(body,"NOT_FOUND")
            self.ok(self.primary.post("/admin/confirm",{"lane":1}))
            self.clock(2000)
            resume=self.control("RESUME","explicit-resume",stop=self.lane()["stopId"])
            self.process(now=2000)
            self.outcome(resume,"ACCEPTED")
            self.clock(2500)
            self.ok(self.submit(body,self.peer))
            self.process(now=2500)
            recovered=self.outcome(body,"ACCEPTED")
            self.check("never committed receipt is not backdated on retransmission",recovered["receivedMs"]==2500,recovered,2500)
            self.check("first actual receipt receives one effect",self.lane()["deadlineMs"]==7500,self.lane(),7500)
        else:
            self.process(now=1000)
            recovered=self.outcome(body,"ACCEPTED")
            self.check("durable original receipt time survives JVM restart",recovered["receivedMs"]==1000,recovered,1000)
            self.check("recovery preserves fault hold",self.lane()["held"],self.lane())
            duplicate=self.ok(self.submit(body,self.peer))
            self.check("retransmission returns recovered immutable decision",duplicate["seq"]==recovered["seq"] and duplicate["outcome"]=="ACCEPTED",duplicate,recovered)
        final=self.audit()
        self.check("single accepted bid after crash recovery",len(final["bids"])==1,final["bids"],1)
        self.active["observations"]["afterRestartAudit"]=final


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--urls",nargs="+",default=["http://127.0.0.1:18081","http://127.0.0.1:18082"])
    parser.add_argument("--output",default=str(Path(__file__).resolve().parents[1]/"results"/"crashes"))
    parser.add_argument("--repeats",type=int,default=10)
    parser.add_argument("--seed",type=int,default=20261015)
    parser.add_argument("--only")
    args=parser.parse_args()
    if len(args.urls)<2:
        parser.error("Crash cases require two isolated servers sharing the dedicated database")
    suite=CrashSuite(args)
    for repetition in range(1,args.repeats+1):
        for point in ("before_receipt_commit","after_receipt_commit","before_decision_commit","after_decision_commit"):
            suite.case(f"E2_JVM_halt_{point}",repetition,lambda p=point:suite.halt_case(p))
    return suite.finish()


if __name__=="__main__":
    raise SystemExit(main())
