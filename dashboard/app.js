// Token Radar — the page. No network: every byte it shows is in data.js beside it.
// The board ranks pre-token protocols by implied launch value; the detail view shows one
// protocol's model breakdown and farm plan; the model tab shows the calibration and a
// sandbox that re-ranks the board live from the same snapshot figures.

const R = window.RADAR;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** $2.75B, $512.4M, $48.2K, $950. */
function money(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return '$' + Math.round(n);
}

function pct(n) {
  if (n === null || n === undefined) return '—';
  return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
}

function ageText(days) {
  if (days === null || days === undefined) return '—';
  if (days < 30) return days + 'd';
  if (days < 365) return Math.round(days / 30) + 'mo';
  return (days / 365).toFixed(1) + 'y';
}

const watchSet = new Set(R.watchlist_slugs || []);

/** The rows after the current filters, in the current sort. */
function filteredRows() {
  const q = $('q').value.trim().toLowerCase();
  const chain = $('chain').value;
  const cat = $('cat').value;
  const onlyWatch = $('watchonly').checked;
  let rows = R.rows.filter((r) => {
    if (q && !(r.name.toLowerCase().includes(q) || r.slug.includes(q))) return false;
    if (chain && !r.chains.includes(chain)) return false;
    if (cat && (r.category || 'Uncategorised') !== cat) return false;
    if (onlyWatch && !watchSet.has(r.slug)) return false;
    return true;
  });
  const sort = $('sort').value;
  const by = {
    implied: (a, b) => b.implied_value_usd - a.implied_value_usd,
    tvl: (a, b) => b.tvl_usd - a.tvl_usd,
    growth: (a, b) => (b.change_7d ?? -1e9) - (a.change_7d ?? -1e9),
    age: (a, b) => (b.age_days ?? -1) - (a.age_days ?? -1),
    name: (a, b) => (a.name < b.name ? -1 : 1),
  }[sort];
  return rows.sort(by);
}

function badge(s) {
  const cls = s === 'heating up' ? 'badge hot' : s === 'whale TVL' || s === 'multi-chain' ? 'badge' : 'badge';
  return `<span class="${cls}">${esc(s)}</span>`;
}

function renderBoard() {
  const rows = filteredRows();
  $('count').textContent = `${rows.length} of ${R.rows.length} protocols — ranked by implied launch value`;
  $('rows').innerHTML = rows.map((r) => {
    const g = r.change_7d === null ? '<span class="dim">—</span>' : `<span class="${r.change_7d >= 0 ? 'up' : 'down'}">${pct(r.change_7d)}</span>`;
    const watch = watchSet.has(r.slug) ? '<span class="badge watch">watchlist</span>' : '';
    return `<tr>
      <td class="num">${r.rank}</td>
      <td><span class="name">${esc(r.name)}</span><span class="sub">${esc(r.slug)}</span></td>
      <td>${esc(r.category || '—')}</td>
      <td>${r.chains.slice(0, 3).map(esc).join(', ')}${r.chains.length > 3 ? ' +' + (r.chains.length - 3) : ''}</td>
      <td class="num">${money(r.tvl_usd)}</td>
      <td class="num">${g}</td>
      <td class="num">${ageText(r.age_days)}</td>
      <td class="num val">${money(r.implied_value_usd)}</td>
      <td>${watch}${r.signals.map(badge).join('')}</td>
      <td><button class="link" type="button" data-slug="${esc(r.slug)}">Farm plan →</button></td>
    </tr>`;
  }).join('');
}

function renderLive() {
  $('live').innerHTML = R.live.map((p) => `<tr>
    <td><span class="name">${esc(p.name)}</span><span class="sub">${esc(p.slug)}</span></td>
    <td>${esc(p.category || '—')}</td>
    <td class="num">${money(p.tvl_usd)}</td>
    <td class="num">${p.mcap_usd === null ? '—' : money(p.mcap_usd)}</td>
    <td class="num">${p.ratio === null ? '—' : p.ratio.toFixed(3) + '×'}</td>
    <td class="num">${p.change_7d === null ? '—' : pct(p.change_7d)}</td>
  </tr>`).join('');
}

function renderCalib() {
  $('calib').innerHTML = R.calibration.categories.map((c) => `<tr>
    <td>${esc(c.category)}</td><td class="num">${c.multiple.toFixed(3)}×</td>
    <td class="num">${c.peers}</td><td>${c.fallback ? 'whole-market median (too few peers)' : 'median of live peers'}</td>
  </tr>`).join('');
}

/** Split a farm step's trailing "Cost: … Time: …" from its action text. */
function splitStep(s) {
  const m = s.match(/^(.*?) Cost: (.*?)\. Time: (.*?)\.?$/);
  if (!m) return { text: s, cost: '', time: '' };
  return { text: m[1], cost: m[2], time: m[3] };
}

function calibEntry(r) {
  return R.calibration.categories.find((c) => c.category === (r.category || 'Uncategorised'));
}
function calibPeers(r) { return calibEntry(r)?.peers ?? 0; }
function calibFallback(r) { return calibEntry(r)?.fallback ?? true; }

