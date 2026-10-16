from pathlib import Path
import copy, datetime, hashlib, importlib.metadata, json, re
import yaml
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012
from openapi_spec_validator import validate

root=Path(__file__).resolve().parents[1]
path=root/'contracts/openapi.yaml'
spec=yaml.safe_load(path.read_text(encoding='utf-8'))
validate(spec)
registry=Registry().with_resource('urn:auction:openapi',Resource.from_contents(spec,default_specification=DRAFT202012))
def validator(name):
    return Draft202012Validator({'$ref':'urn:auction:openapi#/components/schemas/'+name},registry=registry,format_checker=FormatChecker())
examples=spec['components']['examples']
positive=[]
for name,entry in examples.items():
    schema=entry['x-schema-ref'].split('/')[-1]
    errors=list(validator(schema).iter_errors(entry['value']))
    assert not errors,(name,[e.message for e in errors])
    positive.append({'example':name,'schema':schema,'status':'PASS'})
for name,schema in spec['components']['schemas'].items():Draft202012Validator.check_schema(schema)
checks=[]
def reject(label,schema,value):
    assert not validator(schema).is_valid(value),(label,'unexpectedly accepted')
    checks.append({'case':label,'schema':schema,'expected':'REJECT','status':'PASS'})
for value in ('0','-1','1.2','1e3','010','+100',' 100 ',100):reject('money:'+str(value),'MoneyWon',value)
for value in ('01','-1',1):reject('counter:'+str(value),'Counter',value)
reject('receipt sequence zero','ReceiptSequence','0')
for value in ('2026-10-20T10:00:00+09:00','2026-02-31T00:00:00Z'):
    reject('UTC instant:'+value,'UtcInstant',value)
for value in ('','a\nb','a\rb','a\x00b'):reject('cursor control:'+repr(value),'StreamCursor',value)
submit=copy.deepcopy(examples['SubmitBidInput']['value']);submit['actorId']='not-an-auth-context'
reject('client actor injection','SubmitBid',submit)
submit=copy.deepcopy(examples['SubmitBidInput']['value']);submit['amount']=10000
reject('number amount','SubmitBid',submit)
reject('ACK missing outcome identity','AcknowledgeBidOutcome',{})
approved=copy.deepcopy(examples['ApprovedBid']['value']);approved.pop('outcomeId')
reject('approved missing outcomeId','BidApproved',approved)
rejected=copy.deepcopy(examples['RejectedBid']['value']);rejected['rejectionCode']='COMMIT_RESULT_UNKNOWN'
reject('transport error is not final rejection','BidRejected',rejected)
no_sale=copy.deepcopy(examples['PublicNoSale']['value']);no_sale['highestBidAmount']='10000'
reject('NO_SALE high price leak','NoSaleResult',no_sale)
no_sale=copy.deepcopy(examples['PublicNoSale']['value']);no_sale['reservePrice']='20000'
reject('NO_SALE reserve price leak','NoSaleResult',no_sale)
lane=copy.deepcopy(examples['LaneChanged']['value']['data'])
base={'auctionId':'auction_demo','lotId':'lot_demo','roundId':'round_demo','laneId':1,'lifecycle':'LIVE','liveState':None,'result':None}
reject('LIVE without live state','PublicAuctionView',base)
base['lifecycle']='WAITING';base['liveState']=lane['currentAuction']
reject('WAITING with live state','PublicAuctionView',base)
base['lifecycle']='FINISHED';base['result']=examples['PublicNoSale']['value']
reject('FINISHED with live state','PublicAuctionView',base)
base['lifecycle']='ROUND_CANCELLED';base['liveState']=None
reject('round cancellation has no fabricated result','PublicAuctionView',base)
finished=copy.deepcopy(lane);finished['status']='FINISHED'
reject('finished lane with current auction','PublicLaneState',finished)
finished['currentAuction']=None;finished['controlState']['held']=True
reject('finished lane with hold','PublicLaneState',finished)
member=copy.deepcopy(examples['AuthenticatedMember']['value']['user']);member['emailVerified']=False
reject('unverified MEMBER role','SessionUser',member)
mixed=copy.deepcopy(examples['AuthenticatedOperator']['value']);mixed['user']['roles']=['OPERATOR','MEMBER']
reject('D-092 operator and member cannot share an account','AuthenticatedSession',mixed)
no_sale_event=copy.deepcopy(examples['NoSaleLaneChanged']['value']);no_sale_event['data']['lastResult']['highestBidAmount']='10000'
reject('D-094 NO_SALE event cannot carry high price','LaneStateEvent',no_sale_event)
no_sale_view={'auctionId':'auction_demo','lotId':'lot_demo','roundId':'round_demo','laneId':1,'lifecycle':'FINISHED','liveState':None,'result':copy.deepcopy(examples['NoSaleLaneChanged']['value']['data']['lastResult'])}
no_sale_view['result']['highestBidAmount']='10000'
reject('D-094 NO_SALE query cannot carry high price','PublicAuctionView',no_sale_view)
reject('resume missing suspension occurrence','ResumeLane',{'requestId':'resume_demo'})
reject('seller cancellation has no required reason extension','MemberCancellation',{'requestId':'cancel_demo','reason':'not a contracted field'})
reject('operator command is not a member action','MemberActionRequest',examples['OriginalResumeSucceeded']['value'])

