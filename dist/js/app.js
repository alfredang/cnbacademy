const grid = document.querySelector('#course-grid');
const count = document.querySelector('#result-count');
const emptyState = document.querySelector('#empty-state');
const search = document.querySelector('#course-search');
const chips = [...document.querySelectorAll('[data-category]')];
const amount = new Intl.NumberFormat('en-SG', { maximumFractionDigits: 0 });
const assistantDialog = document.querySelector('#assistant-dialog');
const assistantQuery = document.querySelector('#assistant-query');
const assistantResults = document.querySelector('#assistant-results');
const signupDialog = document.querySelector('#signup-dialog');
const signupForm = document.querySelector('#signup-form');
const signupSuccess = document.querySelector('#signup-success');
const signupFields = {
  intake: document.querySelector('#signup-intake'),
  name: document.querySelector('#signup-name'),
  email: document.querySelector('#signup-email'),
  mobile: document.querySelector('#signup-mobile'),
  experience: document.querySelector('#signup-experience'),
  allergies: document.querySelector('#signup-allergies'),
  consent: document.querySelector('#signup-consent'),
  newsletter: document.querySelector('#signup-newsletter')
};
let selectedCourse = null;

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

  const signUp = document.createElement('button');
  signUp.className = 'button button-primary course-signup';
  signUp.type = 'button';
  signUp.textContent = 'Sign up';
  signUp.setAttribute('aria-label', `Sign up for ${course.title}`);
  signUp.addEventListener('click', () => openSignup(course));

  body.append(meta, title, summary, details, fee, signUp);
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

function clearSignupErrors() {
  for (const field of Object.values(signupFields)) field.removeAttribute('aria-invalid');
  signupForm.querySelectorAll('.field-error').forEach(message => { message.textContent = ''; });
}

function openSignup(course) {
  selectedCourse = course;
  signupForm.reset();
  clearSignupErrors();
  signupSuccess.hidden = true;
  signupForm.hidden = false;
  document.querySelector('#signup-code').value = course.code;
  document.querySelector('#signup-course-title').value = course.title;
  document.querySelector('#signup-fee').value = `S$${amount.format(course.fee)}`;
  document.querySelector('#signup-weeks').value = String(course.weeks);
  document.querySelector('#signup-schedule').value = course.when;
  document.querySelector('#signup-campus').value = course.campus;
  signupFields.intake.replaceChildren(new Option('Choose an intake', ''), ...course.intakes.map(date => new Option(date, date)));
  document.querySelector('#allergy-warning').hidden = true;
  signupDialog.showModal();
  signupFields.intake.focus();
}

function showSignupError(field, message) {
  field.setAttribute('aria-invalid', 'true');
  document.querySelector(`#${field.id}-error`).textContent = message;
  field.focus();
}

function updateAllergyWarning() {
  document.querySelector('#allergy-warning').hidden = !(
    selectedCourse && /nuts?/i.test(signupFields.allergies.value) && /nuts?/i.test(selectedCourse.allergens)
  );
}

signupFields.allergies.addEventListener('input', updateAllergyWarning);
document.querySelector('#close-signup').addEventListener('click', () => signupDialog.close());
signupForm.addEventListener('submit', event => {
  event.preventDefault();
  clearSignupErrors();
  const values = signupFields;
  const name = values.name.value.trim();
  const email = values.email.value.trim();
  const mobile = values.mobile.value.trim();
  const digits = mobile.replace(/[\s-]/g, '');
  const mobileValid = /^(?:\+65)?[689]\d{7}$/.test(digits);
  const problems = [
    [values.intake, !selectedCourse.intakes.includes(values.intake.value), 'Choose an available intake.'],
    [values.name, name.length < 2, 'Enter your full name (at least 2 characters).'],
    [values.email, !email || !values.email.checkValidity(), 'Enter a valid email address.'],
    [values.mobile, !mobileValid, 'Enter a Singapore number starting with 6, 8 or 9.'],
    [values.experience, !['None', 'Some', 'Confident'].includes(values.experience.value), 'Choose your experience level.'],
    [values.consent, !values.consent.checked, 'Please agree to be contacted about this sign-up.']
  ];
  const firstProblem = problems.find(([, invalid]) => invalid);
  if (firstProblem) {
    showSignupError(firstProblem[0], firstProblem[2]);
    return;
  }

  try {
    const stored = JSON.parse(localStorage.getItem('cb_signups') || '[]');
    if (!Array.isArray(stored)) throw new Error('Invalid saved sign-ups');
    const submitted = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const prefix = `CB-${submitted.replace(/-/g, '')}-`;
    const highest = stored.reduce((max, item) => {
      const value = String(item.ref || '');
      return value.startsWith(prefix) ? Math.max(max, Number(value.slice(prefix.length)) || 0) : max;
    }, 1000);
    if (highest >= 9999) throw new Error('Reference numbers exhausted for today');
    const ref = `${prefix}${String(highest + 1).padStart(4, '0')}`;
    const signup = {
      ref, submitted, course_code: selectedCourse.code, course_title: selectedCourse.title,
      intake: values.intake.value, full_name: name, email,
      mobile, experience: values.experience.value, allergies: values.allergies.value.trim(),
      marketing_opt_in: values.newsletter.checked ? 'yes' : 'no', paid: 'no'
    };
    localStorage.setItem('cb_signups', JSON.stringify([...stored, signup]));
    const body = [
      `Reference: ${ref}`, `Course: ${selectedCourse.code} — ${selectedCourse.title}`,
      `Fee: S$${amount.format(selectedCourse.fee)}`, `Weeks: ${selectedCourse.weeks}`,
      `Schedule: ${selectedCourse.when}`, `Campus: ${selectedCourse.campus}`,
      `Intake: ${signup.intake}`, `Full name: ${name}`, `Email: ${email}`,
      `Mobile: ${mobile}`, `Experience: ${signup.experience}`,
      `Allergies: ${signup.allergies || 'None stated'}`,
      'Consent to contact about this sign-up: Yes',
      `Newsletter opt-in: ${signup.marketing_opt_in}`
    ].join('\n');
    document.querySelector('#signup-reference').textContent = ref;
    document.querySelector('#signup-mailto').href = `mailto:enrol@cookbakeacademy.sg?subject=${encodeURIComponent(`Course sign-up ${ref}`)}&body=${encodeURIComponent(body)}`;
    signupForm.hidden = true;
    signupSuccess.hidden = false;
    document.querySelector('#signup-mailto').focus();
  } catch {
    document.querySelector('#signup-form-error').textContent = 'Could not save the sign-up on this device. Check browser storage and try again.';
  }
});

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
