"""Read-only, coarse sampling. Does not measure every wait or latency percentile."""
import argparse
import datetime
import json
import subprocess
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL = """
SELECT json_build_object(
 'serverMs',floor(extract(epoch from clock_timestamp())*1000),
 'database', (SELECT row_to_json(d) FROM (SELECT numbackends,xact_commit,xact_rollback,deadlocks,blks_read,blks_hit,temp_bytes FROM pg_stat_database WHERE datname=current_database()) d),
 'sessions',(SELECT json_build_object('active',count(*) FILTER (WHERE state='active'),'lockWaiting',count(*) FILTER (WHERE wait_event_type='Lock'),'ioWaiting',count(*) FILTER (WHERE wait_event_type='IO')) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()),
 'lanes',(SELECT json_agg(q) FROM (SELECT l.lane,l.version,l.held,count(r.seq) AS pending, CASE WHEN count(r.seq)>0 THEN floor(extract(epoch from clock_timestamp())*1000)-min(r.received_ms) ELSE 0 END AS oldest_pending_ms FROM spike_lane l LEFT JOIN spike_request r ON r.lane=l.lane AND r.outcome='PENDING' GROUP BY l.lane ORDER BY l.lane) q),
 'outbox',(SELECT json_build_object('rows',count(*),'unmarked',count(*) FILTER(WHERE NOT published)) FROM spike_outbox));
"""

def run(command):
    result = subprocess.run(command,capture_output=True,text=True,timeout=12)
    if result.returncode: raise RuntimeError(result.stderr[:300])
    return json.loads(result.stdout)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--interval',type=float,default=15)
    parser.add_argument('--samples',type=int,default=0)
    parser.add_argument('--stop-file',default='.runtime/stop-monitor')
    args=parser.parse_args()
    runid=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    output=ROOT/'results'/'resources'/runid
    output.mkdir(parents=True)
    summary={'runId':runid,'command':['python','harness/resource_monitor.py',*__import__('sys').argv[1:]],'intervalSeconds':args.interval,'scope':'READ_ONLY_COARSE_SAMPLING_NOT_EXHAUSTIVE_LOCK_OR_QUEUE_MAXIMA','samplingOverhead':'two HTTP metrics reads plus psql and docker stats per interval; same host as load generator','poolWaiting':'NOT_MEASURED','samples':0,'errors':0,'maxPendingObserved':0,'maxOldestPendingObservedMs':0,'maxLockWaitersObserved':0}
    stop=ROOT/args.stop_file
    print(str(output),flush=True)
    try:
        while not stop.exists() and (not args.samples or summary['samples']<args.samples):
            start=time.monotonic()
            row={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
            for port in (18081,18082):
                try:
                    with urllib.request.urlopen(f'http://127.0.0.1:{port}/metrics',timeout=3) as response:
                        row[str(port)]=json.load(response)
                except Exception as exc:row[str(port)]={'error':str(exc)};summary['errors']+=1
            for label,command in (
                ('postgres',['docker','exec','auction-spike-001-db','psql','-U','spike','-d','spike001','-At','-c',SQL]),
                ('container',['docker','stats','auction-spike-001-db','--no-stream','--format','{{json .}}'])):
                try:row[label]=run(command)
                except Exception as exc:row[label]={'error':str(exc)};summary['errors']+=1
            pg=row.get('postgres',{})
            summary['maxLockWaitersObserved']=max(summary['maxLockWaitersObserved'],pg.get('sessions',{}).get('lockWaiting',0))
            for lane in pg.get('lanes',[]) or []:
                summary['maxPendingObserved']=max(summary['maxPendingObserved'],lane['pending'])
                summary['maxOldestPendingObservedMs']=max(summary['maxOldestPendingObservedMs'],lane['oldest_pending_ms'])
            row['samplingElapsedMs']=(time.monotonic()-start)*1000
            with (output/'samples.jsonl').open('a',encoding='utf-8') as stream:stream.write(json.dumps(row)+'\n')
            summary['samples']+=1
            (output/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
            if args.samples and summary['samples']>=args.samples:break
            time.sleep(max(0,args.interval-(time.monotonic()-start)))
    finally:
        summary['finishedUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
        (output/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')

if __name__=='__main__':main()
