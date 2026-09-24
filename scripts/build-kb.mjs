import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const kbCandidates = [join(root, 'kb'), join(root, 'assets', 'kb'), join(root, '..', 'assets', 'kb')];
const kbDir = (await Promise.all(kbCandidates.map(async (path) => {
  try { return (await stat(path)).isDirectory() ? path : null; }
  catch { return null; }
}))).find(Boolean);
if (!kbDir) throw new Error(`KB folder not found. Checked: ${kbCandidates.join(', ')}`);
const coursesPath = join(root, 'dist', 'data', 'courses.json');
const outputPath = join(root, 'dist', 'data', 'academy.db');

async function markdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.isFile() && /\.md$/i.test(entry.name) ? [path] : [];
  }));
  return nested.flat().sort();
}

function slug(text) {
  return text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
}

function splitSections(source, file) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const title = lines.find((line) => /^# (?!#)\S/.test(line))?.slice(2).trim()
    ?? file.replace(/\.md$/i, '').split('/').at(-1);
  const chunks = [];
  let current;
  const anchors = new Map();

  function finish() {
    if (!current) return;
    chunks.push({ ...current, body: current.lines.join('\n').trim() });
  }

  for (const line of lines) {
    if (/^## (?!#)\S/.test(line)) {
      finish();
      const section = line.slice(3).trim();
      const base = slug(section);
      const seen = anchors.get(base) ?? 0;
      anchors.set(base, seen + 1);
      current = {
        doc_id: file,
        title,
        section,
        url: `kb/${file}${base ? `#${base}${seen ? `-${seen}` : ''}` : ''}`,
        lines: [],
      };
    } else if (current) {
      current.lines.push(line);
    }
  }
  finish();
  return chunks;
}

const files = await markdownFiles(kbDir);
if (!files.length) throw new Error(`No Markdown files found in ${kbDir}`);
const chunks = (await Promise.all(files.map(async (path) => {
  const id = relative(kbDir, path).split(sep).join('/');
  return splitSections(await readFile(path, 'utf8'), id);
}))).flat();
if (!chunks.length) throw new Error('No ## sections found in kb/ Markdown files');

const courses = JSON.parse(await readFile(coursesPath, 'utf8'));
if (!Array.isArray(courses)) throw new Error(`${coursesPath} must contain an array`);

const sqlite3 = await sqlite3InitModule();
const db = new sqlite3.oo1.DB();
try {
  db.exec(`
    CREATE VIRTUAL TABLE chunks USING fts5(
      doc_id UNINDEXED, title, section, body, url UNINDEXED,
      tokenize='porter unicode61'
    );
    CREATE TABLE courses (
      code TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      level TEXT NOT NULL,
      weeks INTEGER NOT NULL,
      fee INTEGER NOT NULL,
      campus TEXT NOT NULL,
      schedule TEXT NOT NULL,
      summary TEXT NOT NULL,
      allergens TEXT NOT NULL,
      bring TEXT NOT NULL,
      intakes TEXT NOT NULL,
      next_intake TEXT,
      class_size INTEGER NOT NULL
    );
  `);

  const insertChunk = db.prepare('INSERT INTO chunks(doc_id, title, section, body, url) VALUES (?, ?, ?, ?, ?)');
  try {
    for (const { doc_id, title, section, body, url } of chunks) {
      insertChunk.bind([doc_id, title, section, body, url]).stepReset();
    }
  } finally {
    insertChunk.finalize();
  }

  const insertCourse = db.prepare(`
    INSERT INTO courses(code, title, category, level, weeks, fee, campus,
                        schedule, summary, allergens, bring, intakes, next_intake, class_size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  try {
    for (const course of courses) {
      insertCourse.bind([
        course.code, course.title, course.cat, course.level, course.weeks,
        course.fee, course.campus, course.when, course.summary,
        course.allergens, course.bring, JSON.stringify(course.intakes),
        [...course.intakes].sort().find((date) => date >= new Date().toISOString().slice(0, 10)) ?? null,
        course.class_size,
      ]).stepReset();
    }
  } finally {
    insertCourse.finalize();
  }

  const bytes = sqlite3.capi.sqlite3_js_db_export(db.pointer);
  await mkdir(join(root, 'dist', 'data'), { recursive: true });
  await writeFile(outputPath, bytes);
  console.log(`Built ${outputPath}: ${chunks.length} chunks from ${files.length} documents, ${courses.length} courses`);
  if (process.argv.includes('--test')) {
    for (const query of ['refunds', 'nut allergy macaron', 'Bukit Timah parking']) {
      const [hit] = db.exec({
        sql: 'SELECT title, section, url FROM chunks WHERE chunks MATCH ? ORDER BY bm25(chunks) LIMIT 1',
        bind: [query],
        rowMode: 'object',
        returnValue: 'resultRows',
      });
      console.log(`${JSON.stringify(query)} → ${hit ? `${hit.title} / ${hit.section} (${hit.url})` : 'no hit'}`);
    }
  }
} finally {
  db.close();
}
