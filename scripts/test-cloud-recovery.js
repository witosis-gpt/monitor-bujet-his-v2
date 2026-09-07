const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const storage = initial => {
  const values = new Map(Object.entries(initial||{}));
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
};
const response = (status,body) => ({ok:status>=200&&status<300,status,json:async()=>body});
const session = (expiry=Date.now()/1000+3600) => ({access_token:'test-access',refresh_token:'test-refresh',expires_at:expiry,user:{id:'test-user'}});
function clientHarness(initialSession,fetchImpl){
  const localStorage=storage(initialSession?{hisSupabaseSession:JSON.stringify(initialSession)}:{});
  const context={window:{SUPABASE_CONFIG:{url:'https://example.supabase.co',anonKey:'public-test-key'}},document:{querySelector:()=>null},localStorage,fetch:fetchImpl,AbortSignal,console};
  context.window.window=context.window;context.globalThis=context;
  vm.createContext(context);vm.runInContext(read('supabase-client.js'),context);
  return {client:context.window.SaktiCloud,localStorage};
}
function dataset(month,realization){
  const label=['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September'][month]+' 2026';
  return {period:{year:2026,month,label},rows:[{directorateCode:'ED.7904',roCode:'RO.001',componentCode:'051',subcomponentCode:'051.AA',accountCode:'524111',pagu:1000,cumulative:realization}],executiveSummary:{pagu:1000,realization,monthly:realization},satker:{code:'123456',name:'Test'}};
}
function record(ds,type,filename='test.xlsx'){
  return {source_type:type,year:ds.period.year,month:ds.period.month,filename,imported_at:'2026-09-07T09:12:07.592Z',snapshot_data:ds};
}
function node(){
  return {hidden:false,disabled:false,dataset:{},textContent:'',innerHTML:'',value:'',className:'',children:[],listeners:{},appendChild(child){this.children.push(child);},insertAdjacentElement(){},setAttribute(name,value){this[name]=value;},addEventListener(type,fn){this.listeners[type]=fn;},cloneNode(){const next=node();next.disabled=this.disabled;next.textContent=this.textContent;next.dataset={...this.dataset};return next;},replaceWith(next){this.replacement=next;},remove(){this.removed=true;}};
}
function recoveryHarness(cloud){
  const localStorage=storage();const nodes=new Map();const seeded=new Set(['#sourceInfo','#activePeriod','#monthSelect','#applySaktiData','#cloudStatus','#uploadStatus','#authScreen','#loginError']);const $=selector=>{if(!nodes.has(selector)&&!seeded.has(selector))return null;if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector).replacement||nodes.get(selector);};
  const state={activeSnapshot:null,refreshes:0,closed:0,toasts:[],pending:null,cloud,saveError:null,saved:null};
  const api={configured:true,isAuthenticated:()=>true,restoreSession:async()=>session(),loadSnapshots:async()=>state.cloud,saveSnapshot:async(ds,filename,type)=>{if(state.saveError)throw state.saveError;const saved=record(ds,type,filename);state.saved=saved;const key=`${ds.period.year}-${String(ds.period.month).padStart(2,'0')}`;state.cloud[key]||={sp2d:null,accrual:null};state.cloud[key][type]={dataset:ds,filename,savedAt:saved.imported_at,sourceType:type};return saved;},status:()=>{},healthCheck:async()=>({ok:true})};
  const context={window:{SaktiCloud:api,confirm:()=>true,addEventListener:()=>{}},document:{querySelector:$,createElement:node},localStorage,console,AbortSignal,JSON,Date,Math,Number,Object,String,Error,Promise,Map,Set};
  Object.defineProperty(context,'pendingSaktiImport',{get:()=>state.pending,set:value=>{state.pending=value;}});
  Object.defineProperty(context,'activeSnapshot',{get:()=>state.activeSnapshot,set:value=>{state.activeSnapshot=value;}});
  context.loadSnapshots=()=>JSON.parse(localStorage.getItem('saktiSnapshots')||'{}');
  context.saveSnapshots=buckets=>localStorage.setItem('saktiSnapshots',JSON.stringify(buckets));
  context.snapshotKey=period=>`${period.year}-${String(period.month).padStart(2,'0')}`;
  context.stableRowKey=row=>[row.directorateCode,row.roCode,row.componentCode,row.subcomponentCode,row.accountCode].join('::');
  context.setActiveSnapshot=key=>{const ds=context.loadSnapshots()[key]?.sp2d?.dataset;if(ds)state.activeSnapshot={...ds,pairedRows:ds.rows,provenance:{sp2d:context.loadSnapshots()[key].sp2d,accrual:null}};};
  context.renderSourceInfo=()=>{};context.refreshDashboard=()=>{state.refreshes++;};
  context.handleSaktiFile=async file=>{state.pending={dataset:file.dataset,filename:file.name,sourceType:file.sourceType};};
  context.uploadStatus=()=>{};context.showToast=message=>state.toasts.push(message);
  context.closeUploadModal=()=>{state.closed++;};context.setAuthenticatedUi=()=>{};context.setLoggedOutUi=()=>{};
  context.bootAuthentication=async()=>{};context.yearlyView=null;context.periodMode='monthly';
  context.window.SaktiCloud=api;context.globalThis=context;
  vm.createContext(context);vm.runInContext(read('cloud-save-fix.js'),context);
  return {context,state,localStorage,$};
}
async function run(){
  {
    const old=session(1);let fail=true;
    const {client,localStorage}=clientHarness(old,async()=>{if(fail)throw new Error('network down');return response(200,session());});
    await assert.rejects(client.restoreSession(),/Koneksi autentikasi/);
    assert.equal(JSON.parse(localStorage.getItem('hisSupabaseSession')).refresh_token,'test-refresh','Transient outage must not delete refresh token');
    fail=false;assert.equal((await client.restoreSession()).access_token,'test-access');
  }
  {
    const {client,localStorage}=clientHarness(session(1),async()=>response(400,{error:'invalid_grant'}));
    assert.equal(await client.restoreSession(),null);
    assert.equal(localStorage.getItem('hisSupabaseSession'),null,'Invalid refresh credentials should be cleared');
  }
  {
    let calls=0;
    const {client}=clientHarness(session(),async url=>{calls++;if(url.includes('/rest/v1/'))return response(403,{message:'Permission denied'});return response(200,{});});
    await assert.rejects(client.loadSnapshots(),error=>error.status===403&&error.message==='Permission denied');
    assert.equal(calls,1);
  }
  {
    let calls=0;
    const {client}=clientHarness(session(),async url=>{calls++;if(url.includes('refresh_token'))return response(200,session());if(calls===1)return response(401,{message:'expired'});return response(200,[]);});
    assert.deepEqual(JSON.parse(JSON.stringify(await client.loadSnapshots())),{});
    assert.equal(calls,3,'A 401 should refresh once and retry once');
  }
  {
    const august=dataset(8,500),september=dataset(9,650);
    const cloud={'2026-08':{sp2d:{dataset:august,filename:'aug.xlsx',savedAt:'2026-08-25'},accrual:null},'2026-09':{sp2d:null,accrual:{dataset:september,filename:'sep.xlsx',savedAt:'2026-09-07'}}};
    const h=recoveryHarness(cloud);
    assert.doesNotMatch(read('app.js'), /setTimeout\(\(\) => \{ startCloudSnapshots\(\); document\.querySelector\('#applySaktiData'\)/, 'legacy delayed cloud upload handler must remain removed');
    assert.equal(Object.keys(h.$('#applySaktiData').listeners).filter(type => type === 'click').length, 1, 'exactly one cloud upload handler must be installed');
    await h.context.window.HisRecovery.refreshCloud();
    assert.equal(h.state.activeSnapshot.period.month,8,'Official SP2D must remain August');
    assert.equal(h.state.activeSnapshot.accrualSnapshot.period.month,9,'September accrual must remain available');
    assert.equal(h.state.activeSnapshot.pairedRows[0].accrualOutstanding,150);
    assert.equal(h.state.activeSnapshot.pairedRows[0].potential,650);
    assert.match(h.$('#activePeriod').textContent,/SP2D Agustus 2026/);
    assert.equal(h.$('#monthSelect').value,'2026-09');
    const note=h.$('#sourceInfo').children.find(child=>child.id==='saktiRecoveryNote');
    assert.match(note.textContent,/bukan realisasi SP2D periode/);
    const stale={'2026-07':{sp2d:{dataset:dataset(7,300)},accrual:null}};
    h.localStorage.setItem('saktiSnapshots',JSON.stringify({...cloud,...stale}));
    await h.context.window.HisRecovery.refreshCloud();
    assert.equal(h.context.loadSnapshots()['2026-07'],undefined,'Stale local sources must not be silently reintroduced');
    assert.ok(h.localStorage.getItem('hisSaktiRecoveryBackupV1'),'Previous cache must be retained separately');
  }
  {
    const h=recoveryHarness({});
    const pending={dataset:dataset(9,650),filename:'sep.xlsx',sourceType:'accrual'};
    h.state.pending=pending;h.state.saveError=new Error('Cloud unavailable');
    await h.$('#applySaktiData').listeners.click();
    assert.equal(h.state.closed,0,'Failed save must not close import');
    assert.ok(h.localStorage.getItem('hisPendingSaktiImportV2'));
    assert.equal(h.state.pending,pending);
    h.state.saveError=null;
    await h.$('#applySaktiData').listeners.click();
    assert.equal(h.state.closed,1);
    assert.equal(h.state.pending,null);
    assert.equal(h.localStorage.getItem('hisPendingSaktiImportV2'),null);
    assert.equal(h.state.cloud['2026-09'].accrual.filename,'sep.xlsx');
  }
  console.log('Cloud recovery tests passed');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