refs=[]
def walk(value):
    if isinstance(value,dict):
        if '$ref' in value:
            pointer=value['$ref'];assert pointer.startswith('#/'),pointer
            node=spec
            for part in pointer[2:].split('/'):
                node=node[part.replace('~1','/').replace('~0','~')]
            refs.append(pointer)
        for child in value.values():walk(child)
    elif isinstance(value,list):
        for child in value:walk(child)
walk(spec)

def resolve(value):
    if '$ref' not in value:return value
    node=spec
    for part in value['$ref'][2:].split('/'):node=node[part]
    return node
media_examples=[]
def with_document_base(value):
    if isinstance(value,dict):
        return {k:('urn:auction:openapi'+v if k=='$ref' and v.startswith('#/') else with_document_base(v)) for k,v in value.items()}
    if isinstance(value,list):return [with_document_base(v) for v in value]
    return value
def check_media(content,location):
    for media_type,media in content.items():
        for name,raw in media.get('examples',{}).items():
            entry=resolve(raw)
            v=Draft202012Validator(with_document_base(media['schema']),registry=registry,format_checker=FormatChecker())
            errors=list(v.iter_errors(entry['value']))
            assert not errors,(location,media_type,name,[e.message for e in errors])
            media_examples.append({'location':location,'mediaType':media_type,'example':name,'status':'PASS'})

operations=[];mutations=0
for route,item in spec['paths'].items():
    for method,operation in item.items():
        if method not in ('get','post','put','patch','delete'):continue
        operations.append(operation['operationId'])
        assert operation['x-verification-status']=='NOT_RUN'
        expected=set(re.findall(r'\{([^}]+)\}',route))
        actual={p['name'] for raw in operation.get('parameters',[]) if (p:=resolve(raw))['in']=='path'}
        assert expected==actual,(route,expected,actual)
        if method in ('post','put','patch','delete'):
            mutations+=1
            assert any(p.get('$ref')=='#/components/parameters/CsrfToken' for p in operation['parameters']),route
            assert '403' in operation['responses'],route
        role=operation['x-required-role']
        assert operation['security']==([] if role=='PUBLIC' else [{'SessionCookie':[]}]),route
        if role!='PUBLIC':assert {'401','403'}<=set(operation['responses']),route
        if 'requestBody' in operation:
            check_media(resolve(operation['requestBody']).get('content',{}),operation['operationId']+':request')
        for status,response in operation['responses'].items():
            check_media(resolve(response).get('content',{}),operation['operationId']+':response:'+status)
assert len(operations)==len(set(operations))
for name in ('RoundChanged','LaneChanged','NoSaleLaneChanged','Heartbeat','ResyncRequired'):
    assert validator('StreamEvent').is_valid(examples[name]['value']),name

