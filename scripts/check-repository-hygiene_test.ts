import test from 'node:test';
import assert from 'node:assert/strict';
import { rejectedPaths } from './check-repository-hygiene.ts';

test('Generated agent output and provider state cannot be tracked',()=>{
 const paths=['artifacts/opencode/session/report.json','artifacts/codex/benchmark.json','artifacts/verify/demo.png','.wrangler/state/db','.vercel/project.json'];
 assert.deepEqual(rejectedPaths(paths),paths);
});
test('Reviewed guidance and intended product assets remain allowed',()=>{
 assert.deepEqual(rejectedPaths(['artifacts/README.md','artifacts/.gitignore','.opencode/skills/review/SKILL.md','assets/story-hero.png','docs/performance.md']),[]);
});
