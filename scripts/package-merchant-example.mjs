// Deterministic ZIP, generated only from the explicit public example allowlist.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root='public/integration/node-merchant';
const files=['.env.example','.gitignore','README.md','package.json','server.mjs','mock-gateway.mjs','fulfillment.mjs','fulfillment.test.mjs','http.test.mjs'];
// ZIP STORE entries with a constant timestamp. No secrets, databases or dependencies.
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
const parts=[],central=[];let offset=0;
for(const file of files){const data=fs.readFileSync(path.join(root,file)),name=Buffer.from('nilepay-node-merchant/'+file),crc=crc32(data);
 const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);
 const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50,0);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(33,14);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(data.length,20);entry.writeUInt32LE(data.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);
 parts.push(header,name,data);central.push(entry,name);offset+=header.length+name.length+data.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
const zip=Buffer.concat([...parts,directory,end]);const destination='public/integration/nilepay-node-merchant.zip';
if(process.argv.includes('--check')){if(!fs.existsSync(destination)||!crypto.timingSafeEqual(crypto.createHash('sha256').update(fs.readFileSync(destination)).digest(),crypto.createHash('sha256').update(zip).digest()))throw new Error('Merchant example ZIP is stale. Run npm run merchant:package.');}
else{fs.writeFileSync(destination,zip);console.log(`Packaged ${files.length} example files.`);}
