(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const loginView = $('#login-view');
  const dashboardView = $('#dashboard-view');
  const loginForm = $('#login-form');
  const loginStatus = $('#login-status');
  const logoutButton = $('#logout');
  const refreshButton = $('#refresh');
  const searchInput = $('#search');
  const paymentFilter = $('#payment-filter');
  const exportButton = $('#export');
  const body = $('#ledger-body');
  const warnings = $('#warnings');

  let people = [];
  let filtered = [];

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const date = value => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString([], { year:'numeric', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
  };

  const dollars = person => {
    if (!person.paid) return '—';
    const amount = Number(person.amountPaid || 0) / 100;
    return new Intl.NumberFormat('en-US', {
      style:'currency',
      currency:String(person.currency || 'usd').toUpperCase()
    }).format(amount);
  };

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials:'same-origin',
      cache:'no-store',
      ...options,
      headers:{
        'content-type':'application/json',
        ...(options.headers || {})
      }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Request failed');
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function showLogin() {
    loginView.hidden = false;
    dashboardView.hidden = true;
    logoutButton.hidden = true;
  }

  function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
    logoutButton.hidden = false;
  }

  function renderWarnings(items = []) {
    if (!items.length) {
      warnings.hidden = true;
      warnings.innerHTML = '';
      return;
    }
    warnings.hidden = false;
    warnings.innerHTML = '<b>setup / data warnings</b><br>' + items.map(escapeHtml).join('<br>');
  }

  function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    const mode = paymentFilter.value;

    filtered = people.filter(person => {
      if (mode === 'paid' && !person.paid) return false;
      if (mode === 'unpaid' && (person.paid || !person.signedUpAt)) return false;
      if (mode === 'sms' && !person.smsOptIn) return false;

      if (!query) return true;
      return [
        person.firstName,
        person.fullName,
        person.email,
        person.phone,
        person.campus,
        person.birthday,
      ].some(value => String(value || '').toLowerCase().includes(query));
    });

    renderRows();
  }

  function renderRows() {
    $('#row-count').textContent = filtered.length + (filtered.length === 1 ? ' row' : ' rows');

    if (!filtered.length) {
      body.innerHTML = '<tr><td colspan="10" class="muted">no matching records</td></tr>';
      return;
    }

    body.innerHTML = filtered.map(person => {
      const displayName = person.fullName || person.firstName || '—';
      const status = person.paid
        ? '<span class="status-pill paid">paid</span>'
        : '<span class="status-pill unpaid">unpaid</span>';

      return `<tr>
        <td>${status}</td>
        <td>${escapeHtml(displayName)}</td>
        <td>${escapeHtml(person.email || '—')}</td>
        <td>${escapeHtml(person.phone || '—')}</td>
        <td>${escapeHtml(person.campus || '—')}</td>
        <td>${escapeHtml(person.birthday || '—')}</td>
        <td class="${person.smsOptIn ? 'yes' : 'muted'}">${person.smsOptIn ? 'yes' : 'no'}</td>
        <td>${escapeHtml(dollars(person))}</td>
        <td>${escapeHtml(date(person.signedUpAt))}</td>
        <td>${escapeHtml(date(person.paidAt))}</td>
      </tr>`;
    }).join('');
  }

  function renderSummary(summary, sources = {}) {
    const signupsAvailable = sources.signups !== false;
    const paymentsAvailable = sources.payments !== false;

    $('#stat-total').textContent = summary.total ?? 0;
    $('#stat-paid').textContent = paymentsAvailable ? (summary.paid ?? 0) : '—';
    $('#stat-unpaid').textContent = signupsAvailable ? (summary.unpaid ?? 0) : '—';
    $('#stat-sms').textContent = signupsAvailable ? (summary.smsOptIn ?? 0) : '—';
    $('#stat-paid-only').textContent = signupsAvailable && paymentsAvailable
      ? (summary.paidWithoutSignup ?? 0)
      : '—';
  }

  async function loadData() {
    refreshButton.disabled = true;
    refreshButton.textContent = 'loading...';
    try {
      const data = await api('/.netlify/functions/admin-data');
      people = data.people || [];
      renderSummary(data.summary || {}, data.sources || {});
      renderWarnings(data.warnings || []);
      $('#generated-at').textContent = 'generated ' + date(data.generatedAt);
      applyFilters();
      showDashboard();
    } catch (error) {
      if (error.status === 401) {
        showLogin();
        return;
      }
      renderWarnings([error.message]);
      showDashboard();
    } finally {
      refreshButton.disabled = false;
      refreshButton.textContent = 'refresh data';
    }
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return '"' + text.replaceAll('"', '""') + '"';
  }

  function exportCsv() {
    const headers = ['paid','name','email','phone','campus','birthday','sms_opt_in','amount_paid','currency','signed_up_at','paid_at'];
    const rows = filtered.map(person => [
      person.paid ? 'yes' : 'no',
      person.fullName || person.firstName || '',
      person.email || '',
      person.phone || '',
      person.campus || '',
      person.birthday || '',
      person.smsOptIn ? 'yes' : 'no',
      Number(person.amountPaid || 0) / 100,
      person.currency || '',
      person.signedUpAt || '',
      person.paidAt || '',
    ]);
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'thrillwaukee-guest-ledger.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = loginForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    loginStatus.textContent = 'checking credentials...';

    try {
      await api('/.netlify/functions/admin-auth', {
        method:'POST',
        body:JSON.stringify({
          email:$('#admin-email').value,
          password:$('#admin-password').value,
        })
      });
      $('#admin-password').value = '';
      loginStatus.textContent = '';
      await loadData();
    } catch (error) {
      loginStatus.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  logoutButton.addEventListener('click', async () => {
    try {
      await api('/.netlify/functions/admin-auth', { method:'DELETE' });
    } finally {
      people = [];
      filtered = [];
      showLogin();
    }
  });

  refreshButton.addEventListener('click', loadData);
  searchInput.addEventListener('input', applyFilters);
  paymentFilter.addEventListener('change', applyFilters);
  exportButton.addEventListener('click', exportCsv);

  (async () => {
    try {
      await api('/.netlify/functions/admin-auth');
      await loadData();
    } catch {
      showLogin();
    }
  })();
})();
