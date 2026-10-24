import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onboardingTracks } from './steps.ts';
import { CLI_PACKAGE } from '../distribution.ts';

test('both setup paths require login and destination verification before first creation',()=>{
 for(const track of onboardingTracks('https://workspace.example/path')){
  const titles=track.steps.map(s=>s.title).join('|');assert.match(titles,/Sign in.*Sign your agent.*Verify.*Connect.*first Kage/);
  assert.ok(track.steps.every(s=>!s.optional));
  assert.match(track.steps.find(s=>s.id.includes('-login-'))!.code!,/auth login --url https:\/\/workspace.example$/);
  assert.match(track.steps.find(s=>s.id.includes('-try-'))!.code!,/get_setup.*get_context.*get_authoring_guide/);
  if(track.id==='mcp')for(const step of track.steps.filter(s=>s.code?.includes('auth login')||s.code?.includes('remote get_setup')))assert.ok(step.code!.startsWith('npx -y --package='+CLI_PACKAGE));
 }
 assert.doesNotMatch(JSON.stringify(onboardingTracks('javascript:alert(1)')),/javascript:/);
});
