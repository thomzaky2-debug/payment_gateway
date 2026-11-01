import test from 'node:test';
import assert from 'node:assert/strict';
import {sendAdminNotification,validateNotification,presentNotificationAudit} from './adminNotificationService.js';
function database(size=1201) {
  const clients=Array.from({length:size},(_,i)=>({id:`m${String(i).padStart(5,'0')}`,isActive:true,approvalStatus:'APPROVED'}));
  clients.push({id:'pending',isActive:true,approvalStatus:'PENDING'},{id:'disabled',isActive:false,approvalStatus:'APPROVED'});
  const state={rows:[] as any[],audits:[] as any[],batches:[] as number[],failAudit:false};
  const auditLog={findUnique:async({where}:any)=>state.audits.find(a=>a.id===where.id)||null};
  const db={auditLog,$transaction:async(fn:any)=>{
    const rows:any[]=[],audits:any[]=[],batches:number[]=[];
    const eligible=(where:any)=>clients.filter(c=>c.isActive===where.isActive&&c.approvalStatus===where.approvalStatus&&(!where.id||where.id===c.id));
    const result=await fn({auditLog:{...auditLog,create:async({data}:any)=>{if(state.failAudit)throw new Error('audit failed');audits.push(data);return data;}},client:{count:async({where}:any)=>eligible(where).length,findMany:async({where,take,cursor}:any)=>eligible(where).filter(c=>!cursor||c.id>cursor.id).slice(0,take)},merchantNotification:{createMany:async({data}:any)=>{rows.push(...data);batches.push(data.length);return{count:data.length};}}});
    state.rows.push(...rows);state.audits.push(...audits);state.batches.push(...batches);return result;
  }};
  return {db:db as unknown as Parameters<typeof sendAdminNotification>[1],state};
}
const payload={title:' Maintenance ',message:' Window begins at 10 PM. ',severity:'WARNING',requestId:'request_12345678901234567890'};
test('rejects invalid content without silently truncating',()=>{assert.equal(validateNotification(payload).title,'Maintenance');for(const body of [{...payload,title:'x'.repeat(151)},{...payload,message:'x'.repeat(2001)},{...payload,severity:'OTHER'},{...payload,expectedCount:0},{...payload,requestId:'short'},{...payload,target:'OTHER'}])assert.throws(()=>validateNotification(body));});
test('large audiences use bounded batches and exclude pending or disabled accounts',async()=>{const {db,state}=database();const result=await sendAdminNotification({...payload,expectedCount:1201},db);assert.equal(result.sentCount,1201);assert.deepEqual(state.batches,[500,500,201]);assert.equal(state.audits.length,1);assert.equal(new Set(state.rows.map(r=>r.id)).size,1201);assert.ok(state.rows.every(r=>r.clientId.startsWith('m')));});
test('same request is replayed without duplicate rows and changed content conflicts',async()=>{const {db,state}=database(2);await sendAdminNotification(payload,db);const replay=await sendAdminNotification(payload,db);assert.equal(replay.replayed,true);assert.equal(state.rows.length,2);await assert.rejects(sendAdminNotification({...payload,title:'Changed'},db),{code:'SEND_REQUEST_CONFLICT'});assert.equal(state.rows.length,2);});
test('audience drift and ineligible single recipient create no notifications',async()=>{const {db,state}=database(2);await assert.rejects(sendAdminNotification({...payload,expectedCount:3},db),{code:'AUDIENCE_CHANGED'});await assert.rejects(sendAdminNotification({...payload,clientId:'pending'},db),{code:'NO_RECIPIENTS'});assert.equal(state.rows.length,0);assert.equal(state.audits.length,0);});
test('single recipient targets only that eligible account',async()=>{const {db,state}=database(3);const result=await sendAdminNotification({...payload,clientId:'m00001',expectedCount:1},db);assert.equal(result.sentCount,1);assert.equal(state.rows[0].clientId,'m00001');});
test('failed audit rolls back all notification writes',async()=>{const {db,state}=database(1001);state.failAudit=true;await assert.rejects(sendAdminNotification(payload,db),/audit failed/);assert.equal(state.rows.length,0);assert.equal(state.audits.length,0);});
test('public history hides internal payload hashes and retains legacy records',async()=>{const {db,state}=database(1);await sendAdminNotification(payload,db);const row=presentNotificationAudit(state.audits[0]);assert.equal(row.notification.sentCount,1);assert.equal(row.details.includes('payloadHash'),false);const legacy={action:'BROADCAST_NOTIFICATION',details:'Legacy send'};assert.deepEqual(presentNotificationAudit(legacy),legacy);});
