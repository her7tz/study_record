import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { startAgentRequest, digest, grantToUser, requireAgentUser, bearerGrant, revokeAgentGrant, grantState, publicGrant, requireSameOrigin, agentBody } from '../lib/agent-access.ts';

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0015_ambiguous_vanisher.sql', import.meta.url), 'utf8'));
  const db = { prepare(sql) { let values = []; return {
    bind(...args) { values = args; return this; },
    async first() { return sqlite.prepare(sql).get(...values) ?? null; },
    async all() { return { results: sqlite.prepare(sql).all(...values) }; },
    async run() { return sqlite.prepare(sql).run(...values); },
  }; } };
  return { sqlite, db };
}
const token = () => 'slr_' + crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
const request = t => new Request('https://site.test/api/agent/read/records', { headers: { Authorization: `Bearer ${t}` } });
const rejectsStatus = (fn, status) => assert.rejects(fn, error => error.status === status);

test('pending tokens cannot read; approval binds the account once; revocation is immediate', async () => {
  const { db, sqlite } = fixture(); const secret = token();
  try {
    const grant = await startAgentRequest(db, await digest(secret), 'My Agent', 'ip');
    assert.equal(grant.status, 'pending');
    assert.equal(JSON.stringify(grant).includes(secret), false);
    assert.equal('token_hash' in grant, false);
    await rejectsStatus(() => requireAgentUser(db, request(secret)), 401);
    await grantToUser(db, grant.id, 'alice');
    assert.equal(await requireAgentUser(db, request(secret)), 'alice');
    await rejectsStatus(() => grantToUser(db, grant.id, 'bob'), 409);
    await rejectsStatus(() => revokeAgentGrant(db, grant.id, 'bob'), 404);
    assert.equal(await requireAgentUser(db, request(secret)), 'alice');
    await revokeAgentGrant(db, grant.id, 'alice');
    await rejectsStatus(() => requireAgentUser(db, request(secret)), 401);
    await rejectsStatus(() => grantToUser(db, grant.id, 'alice'), 409);
    assert.equal(grantState(await bearerGrant(db, request(secret))), 'revoked');
  } finally { sqlite.close(); }
});
test('expired pairing and expired credentials fail closed; email/header cannot replace a token', async () => {
  const { db, sqlite } = fixture(); const secret = token();
  try {
    const now = Math.floor(Date.now() / 1000);
    const grant = await startAgentRequest(db, await digest(secret), 'Agent', 'ip', now - 601);
    await rejectsStatus(() => grantToUser(db, grant.id, 'alice'), 409);
    await rejectsStatus(() => requireAgentUser(db, request(secret)), 401);
    await rejectsStatus(() => requireAgentUser(db, new Request('https://site.test', { headers: { 'oai-authenticated-user-email': 'alice@test' } })), 401);
    await rejectsStatus(() => requireAgentUser(db, request(token())), 401);
    sqlite.prepare('UPDATE agent_authorizations SET user_id=?, authorized_at=?, expires_at=? WHERE id=?').run('alice', now - 1000, now - 1, grant.id);
    await rejectsStatus(() => requireAgentUser(db, request(secret)), 401);
  } finally { sqlite.close(); }
});
test('concurrent approval cannot overwrite the first account, tokens are unique, creation is rate limited', async () => {
  const { db, sqlite } = fixture();
  try {
    const hash = await digest(token()); const grant = await startAgentRequest(db, hash, 'Agent', 'ip');
    const results = await Promise.allSettled([grantToUser(db, grant.id, 'alice'), grantToUser(db, grant.id, 'bob')]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    await rejectsStatus(() => startAgentRequest(db, hash, 'Agent', 'ip2'), 429);
    for (let i = 0; i < 9; i++) await startAgentRequest(db, await digest(token()), 'Agent', 'ip');
    await rejectsStatus(async () => startAgentRequest(db, await digest(token()), 'Agent', 'ip'), 429);
  } finally { sqlite.close(); }
});
test('browser grants require same Origin and bounded JSON bodies', async () => {
  for (const headers of [{}, { origin: 'https://evil.test' }, { origin: 'https://site.test', 'sec-fetch-site': 'cross-site' }]) {
    assert.throws(() => requireSameOrigin(new Request('https://site.test/api/agent/authorizations', { headers })), error => error.status === 403);
  }
  requireSameOrigin(new Request('https://site.test/api/agent/authorizations', { headers: { origin: 'https://site.test' } }));
  await rejectsStatus(() => agentBody(new Request('https://site.test', { method: 'POST', body: '{}'})), 415);
  await rejectsStatus(() => agentBody(new Request('https://site.test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'x'.repeat(3000) }) })), 413);
});
