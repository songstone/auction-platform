"""Actual SSE bytes, unpublished outbox, and process termination integration.

Only the dedicated experiment PID, verified by its PID file and HTTP /health,
may be terminated. Neither enqueue nor emitter.send is treated as proof that a
client received bytes: a separate HTTP SSE reader records the actual frame.
"""
from __future__ import annotations

import argparse
import ctypes
import json
import time
from pathlib import Path

from client import SseReader, VersionedView
from crashes import CrashSuite, ProcessEvidence


class StreamCrashSuite(CrashSuite):
    def __init__(self,args):
        super().__init__(args)
        self.process_termination_scope="Actual dedicated JVM TerminateProcess after observed durable outbox/SSE boundary; PID file and /health must agree; Windows exit code recorded. No DB restart or power-loss simulation."

    def state_frames(self,reader,lane,version):
        return [frame for frame in reader.events if frame.get("event")=="state" and
                isinstance(frame.get("data"),dict) and frame["data"].get("lane")==lane and frame["data"].get("version")==version]

    def wait_frame(self,reader,lane,version):
        deadline=time.monotonic()+10
        while time.monotonic()<deadline:
            frames=self.state_frames(reader,lane,version)
            if frames:return frames[0]
            time.sleep(.01)
        self.check("actual SSE state frame received",False,{"lane":lane,"version":version,"frames":reader.events,"errors":reader.errors})

    def stop_verified_process(self):
        pid=int(self.pid_file.read_text(encoding="utf-8-sig").strip())
        health=self.ok(self.primary.get("/health"))
        self.check("dedicated PID file matches currently tested loopback service",health["pid"]==pid and self.primary.parts.hostname in ("127.0.0.1","localhost"),{"pidFile":pid,"health":health,"host":self.primary.parts.hostname})
        evidence=ProcessEvidence(pid)
        kernel=ctypes.WinDLL("kernel32",use_last_error=True)
        kernel.OpenProcess.argtypes=[ctypes.c_uint32,ctypes.c_int,ctypes.c_uint32]
        kernel.OpenProcess.restype=ctypes.c_void_p
        kernel.TerminateProcess.argtypes=[ctypes.c_void_p,ctypes.c_uint32]
        kernel.CloseHandle.argtypes=[ctypes.c_void_p]
        handle=kernel.OpenProcess(0x0001,False,pid)
        self.check("verified experiment process opened for termination",bool(handle),pid)
        try:
            success=kernel.TerminateProcess(handle,72)
        finally:
            kernel.CloseHandle(handle)
        self.check("verified experiment process termination requested",bool(success),pid)
        deadline=time.monotonic()+10
        code=evidence.exit_code()
        while code==259 and time.monotonic()<deadline:
            time.sleep(.01)
            code=evidence.exit_code()
        evidence.close()
        self.check("actual process exit captured",code==72,code,72)
        self.active["observations"]["termination"]={"oldPid":pid,"verifiedHealthPid":health["pid"],"method":"Win32 TerminateProcess on verified experiment process","exitCode":code}
        self.primary.close_all()

    def stream_crash(self,after_actual_send):
        fixture=self.reset()
        # The fixture replaces lane versions. Reset each process's local stream
        # cursor before making any target event; this is experiment setup only.
        self.ok(self.peer.post("/admin/reset",fixture))
        self.clock(0)
        for lane in range(1,5):self.ok(self.primary.post("/admin/tick",{"lane":lane,"nowMs":0}))
        self.clock(1000)
        for api in self.apis:self.ok(api.post("/admin/dispatcher",{"paused":False}))
        original_reader=SseReader(self.primary.url,"/events?client=crash-original").start()
        reconnect_reader=None
        try:
            prime=self.body("stream-prime-member","stream-prime")
            self.bid(prime)
            self.process()
            baseline=self.lanes()
            baseline_version=next(s["version"] for s in baseline if s["lane"]==1)
            self.wait_frame(original_reader,1,baseline_version)
            # The observed baseline frame has passed the enqueue boundary. A
            # short settling interval is setup, not a latency pass criterion;
            # the fault context below must still identify the exact target.
            time.sleep(.15)
            self.ok(self.peer.post("/admin/dispatcher",{"paused":True}))
            time.sleep(.10)
            view=VersionedView();view.snapshot(baseline)
            point="after_event_enqueue" if after_actual_send else "before_event_enqueue"
            self.arm(point,lane=1)
            target=self.body("stream-target-member","stream-target",11000)
            self.bid(target)
            self.process()
            original=self.outcome(target,"ACCEPTED")
            target_version=original["result"]["snapshot"]["version"]
            self.wait_hook()
            hook=self.ok(self.primary.get("/admin/fault/status"))
            self.check("paused dispatcher identifies exact committed target event",hook["context"].get("version")==target_version,hook,target_version)
            if after_actual_send:
                frame=self.wait_frame(original_reader,1,target_version)
                view.event({"lane":1,"version":target_version,"payload":frame["data"]})
                self.active["observations"]["actualFrameBeforeTermination"]=frame
            else:
                self.check("before-enqueue pause prevents target state delivery",not self.state_frames(original_reader,1,target_version),original_reader.events)
            events=self.ok(self.peer.get("/admin/events?lane=1&afterVersion=0"))
            persisted=next(event for event in events if event["version"]==target_version)
            self.check("target state and outbox committed before process termination",persisted["payload"]["highestAmount"]==11000 and original["outcome"]=="ACCEPTED",persisted)
            self.check("publication marker still false at crash boundary",persisted["published"] is False,persisted)
            self.active["observations"].update({"faultPoint":point,"targetVersion":target_version,"outboxBeforeTermination":persisted,"originalRequest":original})
            self.stop_verified_process()
            original_reader.stop()
            self.active["observations"]["originalStreamFrames"]=original_reader.events
            self.restart()
            after=self.request(target)
            self.check("restart preserves original accepted request including original decision",after["result"]==original["result"] and after["seq"]==original["seq"],after,original)
            current=self.lanes()
            state=next(s for s in current if s["lane"]==1)
            self.check("durable highest bid survives loss of original stream process",state["highestAmount"]==11000 and state["held"],state)
            reconnect_reader=SseReader(self.peer.url,"/events?client=crash-reconnected-other-node").start()
            self.ok(self.peer.post("/admin/dispatcher",{"paused":False}))
            replay=self.wait_frame(reconnect_reader,1,target_version)
            held=self.wait_frame(reconnect_reader,1,state["version"])
            ignored_before=view.ignored
            view.event({"lane":1,"version":target_version,"payload":replay["data"]})
            if after_actual_send:
                self.check("actual replay of already received version is ignored",view.ignored==ignored_before+1,{"before":ignored_before,"after":view.ignored,"replayFrame":replay})
            view.event({"lane":1,"version":state["version"],"payload":held["data"]})
            snapshot=self.lanes();view.snapshot(snapshot)
            self.check("reconnected view converges to authoritative state for all lanes",all(view.lanes[int(s["lane"])]==s for s in snapshot),view.lanes,snapshot)
            self.active["observations"].update({"reconnectedOtherNodeFrames":reconnect_reader.events,"replayedTargetFrame":replay,"ignoredDuplicateCount":view.ignored,"finalSnapshot":snapshot,"audit":self.audit()})
        finally:
            original_reader.stop()
            if reconnect_reader:reconnect_reader.stop()
            for api in self.apis:
                api.post("/admin/fault/release")
                api.post("/admin/dispatcher",{"paused":False})


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--urls",nargs="+",default=["http://127.0.0.1:18081","http://127.0.0.1:18082"])
    parser.add_argument("--output",default=str(Path(__file__).resolve().parents[1]/"results"/"stream-crashes"))
    parser.add_argument("--repeats",type=int,default=10)
    parser.add_argument("--seed",type=int,default=20261015)
    parser.add_argument("--only")
    args=parser.parse_args()
    if len(args.urls)<2:parser.error("Two isolated services sharing the spike database are required")
    suite=StreamCrashSuite(args)
    for repetition in range(1,args.repeats+1):
        suite.case("E3_commit_before_state_send_JVM_termination",repetition,lambda:suite.stream_crash(False))
        suite.case("E3_actual_state_received_before_publish_JVM_termination",repetition,lambda:suite.stream_crash(True))
    return suite.finish()


if __name__=="__main__":raise SystemExit(main())
