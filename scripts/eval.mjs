import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { search, structuredAnswer } from '../dist/js/rag.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

function parseCsv(text) {
  return text.trim().split(/\r?\n/).slice(1).map((line) => {
    const cells = [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g)]
      .map((match) => (match[1] ?? match[2]).replaceAll('""', '"'));
    return { id: cells[0], question: cells[1], expected: cells[2], must: cells[3] };
  });
}

const sqlite3 = await sqlite3InitModule();
const bytes = new Uint8Array(await readFile(resolve(root, 'dist/data/academy.db')));
const db = new sqlite3.oo1.DB();
const pointer = sqlite3.wasm.allocFromTypedArray(bytes);
db.checkRc(sqlite3.capi.sqlite3_deserialize(db.pointer, 'main', pointer, bytes.length, bytes.length,
  sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_READONLY));

const golden = parseCsv(await readFile(resolve(root, 'eval/golden-questions.csv'), 'utf8'));
let passed = 0;
const start = performance.now();
for (const test of golden) {
  const structured = structuredAnswer(db, test.question);
  const hits = structured ? structured.hits : search(db, test.question, 3);
  const ids = hits.map((hit) => hit.doc_id.split('/').at(-1).replace(/\.md$/, ''));
  const sourceOk = test.expected === '*' || ids.some((id) => test.expected.split('|').includes(id));
  const content = `${structured?.text ?? ''} ${hits.map((hit) => `${hit.title} ${hit.section} ${hit.body}`).join(' ')}`.toLowerCase();
  const ok = test.expected === 'REFUSE' ? hits.length === 0
    : sourceOk && content.includes(test.must.toLowerCase());
  if (ok) passed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${test.id} ${test.question} → ${ids.join(', ') || '(refused)'}`);
}
db.close();
console.log(`${passed}/${golden.length} passed · ${((performance.now() - start) / golden.length).toFixed(1)} ms/question`);
process.exitCode = passed === golden.length ? 0 : 1;
