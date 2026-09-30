const mod = await import('../dist/plugin/browserless.js');
const p = mod.default;
if (typeof p !== 'object' || p === null) throw new Error('default export is not an object');
if (p.id !== 'oc-browserless') throw new Error(`unexpected id: ${p.id}`);
if (typeof p.setup !== 'function') throw new Error('setup is not a function');
if (typeof p.server !== 'function') throw new Error('server is not a function');

const namedExports = Object.keys(mod).filter(k => k !== 'default');
const nonFunctions = namedExports.filter(k => typeof mod[k] !== 'function');
if (nonFunctions.length > 0)
  throw new Error(`non-function named exports: ${nonFunctions.join(', ')}`);

const v1 = await p.server();
const tools = Object.keys(v1.tool);
if (tools.length !== 4) throw new Error(`expected 4 tools, got: ${tools.join(', ')}`);
for (const [name, t] of Object.entries(v1.tool)) {
  if (typeof t.description !== 'string' || typeof t.execute !== 'function') {
    throw new Error(`tool ${name} malformed`);
  }
}

const out = { system: [] };
await v1['experimental.chat.system.transform']({}, out);
if (out.system.length === 0) throw new Error('system prompt hook did not push guidelines');
if (!out.system[0].includes('# Browserless Plugin Guidelines')) {
  throw new Error('guidelines text missing');
}

console.log('SMOKE OK');
console.log('tools:', tools.join(', '));
console.log('named exports:', namedExports.join(', '));
