import test from 'node:test';
import assert from 'node:assert/strict';
import { adminCsv, amountFilterError, filterControlRecords, initialControlFilters } from './adminControls.ts';
const now = new Date('2026-11-01T20:00:00Z');
const rows = [
  {id:'a',businessName:'Alpha',approvalStatus:'APPROVED',isActive:true,txCount:8,txLimit:10,createdAt:'2026-11-01T18:00:00Z',subscriptionEndsAt:'2026-11-05T00:00:00Z'},
  {id:'b',businessName:'Beta',approvalStatus:'APPROVED',isActive:false,txCount:0,txLimit:0,createdAt:'2026-10-01T18:00:00Z'},
  {id:'c',businessName:'Pending',approvalStatus:'PENDING',isActive:false,createdAt:'2026-11-01T19:00:00Z'},
];
test('merchant controls distinguish suspended approvals, expiring plans, and quota pressure', () => {
  const select = (status:string) => filterControlRecords('merchants',rows,{...initialControlFilters,status},now).map(row=>row.id);
  assert.deepEqual(select('SUSPENDED'),['b']); assert.deepEqual(select('EXPIRING'),['a']); assert.deepEqual(select('QUOTA'),['a']); assert.deepEqual(select('PENDING'),['c']);
});
test('payment search, merchant restriction, exact rolling window and detected amount filters combine', () => {
  const payments = [{id:'1',sessionId:'ref-one',amountEgp:100,detectedAmountEgp:50,status:'CONFIRMED',clientId:'a',createdAt:'2026-11-01T19:00:00Z'},
    {id:'2',sessionId:'ref-two',amountEgp:10,status:'PENDING',clientId:'a',createdAt:'2026-10-29T19:00:00Z'}];
  assert.deepEqual(filterControlRecords('payments',payments,{...initialControlFilters,query:'REF',merchantId:'a',days:'1',min:'40',max:'60'},now).map(row=>row.id),['1']);
  assert.equal(filterControlRecords('payments',payments,{...initialControlFilters,merchantId:'b'},now).length,0);
});
test('unknown delivery outcomes remain separate from successful and retryable records',()=>{
  const deliveries = [{id:'ok',isSuccess:true},{id:'held',isSuccess:false,outcomeKnown:false},{id:'retry',isSuccess:false,outcomeKnown:true}];
  assert.deepEqual(filterControlRecords('webhooks',deliveries,{...initialControlFilters,status:'REVIEW'},now).map(row=>row.id),['held']);
  assert.deepEqual(filterControlRecords('webhooks',deliveries,{...initialControlFilters,status:'SUCCESS'},now).map(row=>row.id),['ok']);
});
test('exports whitelist columns, quote values and protect against spreadsheet formulas',()=>{
  const csv = adminCsv('merchants',[{businessName:'=HYPERLINK("x")',email:'a,b@example.com',apiKey:'secret-not-for-export',detectToken:'private-token'}]);
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes('"\'=HYPERLINK(""x"")"')); assert.ok(csv.includes('"a,b@example.com"'));
  assert.ok(!csv.includes('secret-not-for-export')); assert.ok(!csv.includes('private-token'));
});
test('amount range errors and chronological sorting do not silently discard invalid input',()=>{
  assert.ok(amountFilterError({...initialControlFilters,min:'100',max:'5'}));
  assert.ok(amountFilterError({...initialControlFilters,min:'nope'}));
  assert.equal(amountFilterError({...initialControlFilters,min:'0',max:'100'}),'');
  assert.deepEqual(filterControlRecords('merchants',rows,{...initialControlFilters,sort:'oldest'},now).map(row=>row.id),['b','a','c']);
});
