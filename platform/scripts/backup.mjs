import { DatabaseSync } from 'node:sqlite';
import { readFile, mkdir, cp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const config=JSON.parse(await readFile(process.env.PLATFORM_CONFIG||'platform/config.local.json','utf8'));
const data=resolve(config.data_dir),destination=resolve(process.argv[2]||join(data,'backups',new Date().toISOString().replaceAll(':','-')));
await mkdir(destination,{recursive:true});
const db=new DatabaseSync(join(data,'platform.sqlite'),{readOnly:true});
try {db.prepare('VACUUM INTO ?').run(join(destination,'platform.sqlite'));}finally{db.close();}
// Archives are immutable and retained. Every build referenced by the DB snapshot
// already existed before its DB insertion; copying after the snapshot is safe.
await cp(join(data,'artifacts','archives'),join(destination,'archives'),{recursive:true,errorOnExist:true,force:false});
await writeFile(join(destination,'backup.json'),JSON.stringify({created_at:new Date().toISOString(),database:'platform.sqlite',archives:'archives',configuration:'Back up local configuration and credentials separately using your secret storage.'},null,2));
console.log(JSON.stringify({backup:destination}));
