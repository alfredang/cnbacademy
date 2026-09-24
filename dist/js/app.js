const grid = document.querySelector('#course-grid');
const count = document.querySelector('#result-count');
const emptyState = document.querySelector('#empty-state');
const search = document.querySelector('#course-search');
const chips = [...document.querySelectorAll('[data-category]')];
const amount = new Intl.NumberFormat('en-SG', { maximumFractionDigits: 0 });
const assistantDialog = document.querySelector('#assistant-dialog');
const assistantQuery = document.querySelector('#assistant-query');
const assistantResults = document.querySelector('#assistant-results');

let courses = [];
let category = 'All';

function teachingHours(course) {
  const matches = [...course.when.matchAll(/(\d{1,2}):(\d{2})(am|pm)/gi)];
  if (matches.length !== 2) return null;
  const minutes = ([, hour, minute, period]) => ((Number(hour) % 12) + (period.toLowerCase() === 'pm' ? 12 : 0)) * 60 + Number(minute);
  const duration = (minutes(matches[1]) - minutes(matches[0]) + 1440) % 1440;
  return Number.isFinite(course.weeks) && duration ? (duration * course.weeks) / 60 : null;
}

function detail(label, value) {
  const row = document.createElement('div');
  const term = document.createElement('dt');
  const description = document.createElement('dd');
  term.textContent = label;
  description.textContent = value;
  row.append(term, description);
  return row;
}

function card(course) {
  const article = document.createElement('article');
  article.className = 'course-card';
  article.id = course.code;

  const image = document.createElement('img');
  image.className = 'course-image';
  image.src = `https://images.unsplash.com/photo-${encodeURIComponent(course.img)}?auto=format&fit=crop&w=700&q=70`;
  image.alt = `${course.title} course photo`;
  image.loading = 'lazy';
  image.width = 700;
  image.height = 460;

  const body = document.createElement('div');
  body.className = 'course-body';
  const meta = document.createElement('div');
  meta.className = 'course-meta';
  for (const value of [course.code, course.level, course.campus]) {
    const span = document.createElement('span');
    span.textContent = value;
    meta.append(span);
  }

  const title = document.createElement('h3');
  title.textContent = course.title;
  const summary = document.createElement('p');
  summary.className = 'course-summary';
  summary.textContent = course.summary;

  const details = document.createElement('dl');
  details.className = 'course-details';
  details.append(detail('Length', `${course.weeks} ${course.weeks === 1 ? 'week' : 'weeks'}`));
  details.append(detail('Schedule', course.when));
  const hours = teachingHours(course);
  if (hours !== null) details.append(detail('Teaching time', `${hours} hours total`));

  const fee = document.createElement('div');
  fee.className = 'course-fee';
  const feeLabel = document.createElement('span');
  feeLabel.textContent = 'Total course fee';
  const feeValue = document.createElement('strong');
  feeValue.textContent = `S$${amount.format(course.fee)}`;
  fee.append(feeLabel, feeValue);

  body.append(meta, title, summary, details, fee);
  article.append(image, body);
  return article;
}

function render() {
  const query = search.value.trim().toLocaleLowerCase();
  const visible = courses.filter(course =>
    (category === 'All' || course.cat === category) &&
    [course.code, course.cat, course.title, course.summary, course.level, course.campus]
      .some(value => String(value).toLocaleLowerCase().includes(query))
  );
  grid.replaceChildren(...visible.map(card));
  count.textContent = `${visible.length} ${visible.length === 1 ? 'course' : 'courses'} shown`;
  emptyState.hidden = visible.length !== 0;
}

chips.forEach(chip => chip.addEventListener('click', () => {
  category = chip.dataset.category;
  chips.forEach(item => {
    const active = item === chip;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  render();
}));
search.addEventListener('input', render);

document.querySelector('#open-assistant').addEventListener('click', () => assistantDialog.showModal());
document.querySelector('#close-assistant').addEventListener('click', () => assistantDialog.close());
document.querySelector('#assistant-form').addEventListener('submit', event => {
  event.preventDefault();
  const words = assistantQuery.value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const usefulWords = words.filter(word => word.length > 2 && !['the', 'and', 'for', 'with', 'course', 'class', 'want', 'learn'].includes(word));
  const ranked = courses.map(course => {
    const title = course.title.toLocaleLowerCase();
    const description = [course.cat, course.level, course.summary, ...course.learn].join(' ').toLocaleLowerCase();
    const score = usefulWords.reduce((total, word) => total + (title.includes(word) ? 3 : 0) + (description.includes(word) ? 1 : 0), 0);
    return { course, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

  assistantResults.replaceChildren();
  const message = document.createElement('p');
  message.textContent = ranked.length ? 'These courses may fit:' : 'No close match yet. Try a skill, cuisine, or level.';
  assistantResults.append(message);
  if (!ranked.length) return;
  const list = document.createElement('ul');
  ranked.forEach(({ course }) => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${course.code}`;
    link.textContent = `${course.title} · ${course.weeks} ${course.weeks === 1 ? 'week' : 'weeks'} · S$${amount.format(course.fee)}`;
    link.addEventListener('click', () => {
      category = 'All';
      search.value = '';
      chips.forEach(chip => {
        const active = chip.dataset.category === 'All';
        chip.classList.toggle('is-active', active);
        chip.setAttribute('aria-pressed', String(active));
      });
      render();
      assistantDialog.close();
    });
    item.append(link);
    list.append(item);
  });
  assistantResults.append(list);
});

fetch('data/courses.json')
  .then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then(data => {
    if (!Array.isArray(data)) throw new Error('Expected a course list');
    courses = data;
    render();
  })
  .catch(() => {
    count.textContent = 'Courses could not be loaded. Please refresh the page.';
  });