function openDetail(slug) {
  const r = R.rows.find((x) => x.slug === slug);
  if (!r) return;
  const tvl = r.tvl_usd;
  const base = tvl * r.category_multiple;
  const steps = r.farm_steps.map((s) => {
    const p = splitStep(s);
    return `<li>${esc(p.text)}<br><span class="ct">Cost: ${esc(p.cost)} · Time: ${esc(p.time)}</span></li>`;
  }).join('');
  $('detail-body').innerHTML = `
    <h2>${esc(r.name)} <span class="sub">#${r.rank} · ${esc(r.slug)}</span></h2>
    <p>${esc(r.category || 'Uncategorised')} · ${r.chains.map(esc).join(', ') || 'no chain listed'} · tracked since ${esc(r.listed_at || 'unknown date')} (${ageText(r.age_days)}).
    DefiLlama's record carries no token for this protocol — that is the record, not proof it has none.</p>
    <div class="facts">
      <div><b>${money(r.implied_value_usd)}</b><span>implied launch value</span></div>
      <div><b>${money(tvl)}</b><span>TVL</span></div>
      <div><b>${pct(r.change_7d)}</b><span>TVL change, 7 days</span></div>
      <div><b>${r.category_multiple.toFixed(3)}×</b><span>category multiple</span></div>
      <div><b>${r.growth_multiplier.toFixed(2)}×</b><span>growth</span></div>
      <div><b>${r.maturity_multiplier.toFixed(2)}×</b><span>maturity</span></div>
      <div><b>${r.chain_multiplier.toFixed(2)}×</b><span>chain reach</span></div>
    </div>
    <h3>How the value is built</h3>
    <div class="breakdown">${money(tvl)} TVL × ${r.category_multiple.toFixed(3)} ${esc(r.category || 'market')} multiple × ${r.growth_multiplier.toFixed(2)} growth × ${r.maturity_multiplier.toFixed(2)} maturity × ${r.chain_multiplier.toFixed(2)} chains = <b>${money(r.implied_value_usd)}</b>
    <div class="bar" style="width:${Math.min(100, (r.implied_value_usd / R.rows[0].implied_value_usd) * 100).toFixed(1)}%"></div>
    Base ${money(base)} · the category multiple is ${calibFallback(r) ? 'the whole-market median (too few live-token peers in this category)' : `the median market-cap/TVL of ${calibPeers(r)} live-token peer${calibPeers(r) === 1 ? '' : 's'} in this category`}.</div>
    <h3>Farm plan — seven steps</h3>
    <ol class="steps">${steps}</ol>
    <p class="note">Costs are the plan's own estimates in gas and capital; they move with the chain. Never pay to claim: a real claim costs gas only, from the protocol's own page.</p>`;
  $('detail').hidden = false;
  $('detail').scrollIntoView({ behavior: 'auto', block: 'start' });
}

function closeDetail() {
  $('detail').hidden = true;
  if (location.hash.startsWith('#/protocol/')) history.replaceState(null, '', '#');
}

/** Re-rank the top 10 under the sandbox dials. */
function renderSandbox() {
  const gw = parseFloat($('sb-growth').value);
  const mw = parseFloat($('sb-mat').value);
  const cap = parseFloat($('sb-cap').value);
  $('sb-growth-v').textContent = gw.toFixed(2);
  $('sb-mat-v').textContent = mw.toFixed(2);
  $('sb-cap-v').textContent = cap.toFixed(2);
  const scored = R.rows.map((r) => {
    const growth = 1 + (Math.min(100, Math.max(-50, r.change_7d ?? 0)) / 100) * gw;
    const age = r.age_days ?? 365;
    const mat = (1 - mw) + (Math.min(Math.max(age, 0), 1095) / 1095) * mw;
    const mult = Math.min(r.category_multiple, cap);
    return { r, v: Math.max(1, Math.round(r.tvl_usd * mult * growth * mat * r.chain_multiplier)) };
  }).sort((a, b) => b.v - a.v).slice(0, 10);
  $('sb-top').innerHTML = scored.map((s, i) => `<li>#${i + 1} ${esc(s.r.name)} — ${money(s.v)} (published rank ${s.r.rank})</li>`).join('');
}

function switchTab(name) {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + name));
}

function init() {
  if (!R || !R.rows) {
    document.querySelector('main').innerHTML = '<p>data.js did not load: open this page from the built output, where data.js sits beside dashboard/.</p>';
    return;
  }
  $('meta').textContent = `Snapshot ${R.as_of} · ${R.source} · floor ${money(R.floor_usd)} · model ${R.model_version}`;
  $('src').textContent = `${R.source} (as of ${R.as_of})`;
  $('stats').innerHTML = `
    <div class="stat"><b>${R.watchlist_size}</b><span>watchlist</span></div>
    <div class="stat"><b>${R.board_size}</b><span>board rows</span></div>
    <div class="stat"><b>${R.early_size}</b><span>below the floor</span></div>
    <div class="stat"><b>${money(R.rows[0].implied_value_usd)}</b><span>top implied value</span></div>
    <div class="stat"><b>${R.live_size}</b><span>live tokens set aside</span></div>`;
  const chains = [...new Set(R.rows.flatMap((r) => r.chains))].sort();
  const cats = [...new Set(R.rows.map((r) => r.category || 'Uncategorised'))].sort();
  $('chain').innerHTML = '<option value="">All chains</option>' + chains.map((c) => `<option>${esc(c)}</option>`).join('');
  $('cat').innerHTML = '<option value="">All categories</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
  renderBoard();
  renderLive();
  renderCalib();
  renderSandbox();

  ['q', 'chain', 'cat', 'sort', 'watchonly'].forEach((id) => $(id).addEventListener('input', renderBoard));
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $('rows').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-slug]');
    if (btn) location.hash = '#/protocol/' + btn.dataset.slug;
  });
  $('detail-close').addEventListener('click', closeDetail);
  ['sb-growth', 'sb-mat', 'sb-cap'].forEach((id) => $(id).addEventListener('input', renderSandbox));
  window.addEventListener('hashchange', route);
  route();
}

/** Deep link: #/protocol/<slug> opens that protocol's detail view. */
function route() {
  const m = location.hash.match(/^#\/protocol\/(.+)$/);
  if (m) { switchTab('board'); openDetail(decodeURIComponent(m[1])); }
  else $('detail').hidden = true;
}

init();
