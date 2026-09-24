const columns = ['ref', 'submitted', 'course_code', 'course_title', 'intake', 'full_name', 'email', 'mobile', 'experience', 'allergies', 'marketing_opt_in', 'paid'];
const status = document.querySelector('#admin-status');
const headings = document.querySelector('#signup-headings');
const rows = document.querySelector('#signup-rows');
const exportButton = document.querySelector('#export-csv');

function signups() {
  const records = JSON.parse(localStorage.getItem('cb_signups') || '[]');
  if (!Array.isArray(records)) throw new Error('Invalid saved sign-ups');
  return records;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function render(records) {
  headings.replaceChildren(...columns.map(column => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = column;
    return th;
  }));
  rows.replaceChildren(...records.map(record => {
    const tr = document.createElement('tr');
    for (const column of columns) {
      const td = document.createElement('td');
      td.textContent = record[column] ?? '';
      tr.append(td);
    }
    return tr;
  }));
  status.textContent = `${records.length} ${records.length === 1 ? 'sign-up' : 'sign-ups'} on this device.`;
}

try {
  render(signups());
} catch {
  status.textContent = 'Could not read sign-ups from this browser.';
  exportButton.disabled = true;
}

exportButton.addEventListener('click', () => {
  try {
    const records = signups();
    const csv = [columns.join(','), ...records.map(record => columns.map(column => csvCell(record[column])).join(','))].join('\r\n') + '\r\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cook-bake-signups.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `${records.length} ${records.length === 1 ? 'sign-up' : 'sign-ups'} exported.`;
  } catch {
    status.textContent = 'Could not export sign-ups from this browser.';
  }
});
