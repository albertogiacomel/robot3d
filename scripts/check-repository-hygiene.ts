import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function rejectedPaths(paths: readonly string[]): string[] {
  return paths.filter(path => {
    const normalized=path.replaceAll('\\','/');
    if(/^artifacts\/(README\.md|\.gitignore)$/u.test(normalized))return false;
    return /(^|\/)(artifacts|\.wrangler|\.vercel)(\/|$)/u.test(normalized);
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const result=spawnSync('git',['ls-files','-z'],{cwd:resolve(import.meta.dirname,'..'),encoding:'utf8',windowsHide:true});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error('git ls-files failed: '+result.stderr);
  const rejected=rejectedPaths(result.stdout.split('\0').filter(Boolean));
  console.log(JSON.stringify({status:rejected.length?'FAIL':'PASS',rejected}));
  if(rejected.length)process.exitCode=1;
}
