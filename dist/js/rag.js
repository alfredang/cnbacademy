const stopWords = new Set([
  'a', 'about', 'an', 'and', 'any', 'are', 'at', 'be', 'can', 'could', 'do', 'does',
  'for', 'from', 'have', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'our', 'please',
  'the', 'there', 'to', 'us', 'we', 'what', 'which', 'who', 'with', 'you', 'your',
  'course', 'courses', 'class', 'classes', 'singapore', 'academy', 'good',
  'how', 'much', 'when', 'where', 'long',
]);

function terms(text) {
  const lower = String(text).toLowerCase();
  const tokens = (lower.match(/[\p{L}\p{N}]+/gu) || [])
    .filter((term) => term.length > 2 && !stopWords.has(term))
    .map((term) => term === 'pastries' ? 'pastry' : term);
  if (/how long/.test(lower)) tokens.push('duration');
  if (/\b(when|start|date|dates|intake|intakes)\b/.test(lower)) tokens.push('intakes');
  if (/how much|\b(fee|fees|price|cost)\b/.test(lower)) tokens.push('fee');
  if (/\b(where|location|address)\b/.test(lower)) tokens.push('address');
  if (/allerg|\bnuts?\b|peanuts?/.test(lower)) tokens.push('allergens');
  if (/how many|\b(people|students|learners)\b|class size/.test(lower)) tokens.push('size');
  return [...new Set(tokens)];
}

export function buildQuery(text) {
  return terms(text).map((term) => `"${term}"`).join(' OR ');
}

export function search(db, text, k = 3) {
  const query = buildQuery(text);
  if (!query) return [];
  const limit = Math.max(1, Math.min(10, Number.isInteger(k) ? k : 3));
  return db.exec({
    sql: `SELECT doc_id, title, section, body, url,
                 bm25(chunks, 0, 6, 3, 1, 0) AS rank
          FROM chunks WHERE chunks MATCH ?
          ORDER BY rank LIMIT ?`,
    bind: [query, limit],
    rowMode: 'object',
    returnValue: 'resultRows',
  });
}

export function extractiveAnswer(hits) {
  if (!hits.length) return '';
  return hits[0].body.replace(/\*\*/g, '').replace(/^[-*] /gm, '• ').trim();
}

export function structuredAnswer(db, text) {
  const lower = String(text).toLowerCase();
  const under = lower.match(/\bunder\s*(?:s\$|\$)?\s*(\d[\d,]*)/);
  const money = new Intl.NumberFormat('en-SG');
  let sql;
  let bind = [];
  let intro;
  if (/\bcheapest\b|\bleast expensive\b/.test(lower)) {
    sql = 'SELECT code, title, fee, weeks, next_intake FROM courses ORDER BY fee ASC LIMIT 1';
    intro = 'The lowest listed fee is';
  } else if (/\bmost expensive\b|\bpriciest\b/.test(lower)) {
    sql = 'SELECT code, title, fee, weeks, next_intake FROM courses ORDER BY fee DESC LIMIT 1';
    intro = 'The highest listed fee is';
  } else if (under) {
    sql = 'SELECT code, title, fee, weeks, next_intake FROM courses WHERE fee < ? ORDER BY fee ASC LIMIT 3';
    bind = [Number(under[1].replaceAll(',', ''))];
    intro = 'Courses below that fee include';
  } else {
    const asksFee = /how much|\b(fee|fees|price|cost)\b/.test(lower);
    const asksDate = /\b(when|start|date|dates|intake|intakes)\b/.test(lower);
    const asksDuration = /how long|\b(duration|weeks?)\b/.test(lower);
    if (!asksFee && !asksDate && !asksDuration) return null;
    const candidates = db.exec({
      sql: 'SELECT code, title, fee, weeks, schedule, summary, intakes FROM courses',
      rowMode: 'object', returnValue: 'resultRows',
    });
    const focus = terms(text).filter((term) => !['fee', 'intakes', 'duration', 'start', 'date', 'dates', 'week', 'weeks'].includes(term));
    const ranked = candidates.map((course) => ({
      course,
      score: focus.reduce((score, term) => score
        + (course.title.toLowerCase().includes(term) || course.code.toLowerCase().includes(term) ? 4 : 0)
        + (course.summary?.toLowerCase().includes(term) ? 1 : 0), 0),
    })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
    if (!ranked.length || ranked[0].score === ranked[1]?.score) return null;
    const course = ranked[0].course;
    let answer;
    if (asksFee) answer = `The listed fee for ${course.title} (${course.code}) is S$${money.format(course.fee)}.`;
    else if (asksDate) answer = `${course.title} (${course.code}) has listed intakes on ${JSON.parse(course.intakes).join(' and ')}.`;
    else answer = `${course.title} (${course.code}) runs for ${course.weeks} ${course.weeks === 1 ? 'week' : 'weeks'}. The schedule is ${course.schedule}.`;
    return {
      text: answer,
      hits: [{ doc_id: `brochures/${course.code}.md`, title: `${course.title} (${course.code})`,
        section: 'Schedule, fee and class size', body: answer, url: `#${course.code}` }],
    };
  }
  const courses = db.exec({ sql, bind, rowMode: 'object', returnValue: 'resultRows' });
  if (!courses.length) return { text: 'I could not find a course in that price range.', hits: [] };
  const hits = courses.map((course) => ({
    doc_id: `brochures/${course.code}.md`,
    title: `${course.title} (${course.code})`,
    section: 'Schedule, fee and class size',
    body: `${course.weeks} weeks · S$${money.format(course.fee)}${course.next_intake ? ` · Next intake ${course.next_intake}` : ''}`,
    url: `#${course.code}`,
  }));
  return { text: `${intro} ${hits.map((hit) => `${hit.title}: ${hit.body}`).join('; ')}.`, hits };
}
