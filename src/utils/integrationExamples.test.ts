import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function snippet(file:string,name:string){const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let value:ts.Expression|undefined;
 const visit=(node:ts.Node)=>{if(ts.isVariableDeclaration(node)&&node.name.getText(source)===name)value=node.initializer;ts.forEachChild(node,visit);};visit(source);
 assert.ok(value,`missing ${name}`);if(ts.isNoSubstitutionTemplateLiteral(value))return value.text;assert.ok(ts.isTemplateExpression(value));
 const substitutions:Record<string,string>={baseUrl:'https://gateway.example',displayApiKey:'example-key',displayWebhookSecret:'example-secret'};
 return value.head.text+value.templateSpans.map(span=>{const replacement=substitutions[span.expression.getText(source)];assert.notEqual(replacement,undefined,'unexpected snippet expression');return replacement+span.literal.text;}).join('');
}
for(const [file,name,fn]of [['src/pages/ApiDocsPage.tsx','nodeCreateSnippet','createCheckout'],['src/components/DocumentationSection.tsx','nodeCreateCode','createCheckoutSession']]){
 test(`copied ${name} creates authenticated checkouts and reuses an order's stable key`,async()=>{
  const code=snippet(file,name),calls:any[]=[];
  const compiled=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},reportDiagnostics:true});
  assert.equal(compiled.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
  const exports={};const context=vm.createContext({exports,module:{exports},process:{env:{INSTAPAY_API_KEY:'server-secret'}},console:{log(){},error(){}},require:(name:string)=>{assert.equal(name,'axios');return{post:async(...args:any[])=>{calls.push(args);return{data:{ok:true,checkout:{sessionId:'cmt_example'}}};}};}});
  vm.runInContext(compiled.outputText,context);await vm.runInContext(`${fn}(150,"1042","customer@instapay")`,context);await vm.runInContext(`${fn}(150,"1042","customer@instapay")`,context);
  assert.equal(calls.length,2);assert.equal(calls[0][0],'https://gateway.example/api/v1/checkout/create');assert.equal(calls[0][2].headers.Authorization,'Bearer server-secret');assert.equal(calls[0][2].headers['Idempotency-Key'],'order_1042_attempt_1');assert.equal(calls[1][2].headers['Idempotency-Key'],calls[0][2].headers['Idempotency-Key']);assert.equal(calls[0][1].amountEgp,150);
 });
}
