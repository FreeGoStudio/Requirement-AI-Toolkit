const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readCatalog} = require('../scripts/catalog.js');
const a = 'a'.repeat(32), b = 'b'.repeat(32);
const title = text => text.match(/<title>(.*?)<\/title>/)?.[1] || '';
const listing = names => ({ok:true, json:async()=> names.map(name=>({name,type:'directory',mtime:'2026-11-10T00:00:00Z'}))});
const page = name => ({ok:true,status:200,headers:new Headers({'Last-Modified':'Wed, 11 Nov 2026 01:00:00 GMT'}),text:async()=>`<title>${name}</title>`});
test('each refresh sees directory additions and removals without rewriting HTML', async () => {
  let names = [a];
  const fetcher = async (url, options) => {
    assert.equal(options.cache, 'no-store');
    return url === 'catalog/' ? listing(names) : page(url.slice(0,32));
  };
  assert.deepEqual((await readCatalog(fetcher,title)).entries.map(x=>x.id),[a]);
  names = [b];
  assert.deepEqual((await readCatalog(fetcher,title)).entries.map(x=>x.id),[b]);
});
test('filters files, temporary names and broken publications', async () => {
  const seen=[];
  const result = await readCatalog(async url => {
    seen.push(url);
    if(url === 'catalog/') return listing([a,b,'index.html','.temporary','../private']);
    if(url.startsWith(b)) return {status:404,ok:false};
    return page('中文原型');
  },title);
  assert.equal(result.entries.length,1);
  assert.equal(result.entries[0].title,'中文原型');
  assert.equal(seen.length,3);
});
test('API errors are errors, not an empty catalog', async () => {
  await assert.rejects(readCatalog(async()=>({ok:false,status:503}),title),/503/);
  await assert.rejects(readCatalog(async()=>({ok:true,json:async()=>({})}),title),/格式/);
});
test('individual read failure is reported separately from empty state', async () => {
  const result = await readCatalog(async url => url === 'catalog/' ? listing([a]) : Promise.reject(new Error('network')),title);
  assert.equal(result.failures,1);
  assert.deepEqual(result.entries,[]);
});