for schema_name in ('AuctionSnapshot','StreamEvent','PublicAuctionView','PublishedLot'):
    visited=set();props=set()
    def collect(value):
        if isinstance(value,dict):
            if '$ref' in value:
                r=value['$ref']
                if r in visited:return
                visited.add(r);collect(resolve(value))
            props.update(value.get('properties',{}))
            for key,child in value.items():
                if key!='$ref':collect(child)
        elif isinstance(value,list):
            for child in value:collect(child)
    collect(spec['components']['schemas'][schema_name])
    forbidden={'reservePrice','bidderId','winnerId','counterpartyEmail','email','subjectId','requestId','outcomeId','suspensionOccurrenceId','incidentIds'}
    assert not props&forbidden,(schema_name,props&forbidden)

# Golden fixture arithmetic, not a product service execution.
snap=examples['SnapshotFourLanes']['value'];round_=snap['round'];lanes=snap['lanes']
assert snap['roundId']==round_['roundId']
assert len(lanes)==round_['laneCount'] and [l['laneId'] for l in lanes]==sorted(set(l['laneId'] for l in lanes))
for l in lanes:
    a=l['currentAuction']
    if a:
        expected=int(a['startingPrice']) if a['highestBidAmount'] is None else int(a['highestBidAmount'])+int(a['bidIncrement'])
        assert int(a['nextBidAmount'])==expected
a=examples['ApprovedBid']['value']
received=datetime.datetime.fromisoformat(a['receivedAt'].replace('Z','+00:00'))
closed=datetime.datetime.fromisoformat(a['resultingClosesAt'].replace('Z','+00:00'))
assert (closed-received).total_seconds()==round_['durations']['followupBidSeconds']
# D-093 fixture checks describe approved pricing arithmetic; no service was called.
for name in ('CreateLotNonAlignedReserve','UpdateLotNonAlignedReserve'):
    terms=examples[name]['value']
    start,reserve,step=(int(terms[k]) for k in ('startingPrice','reservePrice','bidIncrement'))
    assert start>0 and step>0 and reserve>=start and (reserve-start)%step!=0
    assert start<reserve<=start+step
policy_checks={'D-092':{'scope':'mixed-role session schema rejection','status':'PASS'},
 'D-093':{'scope':'non-aligned create/update fixture schemas and price arithmetic only','status':'PASS'},
 'D-094':{'scope':'NO_SALE query/event field rejection; no runtime or record deletion proof','status':'PASS'}}
report={'scope':'CONTRACT_STATIC_ONLY','status':'PASS','validatedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'contractVersion':spec['info']['version'],
 'openapiVersion':spec['openapi'],'openapiSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
 'tools':{n:importlib.metadata.version(n) for n in ('openapi-spec-validator','PyYAML','jsonschema','referencing')},
 'counts':{'paths':len(spec['paths']),'operations':len(operations),'schemas':len(spec['components']['schemas']),'resolvedRefs':len(refs),
           'positiveExamples':len(positive),'operationMediaExamples':len(media_examples),'negativeSchemaChecks':len(checks),'mutationsWithCsrfAnd403':mutations,'publicPrivacyGraphs':4},
 'checks':{'openapiSpecification':'PASS','schemaMetaschemas':'PASS','internalReferences':'PASS','goldenFixtureRelations':'PASS','operationIdsAndPathParameters':'PASS','securityAndCsrf':'PASS','publicSchemaPrivacy':'PASS','operationMediaExamples':'PASS','streamEventUnion':'PASS'},
 'examples':positive,'operationMediaExamples':media_examples,'negativeChecks':checks,'approvedPolicyStaticChecks':policy_checks,
 'notRun':['product-service','database-transactions','concurrency','network-SSE','reconnect','browser','load','failure-recovery','deployment'],
 'note':'Static artifact and schema validation only; no product service, DB, browser, network stream, concurrency or performance acceptance proof.'}
(root/'contracts/validation-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:report[k] for k in ('scope','status','counts','openapiSha256','tools')},ensure_ascii=False))
