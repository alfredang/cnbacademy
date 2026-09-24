import sqlite3InitModule from '../vendor/sqlite3.mjs';
import { search, extractiveAnswer, structuredAnswer } from './rag.js';

const panel = document.querySelector('#chat-panel');
const launcher = document.querySelector('#chat-launcher');
const closeButton = document.querySelector('#chat-close');
const messages = document.querySelector('#chat-messages');
const form = document.querySelector('#chat-form');
const input = document.querySelector('#chat-query');
const sendButton = form.querySelector('button[type="submit"]');
const refusal = "I can only answer questions about Cook & Bake's courses, schedules, fees, campuses and policies. For anything else, contact enrol@cookbakeacademy.sg.";
let databasePromise;

async function database() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const [sqlite3, response] = await Promise.all([
        sqlite3InitModule({ locateFile: () => new URL('../vendor/sqlite3.wasm', import.meta.url).href }),
        fetch('data/academy.db'),
      ]);
      if (!response.ok) throw new Error(`Database HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const db = new sqlite3.oo1.DB();
      const pointer = sqlite3.wasm.allocFromTypedArray(bytes);
      const flags = sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_READONLY;
      const rc = sqlite3.capi.sqlite3_deserialize(db.pointer, 'main', pointer, bytes.length, bytes.length, flags);
      if (rc !== sqlite3.capi.SQLITE_OK) {
        sqlite3.wasm.dealloc(pointer);
        db.close();
        throw new Error(`Could not open academy database (${rc})`);
      }
      db.exec('PRAGMA query_only=ON');
      renderFaq(db);
      return db;
    })().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

function renderFaq(db) {
  const faq = document.querySelector('#faq-list');
  const entries = db.exec({
    sql: `SELECT rowid, doc_id, section, body FROM chunks
          WHERE doc_id IN ('faq.md', 'policies.md') ORDER BY doc_id, rowid`,
    rowMode: 'object',
    returnValue: 'resultRows',
  });
  for (const entry of entries) {
    const details = document.createElement('details');
    details.id = `kb-${entry.rowid}`;
    const summary = document.createElement('summary');
    summary.textContent = entry.doc_id === 'policies.md' ? `Policy: ${entry.section}` : entry.section;
    const body = document.createElement('p');
    body.textContent = entry.body.replace(/\*\*/g, '').trim();
    details.append(summary, body);
    faq.append(details);
  }
}

function textMessage(text, kind) {
  const bubble = document.createElement('div');
  bubble.className = `chat-message chat-message-${kind}`;
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  bubble.append(paragraph);
  messages.append(bubble);
  messages.scrollTop = messages.scrollHeight;
  return bubble;
}

function sourceHref(hit, db) {
  const code = hit.doc_id.match(/(?:BAK|CUL)-\d{3}/)?.[0];
  if (code) return `#${code}`;
  if (hit.doc_id === 'campuses.md') return '#campuses';
  const [entry] = db.exec({
    sql: 'SELECT rowid FROM chunks WHERE doc_id = ? AND section = ? LIMIT 1',
    bind: [hit.doc_id, hit.section],
    rowMode: 'object',
    returnValue: 'resultRows',
  });
  return entry ? `#kb-${entry.rowid}` : '#faq';
}

function showAnswer(text, hits, db) {
  const bubble = textMessage(text, 'bot');
  if (!hits.length) return;
  const sourceLabel = document.createElement('strong');
  sourceLabel.className = 'chat-source-label';
  sourceLabel.textContent = 'Sources';
  const list = document.createElement('ul');
  list.className = 'chat-sources';
  for (const hit of hits.slice(0, 3)) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = sourceHref(hit, db);
    link.textContent = `${hit.title} · ${hit.section}`;
    link.addEventListener('click', () => {
      if (link.hash.match(/^#(?:BAK|CUL)-/)) {
        document.querySelector('[data-category="All"]').click();
        const courseSearch = document.querySelector('#course-search');
        courseSearch.value = '';
        courseSearch.dispatchEvent(new Event('input'));
      }
      closeChat();
    });
    item.append(link);
    list.append(item);
  }
  bubble.append(sourceLabel, list);
  messages.scrollTop = messages.scrollHeight;
}

async function answer(question) {
  const db = await database();
  const structured = structuredAnswer(db, question);
  if (structured) return showAnswer(structured.text, structured.hits, db);
  const hits = search(db, question, 3);
  if (!hits.length) return showAnswer(refusal, [], db);
  showAnswer(extractiveAnswer(hits), hits, db);
}

function openChat() {
  panel.hidden = false;
  launcher.setAttribute('aria-expanded', 'true');
  launcher.setAttribute('aria-label', 'Close course assistant');
  input.focus();
}

function closeChat() {
  panel.hidden = true;
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-label', 'Open course assistant');
  launcher.focus();
}

launcher.addEventListener('click', () => panel.hidden ? openChat() : closeChat());
document.querySelector('#open-assistant').addEventListener('click', openChat);
closeButton.addEventListener('click', closeChat);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !panel.hidden) closeChat();
});
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question) return;
  input.value = '';
  textMessage(question, 'user');
  const waiting = textMessage('Searching the academy database…', 'bot');
  sendButton.disabled = true;
  try {
    await answer(question);
  } catch (error) {
    console.error('Course assistant database error:', error);
    textMessage('I could not read the academy database. Please try again in a moment.', 'bot');
  } finally {
    waiting.remove();
    sendButton.disabled = false;
    input.focus();
  }
});
document.querySelectorAll('[data-chat-prompt]').forEach((button) => {
  button.addEventListener('click', () => {
    input.value = button.dataset.chatPrompt;
    form.requestSubmit();
  });
});
database().catch(() => {
  document.querySelector('#faq-list').textContent = 'FAQs are unavailable right now.';
});
