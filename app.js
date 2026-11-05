(() => {
  const $ = (s) => document.querySelector(s);
  const LAB = { market: {}, type: {}, status: {}, stage: {}, gran: { day: '日', week: '周', month: '月', year: '年' } };
  const MARKET_ORDER = ['SSE', 'SZSE', 'BSE', 'NEEQ'];
  const TYPE_ORDER = ['IPO', 'REFINANCE', 'MA', 'NEEQ_LISTING'];
  const STATUS_ORDER = ['ACCEPTED', 'REVIEWING', 'PASSED', 'PENDING_REG', 'REGISTERED', 'TERMINATED'];
  const STATUS_COLOR = { ACCEPTED: '#3A6EA5', REVIEWING: '#0F766E', PASSED: '#5B4BE0', PENDING_REG: '#B07A2A', REGISTERED: '#2E7D32', TERMINATED: '#A3402C' };
  const STAGE_COLORS = {
    '已受理': '#93C5FD', '已问询': '#60A5FA', '已回复': '#3B82F6', '上市委会议': '#A78BFA',
    '补充审核': '#C4B5FD', '中止及财报更新': '#FBBF24', '提交注册': '#F97316',
    '注册结果': '#34D399', '审核结果': '#10B981', '已发行': '#14B8A6',
    '已启动发行': '#F59E0B', '已上市': '#0D9488',
    '终止': '#F87171', '其他': '#CBD5E1',
  };
  const BOARD_COLORS = {
    '上交所主板': '#1D4ED8', '上交所科创板': '#8B5CF6', '深交所主板': '#0EA5E9',
    '深交所创业板': '#F59E0B', '北交所': '#10B981', '新三板': '#94A3B8',
  };
  const FLOW_DEFS = {
    accepted: { name: '新增受理', color: '#3B82F6' },
    passed: { name: '上市委会议通过', color: '#8B5CF6' },
    submit: { name: '提交注册', color: '#F59E0B' },
    registered: { name: '取得批文', color: '#10B981' },
    reviewing: { name: '期末在审', color: '#0EA5E9' },
    pendingReg: { name: '期末待注册', color: '#D97706' },
    terminated: { name: '终止审核', color: '#EF4444' },
  };
  let lastStats = null;
  const state = { gran: 'month', range: '1y', markets: [], types: [], sponsor: '', flow: 'all' };
  const tbl = { frm: '', to: '', q: '', market: '', board: '', type: '', stage: '', sponsor: '', page: 1, pageSize: 20, total: 0 };
  const charts = {};
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const num = (v) => (v == null ? 0 : Number(v)).toLocaleString('zh-CN');
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const label = (kind, key) => (LAB[kind] || {})[key] || key || '—';
  const flowKey = () => (state.flow.startsWith('stage:') ? state.flow.slice(6) : state.flow);
  const flowInfo = () => (state.flow.startsWith('stage:')
    ? { name: state.flow.slice(6), color: STAGE_COLORS[state.flow.slice(6)] || '#CBD5E1' }
    : (FLOW_DEFS[state.flow] || FLOW_DEFS.accepted));
  const flowValue = (row, key) => (key.startsWith('stage:')
    ? ((row.stages || {})[key.slice(6)] || 0)
    : (row[key] || 0));

  function stagePill(stage, raw) {
    const c = STAGE_COLORS[stage] || '#CBD5E1';
    const text = stage === '注册结果' ? '已注册' : (stage || '其他');
    return `<span class="pill" title="${esc(raw || '')}" style="color:${c};background:${c}1f;border-color:${c}55">${esc(text)}</span>`;
  }

  const STATIC = { on: false, items: [], meta: null, extras: null, profileIds: null, docIds: null };
  const slug = (id) => String(id == null ? '' : id).replace(/[^0-9A-Za-z_-]/g, '_');

  async function staticApi(path, params) {
    const p = params || {};
    if (path === '/api/meta') return STATIC.meta;
    if (path === '/api/stats') return StatEngine.compute(STATIC.items, p);
    if (path === '/api/sponsors') return StatEngine.sponsors(STATIC.items, p);
    if (path === '/api/projects') return StatEngine.query(STATIC.items, p);
    if (path === '/api/board-projects') return StatEngine.boardProjects(STATIC.items, p);
    if (path === '/api/chart-projects') return StatEngine.chartProjects(STATIC.items, p);
    const prof = path.match(/^\/api\/projects\/(.+)\/profile$/);
    if (prof) {
      const id = decodeURIComponent(prof[1]);
      const r = await fetch(`data/profiles/${slug(id)}.json`, { cache: 'no-store' });
      if (!r.ok) return { available: false, reason: '该项目的申报文件尚未收录' };
      return r.json();
    }
    const one = path.match(/^\/api\/projects\/(.+)$/);
    if (one) {
      const id = decodeURIComponent(one[1]);
      const hit = STATIC.items.find((x) => x.id === id);
      if (!hit) throw new Error('项目不存在');
      if (!STATIC.extras) {
        STATIC.extras = await fetch('data/extras.json', { cache: 'no-store' })
          .then((x) => (x.ok ? x.json() : {}))
          .catch(() => ({}));
      }
      return { ...hit, extra: STATIC.extras[id] || {} };
    }
    throw new Error('静态站点不支持该接口');
  }

  async function boot() {
    STATIC.on = document.body.dataset.static === '1';
    if (!STATIC.on) return;
    const [proj, meta, profIds, docIds] = await Promise.all([
      fetch('data/projects.json', { cache: 'no-store' }).then((x) => x.json()),
      fetch('data/meta.json', { cache: 'no-store' }).then((x) => x.json()),
      fetch('data/profiles.json', { cache: 'no-store' }).then((x) => x.json()).catch(() => []),
      fetch('data/profile_docs.json', { cache: 'no-store' }).then((x) => x.json()).catch(() => []),
    ]);
    STATIC.items = proj.items || [];
    STATIC.meta = meta;
    STATIC.profileIds = new Set(profIds || []);
    STATIC.docIds = new Set(docIds || []);
    const btn = $('#refreshBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '数据每日自动更新';
      btn.title = '本页为静态站点，数据由定时任务更新';
    }
  }

  const fullName = (p) => {
    const n = (p && p.name) || '';
    const s = ((p && p.short_name) || '').trim();
    return s && n && n !== s ? `${n}（${s}）` : n;
  };

  async function api(path, params, opts) {
    if (STATIC.on) return staticApi(path, params);
    const url = new URL(path, location.origin);
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== '' && v != null) url.searchParams.set(k, v); });
    const res = await fetch(url, opts);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) throw new Error(json.detail || `请求失败 ${res.status}`);
    return json.data;
  }

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2400);
  }

  function rangeDates() {
    const end = new Date();
    if (state.range === 'all') return { frm: '', to: '' };
    if (state.range === 'custom') {
      return { frm: $('#fromDate').value || '', to: $('#toDate').value || '' };
    }
    const days = { '1m': 30, '3m': 91, '1y': 365 }[state.range] || 365;
    const start = new Date(end.getTime() - days * 86400000);
    return { frm: fmt(start), to: fmt(end) };
  }

  function filters() {
    const r = rangeDates();
    const p = { frm: r.frm, to: r.to, markets: state.markets.join(','), types: state.types.join(',') };
    if (state.sponsor) p.sponsor = state.sponsor;
    return p;
  }

  function tblParams() {
    return {
      frm: tbl.frm, to: tbl.to, markets: tbl.market, types: tbl.type,
      board: tbl.board, stage: tbl.stage, sponsor: tbl.sponsor, q: tbl.q,
    };
  }

  /* ---------- meta / chips ---------- */
  async function loadMeta() {
    const m = await api('/api/meta');
    m.markets.forEach((x) => LAB.market[x.key] = x.label);
    m.types.forEach((x) => LAB.type[x.key] = x.label);
    m.statuses.forEach((x) => LAB.status[x.key] = x.label);
    const stageCounts = m.stageCounts || {};
    const stages = m.stages.filter((x) => (stageCounts[x.key] || 0) > 0);
    stages.forEach((x) => LAB.stage[x.key] = x.label);

    $('#marketChips').innerHTML = `<button class="chip all on" data-market="">全部</button>` +
      m.markets.map((x) => `<button class="chip" data-market="${x.key}">${esc(x.label)}</button>`).join('');
    $('#typeChips').innerHTML = `<button class="chip all on" data-type="">全部</button>` +
      m.types.map((x) => `<button class="chip" data-type="${x.key}">${esc(x.label)}</button>`).join('');
    $('#tblMarket').innerHTML = `<option value="">全部市场</option>` +
      m.markets.map((x) => `<option value="${esc(x.key)}">${esc(x.label)}</option>`).join('');
    $('#tblType').innerHTML = `<option value="">全部类型</option>` +
      m.types.map((x) => `<option value="${esc(x.key)}">${esc(x.label)}</option>`).join('');
    $('#tblStage').innerHTML = `<option value="">全部阶段</option>` +
      stages.map((x) => `<option value="${esc(x.key)}">${esc(x.label)}</option>`).join('');
    $('#tblBoard').innerHTML = `<option value="">全部板块</option>` +
      ['主板', '科创板', '创业板', '北交所', '新三板']
        .map((b) => `<option value="${b}">${b}</option>`).join('');
    $('#sponsorList').innerHTML = (m.sponsors || []).slice(0, 400).map((s) => `<option value="${esc(s)}">`).join('');

    $('#syncChips').innerHTML = (m.sync || []).map((s) => {
      const name = { sse: '上交所', szse: '深交所', bse: '北交所', neeq: '股转', ipo_issue: '发行上市' }[s.source] || s.source;
      return `<span class="s${s.ok ? '' : ' bad'}">${name} ${s.records ? `<b>${num(s.records)}</b> 条更新` : '无变化'} · ${esc((s.finished_at || '').slice(5, 16))}</span>`;
    }).join('') + `<span class="s">入库 <b>${num(m.total)}</b> 项</span>`;

    const d = new Date();
    $('#today').textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 数据截至 ${m.range && m.range.to ? m.range.to : '—'}`;
    return m;
  }

  /* ---------- main ---------- */
  let loadSeq = 0;

  async function load() {
    const seq = ++loadSeq;
    const p = filters(false);
    try {
      const [stats, passedTotal] = await Promise.all([
        api('/api/stats', { ...p, gran: state.gran }),
        api('/api/projects', { ...p, pageSize: 1 }),
      ]);
      if (seq !== loadSeq) return;
      lastStats = stats;
      renderKpi(stats);
      renderMain(stats);
      renderStatusChart(stats);
      renderBoardMix(stats);
      renderHeatmap(stats);
      renderSponsorBoard();
      state.total = passedTotal.total;
    } catch (e) { toast(e.message); }
  }

  function renderKpi(s) {
    const k = s.kpi;
    const items = [
      ['c1', '新增受理', k.accepted, '区间内首次受理'],
      ['c2', '期末在审', k.reviewing, '含受理、问询、回复、中止'],
      ['c3', '期间过会', k.passed, '上市委审议通过'],
      ['c4', '期末待注册', k.pendingReg, '过会未注册'],
      ['c5', '期间注册', k.registered, '注册生效'],
      ['c6', '期间终止', k.terminated, '终止 / 不予注册'],
    ];
    $('#kpis').innerHTML = items.map(([c, t, v, n]) =>
      `<div class="kpi ${c}"><div class="k">${t}</div><div class="v">${num(v)}</div><div class="n">${n}</div></div>`).join('');
    const note = state.flow === 'all' ? '柱：受理 / 过会 / 提交注册 / 取得批文（堆叠）' : `当前：${flowInfo().name}`;
    $('#legendNote').textContent = `${note} · ${s.from} — ${s.to} · ${num(s.projectCount)} 个有变动项目`;
  }

  const axisCommon = {
    axisLine: { lineStyle: { color: '#D8D3C7' } },
    axisTick: { show: false },
    axisLabel: { color: '#6C736B', fontSize: 11 },
    splitLine: { lineStyle: { color: '#F0EDE5' } },
  };

  function renderMain(s) {
    const labels = s.series.map((x) => x.label);
    const all = state.flow === 'all';
    const keys = all ? ['accepted', 'passed', 'submit', 'registered'] : [state.flow];
    const info = flowInfo();
    const labelStyle = {
      show: false, position: 'top', distance: 4, fontSize: 10, color: '#4B5563',
      formatter: (p) => (p.value ? num(p.value) : ''),
    };
    const series = all
      ? keys.map((key, i) => ({
          name: FLOW_DEFS[key].name, type: 'bar', stack: 'flow', barMaxWidth: 24,
          itemStyle: { color: FLOW_DEFS[key].color, borderRadius: i === keys.length - 1 ? [3, 3, 0, 0] : 0 },
          emphasis: { focus: 'series' }, label: { ...labelStyle }, cursor: 'pointer',
          data: s.series.map((x) => x[key] || 0),
        }))
      : [{
          name: info.name, type: 'line', smooth: true, symbol: 'circle', symbolSize: 5,
          lineStyle: { color: info.color, width: 2.5 },
          itemStyle: { color: info.color },
          areaStyle: { color: info.color, opacity: 0.08 },
          label: { ...labelStyle },
          cursor: 'pointer',
          data: s.series.map((x) => flowValue(x, state.flow)),
        }];
    const opt = {
      animationDuration: 500,
      grid: { left: 46, right: 18, top: all ? 46 : 24, bottom: labels.length > 30 ? 46 : 24 },
      tooltip: {
        trigger: 'item', textStyle: { fontSize: 12 }, confine: true,
        formatter: (p) => {
          const key = all ? keys[p.seriesIndex] : state.flow;
          const name = FLOW_DEFS[key] ? FLOW_DEFS[key].name : (key.startsWith('stage:') ? key.slice(6) : key);
          const row = s.series[p.dataIndex] || {};
          return `${esc(row.label || '')}<br><b>${esc(name)}</b>：${num(p.value)} 项`;
        },
      },
      legend: all ? { top: 0, left: 0, itemWidth: 9, itemHeight: 8, textStyle: { color: '#6B7280', fontSize: 11 }, data: keys.map((k) => FLOW_DEFS[k].name) } : { show: false },
      xAxis: { type: 'category', data: labels, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, hideOverlap: true, interval: labels.length > 24 ? 'auto' : 0 } },
      yAxis: { type: 'value', ...axisCommon },
      dataZoom: labels.length > 30 ? [{ type: 'inside' }, { type: 'slider', height: 14, bottom: 8, borderColor: '#E5E7EB', fillerColor: 'rgba(154,24,49,.08)', handleSize: 12 }] : [],
      series,
    };
    charts.main.setOption(opt, true);
  }

  function renderStatusChart(s) {
    const rows = s.statusBoard || [];
    const box = $('#statusChart');
    const legend = $('#statusLegend');
    if (!rows.length) {
      box.innerHTML = '<div class="mix-empty">当前筛选条件下暂无项目</div>';
      legend.innerHTML = '';
      return;
    }
    const all = ['已受理', '已问询', '已回复', '上市委会议', '补充审核', '中止及财报更新',
      '提交注册', '已发行', '其他'];
    const stages = all.filter((st) => rows.some((r) => (r.stages || {})[st]));
    box.innerHTML = rows.map((r) => {
      const st = r.stages || {};
      const total = stages.reduce((a, k) => a + (st[k] || 0), 0);
      if (!total) return '';
      const segs = stages.map((k) => {
        const v = st[k] || 0;
        if (!v) return '';
        const pct = v / total * 100;
        return `<span class="mix-seg" style="width:${pct.toFixed(3)}%;background:${STAGE_COLORS[k] || '#CBD5E1'}"`
          + ` data-market="${r.market}" data-stage="${esc(k)}" data-pct="${pct.toFixed(1)}"`
          + ` data-label="${esc(`${label('market', r.market)} · ${k}`)}" data-value="${v}"></span>`;
      }).join('');
      return `<div class="mix-row"><span class="mix-name">${esc(label('market', r.market))}</span>`
        + `<div class="mix-track">${segs}</div><span class="mix-total">${num(total)}</span></div>`;
    }).join('');
    legend.innerHTML = stages.map((k) => `<span class="ld"><i style="background:${STAGE_COLORS[k] || '#CBD5E1'}"></i>${esc(k)}</span>`).join('');
  }

  function renderBoardMix(s) {
    const block = (title, mix, basis) => {
      const items = (mix || []).filter((x) => x.value > 0);
      const total = items.reduce((a, b) => a + b.value, 0);
      if (!total) {
        return `<div class="mix-block"><div class="mix-head"><span>${title}</span><b>0<em>项</em></b></div>`
          + '<div class="mix-empty">该区间暂无相关项目</div></div>';
      }
      const color = (k) => BOARD_COLORS[k] || '#94A3B8';
      const segs = items.map((x) => {
        const pct = x.value / total * 100;
        return `<span class="mix-seg" style="width:${pct.toFixed(3)}%;background:${color(x.key)}"`
          + ` data-basis="${basis}" data-board="${esc(x.key)}" data-label="${esc(x.key)}"`
          + ` data-value="${x.value}" data-pct="${pct.toFixed(1)}"></span>`;
      }).join('');
      const chips = items.map((x) => {
        const pct = x.value / total * 100;
        return `<span class="mix-chip" data-basis="${basis}" data-board="${esc(x.key)}">`
          + `<i style="background:${color(x.key)}"></i>${esc(x.key)}<b>${num(x.value)}</b><em>${pct.toFixed(0)}%</em></span>`;
      }).join('');
      return `<div class="mix-block">
        <div class="mix-head"><span>${title}</span><b>${num(total)}<em>项</em></b></div>
        <div class="mix-bar">${segs}</div>
        <div class="mix-chips">${chips}</div>
      </div>`;
    };
    $('#boardMix').innerHTML = block('期间过会', s.passBoardMix, 'pass')
      + block('期末在审', s.reviewBoardMix, 'review');
  }

  function showMixTip(seg) {
    const t = $('#mixTip');
    if (!t) return;
    const pct = seg.dataset.pct ? ` · ${seg.dataset.pct}%` : '';
    t.innerHTML = `<b>${esc(seg.dataset.label)}</b> ${num(seg.dataset.value)} 项${pct}`;
    t.classList.add('on');
  }

  function moveMixTip(e) {
    const t = $('#mixTip');
    if (!t || !t.classList.contains('on')) return;
    const w = t.offsetWidth;
    t.style.left = `${Math.max(8, Math.min(e.clientX + 14, window.innerWidth - w - 8))}px`;
    t.style.top = `${Math.max(8, e.clientY - 36)}px`;
  }

  function hideMixTip() {
    const t = $('#mixTip');
    if (t) t.classList.remove('on');
  }

  function drawHeatChart(el, months, boards, matrix, max, color) {
    if (!el) return;
    const data = [];
    boards.forEach((b, yi) => months.forEach((m, xi) => {
      data.push({ value: [xi, yi, matrix[b][xi]], board: b, month: m });
    }));
    el.setOption({
      animationDuration: 450,
      grid: { left: 72, right: 8, top: 6, bottom: 22 },
      tooltip: { textStyle: { fontSize: 12 }, formatter: (p) => `${p.data.month}<br><b>${p.data.board}</b>：${num(p.data.value[2])} 项` },
      xAxis: {
        type: 'category', data: months.map((m) => m.slice(2)), splitArea: { show: false }, ...axisCommon,
        axisLabel: { ...axisCommon.axisLabel, interval: 1, fontSize: 9 },
      },
      yAxis: {
        type: 'category', data: boards, splitArea: { show: false }, ...axisCommon,
        axisLabel: { ...axisCommon.axisLabel, fontSize: 10 },
      },
      visualMap: { show: false, min: 0, max, inRange: { color: ['#F8FAFC', color + '66', color] } },
      series: [{
        type: 'heatmap', data, cursor: 'pointer',
        itemStyle: { borderColor: '#fff', borderWidth: 1.5 },
        emphasis: { itemStyle: { borderColor: '#9A1831', borderWidth: 1 } },
      }],
    }, true);
  }

  function renderHeatmap(s) {
    const h = s.heat;
    if (!h || !charts.heatPass || !charts.heatReg) return;
    let max = 1;
    h.boards.forEach((b) => h.months.forEach((_m, i) => {
      max = Math.max(max, h.passed[b][i], h.registered[b][i]);
    }));
    drawHeatChart(charts.heatPass, h.months, h.boards, h.passed, max, '#8B5CF6');
    drawHeatChart(charts.heatReg, h.months, h.boards, h.registered, max, '#10B981');
  }

  async function renderSponsorBoard() {
    let d;
    try { d = await api('/api/sponsors', { ...filters(false), pageSize: 30 }); } catch (e) { return; }
    const rows = d.items.filter((r) => r.passed > 0).slice(0, 12);
    if (!rows.length) { $('#sponsorBoard').innerHTML = '<div class="sb-empty">选定期间内暂无过会项目</div>'; return; }
    const max = Math.max(...rows.map((r) => r.passed), 1);
    $('#sponsorBoard').innerHTML = rows.map((r, i) => `
      <div class="sb-row" data-sponsor="${esc(r.sponsor)}">
        <span class="rk">${String(i + 1).padStart(2, '0')}</span>
        <span class="nm" title="${esc(r.sponsor)}">${esc(r.sponsor)}</span>
        <span class="num"><b>${num(r.passed)}</b></span>
        <span class="bar"><i style="width:${Math.max(4, r.passed / max * 100)}%"></i></span>
      </div>`).join('');
  }

  /* ---------- table ---------- */
  let tableSeq = 0;
  async function loadTable() {
    const seq = ++tableSeq;
    try {
      const d = await api('/api/projects', { ...tblParams(), page: tbl.page, pageSize: tbl.pageSize, sort: '-update_date' });
      if (seq !== tableSeq) return;
      const rows = d.items;
      $('#projectTable tbody').innerHTML = rows.length ? rows.map((p) => `
        <tr data-id="${esc(p.id)}">
          <td class="nm" title="${esc(fullName(p))}">${esc(fullName(p) || '—')}${p.pass_date_estimated && p.status === 'PASSED' ? ' <span style="color:#B07A2A">*</span>' : ''}</td>
          <td class="n">${esc(label('market', p.market))} · ${esc(p.board || '—')}</td>
          <td>${esc(label('type', p.type))}</td>
          <td>${stagePill(p.stage, p.status_raw)}</td>
          <td class="n">${esc(p.sponsor_short || '—')}</td>
          <td class="n">${esc(p.accept_date || '—')}</td>
          <td class="n">${esc(p.inquiry_date || '—')}</td>
          <td class="n">${esc(p.reply_date || '—')}</td>
          <td class="n">${esc(p.meeting_date || '—')}</td>
          <td class="n">${esc(p.submit_date || '—')}</td>
          <td class="n">${esc(p.register_date || '—')}</td>
          <td class="n">${esc(p.update_date || '—')}</td>
        </tr>`).join('') : `<tr><td colspan="12" class="empty">当前条件下没有项目</td></tr>`;
      $('#tableMeta').textContent = `共 ${num(d.total)} 项 · 按更新日期倒序`;
      const pages = Math.max(1, Math.ceil(d.total / tbl.pageSize));
      $('#pageInfo').textContent = `第 ${d.page} / ${pages} 页`;
      $('#prevPage').disabled = d.page <= 1;
      $('#nextPage').disabled = d.page >= pages;
      $('#prevPage').dataset.pages = pages;
      tbl.total = d.total;
    } catch (e) { toast(e.message); }
  }

  /* ---------- drawer ---------- */
  const EXTRA_LABELS = [
    ['保荐代表人', null], ['预计募集资金', ' 万元'], ['预计发行股数', ' 万股'],
    ['注册资本', ' 万元'], ['审核结果', null], ['会议届次', ' 次'],
    ['主营业务', null], ['审核意见', null], ['主要申报文件', null], ['问询回复轮次', ' 轮'],
  ];

  async function openDetail(id) {
    const p = await api(`/api/projects/${encodeURIComponent(id)}`);
    const ex = p.extra || {};
    const exItems = EXTRA_LABELS
      .map(([k, unit]) => [k, ex[k] ? `${ex[k]}${unit || ''}` : ''])
      .filter(([, v]) => v);
    const items = [
      ['市场 / 板块', `${label('market', p.market)} · ${p.board || '—'}`],
      ['项目类型', label('type', p.type)],
      ['审核阶段', p.stage || '—'],
      ['原始状态', p.status_raw || '—'],
      ['证券代码', p.code || '—'],
      ['保荐 / 主办机构', p.sponsor_short || p.sponsor || '—'],
      ['律师事务所', p.law_firm || '—'],
      ['会计师事务所', p.account_firm || '—'],
      ['所属地区', p.region || '—'],
      ['所属行业', p.industry || '—'],
      ['受理日期', p.accept_date || '—'],
      ['问询日期', p.inquiry_date || '—'],
      ['回复日期', p.reply_date || '—'],
      ['上会日期', p.meeting_date || '—'],
      ['提交注册', p.submit_date || '—'],
      ['过会日期', p.pass_date ? p.pass_date + (p.pass_date_estimated ? '（推算）' : '') : '—'],
      ['注册日期', p.register_date || '—'],
      ...(p.issue_date ? [['发行日期', p.issue_date], ['发行价', p.issue_price != null ? `${p.issue_price} 元` : '—']] : []),
      ...(p.list_date ? [['上市日期', p.list_date]] : []),
      ['终止日期', p.terminate_date || '—'],
      ...exItems,
    ];
    const evs = (p.events || []).map((e) => {
      const from = e.from_status ? label('status', e.from_status) : '';
      const to = label('status', e.to_status) || e.to_status;
      return `<div class="ev"><b>${esc(e.date)}</b> · ${from ? esc(from) + ' → ' : ''}${esc(to)}</div>`;
    }).join('');
    $('#drawerBody').innerHTML = `
      <div class="d-hero">
        <div class="eyebrow">${esc(label('market', p.market))} / ${esc(label('type', p.type))}</div>
        <h3>${esc(fullName(p))}</h3>
        <div class="meta">
          <span class="pill st-${p.status}">${esc(label('status', p.status))}</span>
          <span class="hint">最后更新 ${esc(p.update_date || '—')}</span>
        </div>
      </div>
      <div class="d-grid">${items.map(([k, v]) => `<div class="item"><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>
      <div class="d-sec">状态轨迹</div>
      ${evs ? `<div class="tl">${evs}</div>` : `<div class="empty" style="padding:8px 0">暂无状态变更记录，当前状态为首次采集结果</div>`}
      <div class="d-sec">企业资料</div>
      <button class="ghost profile-btn" id="profileOpenBtn" disabled>正在解析申报文件…</button>
      <div class="hint" id="profileSummary" style="margin-top:6px"></div>
      <div class="d-sec">来源</div>
      <div class="v" style="font-size:12px;word-break:break-all">${p.source_url ? `<a href="${esc(p.source_url)}" target="_blank" rel="noopener" style="color:#5B4BE0">${esc(p.source_url)}</a>` : '未提供公开链接'}</div>`;
    $('#drawer').classList.add('open'); $('#overlay').classList.add('on');
    loadProfile(id, fullName(p));
  }

  const BASIS_DATE_LABEL = {
    accepted: '受理', passed: '过会', submit: '提交注册', registered: '注册', terminated: '终止',
  };
  const BASIS_FIELD = {
    accepted: 'accept_date', passed: 'pass_date', submit: 'submit_date',
    registered: 'register_date', terminated: 'terminate_date',
  };

  function monthBounds(month) {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return [`${month}-01`, `${month}-${String(last).padStart(2, '0')}`];
  }

  async function openProjectsModal(opts) {
    const f = filters(false);
    const frm = opts.frm != null ? opts.frm : f.frm;
    const to = opts.to != null ? opts.to : f.to;
    const params = { ...f, basis: opts.basis, board: opts.board || '', stage: opts.stage || '', frm, to };
    if (opts.sponsor) params.sponsor = opts.sponsor;
    if (opts.markets != null) params.markets = opts.markets;
    $('#boardTitle').textContent = opts.title;
    $('#boardSub').textContent = '加载中…';
    $('#boardBody').innerHTML = '';
    $('#boardModal').classList.add('on');
    $('#overlay').classList.add('on');
    try {
      const d = await api('/api/chart-projects', params);
      const range = BASIS_FIELD[opts.basis] ? `${frm} 至 ${to}` : `截至 ${to}`;
      $('#boardSub').textContent = `${num(d.total)} 个项目 · ${range}`;
      if (!d.items.length) {
        $('#boardBody').innerHTML = '<div class="empty-state">当前条件下没有项目</div>';
        return;
      }
      const field = BASIS_FIELD[opts.basis] || 'update_date';
      const dateCol = BASIS_DATE_LABEL[opts.basis] || '更新';
      $('#boardBody').innerHTML = `<table class="data-table board-table"><thead><tr>
        <th>发行人</th><th>类型</th><th>审核阶段</th><th>保荐机构</th>
        <th class="num">受理</th><th class="num">${dateCol}</th><th class="num">注册</th>
      </tr></thead><tbody>${d.items.map((x) => `<tr data-id="${esc(x.id)}">
        <td class="name" title="${esc(fullName(x))}">${esc(fullName(x) || '—')}</td>
        <td>${esc(label('type', x.type))}</td>
        <td>${stagePill(x.stage, x.status_raw)}</td>
        <td>${esc(x.sponsor_short || '—')}</td>
        <td class="num">${esc(x.accept_date || '—')}</td>
        <td class="num">${esc(x[field] || '—')}</td>
        <td class="num">${esc(x.register_date || '—')}</td>
      </tr>`).join('')}</tbody></table>`;
    } catch (e) {
      $('#boardSub').textContent = e.message;
    }
  }

  function openBoardModal(basis, board) {
    openProjectsModal({
      title: `${basis === 'pass' ? '期间过会' : '期末在审'} · ${board}`,
      basis: basis === 'pass' ? 'passed' : 'reviewing',
      board,
    });
  }

  let profileState = { data: null, name: '' };

  async function loadProfile(id, name) {
    const btn = $('#profileOpenBtn');
    const summary = $('#profileSummary');
    if (STATIC.on && !(STATIC.profileIds || new Set()).has(id)) {
      const archived = (STATIC.docIds || new Set()).has(id);
      btn.textContent = archived ? '申报文件已归档（静态版未解析）' : '知识库未收录该项目的申报文件';
      btn.disabled = true;
      summary.textContent = archived ? '该项目申报文件已归档；静态版仅提供已解析的部分资料，本地版可即时解析。' : '';
      return;
    }
    try {
      const d = await api(`/api/projects/${encodeURIComponent(id)}/profile`);
      profileState = { data: d, name: name || '' };
      if (!d.available) {
        btn.textContent = '暂无可解析申报文件';
        btn.disabled = true;
        summary.textContent = d.reason || '';
        return;
      }
      btn.textContent = `查看企业资料（${d.sections.length} 部分）`;
      btn.disabled = false;
      btn.onclick = openProfileModal;
      summary.textContent = `来源：${d.document}`;
    } catch (e) {
      btn.textContent = '企业资料加载失败';
      btn.disabled = true;
      summary.textContent = e.message;
    }
  }

  function openProfileModal() {
    const d = profileState.data;
    if (!d || !d.available) return;
    $('#profileTitle').textContent = profileState.name;
    $('#profileSource').textContent = `${d.document} · 共 ${d.pages} 页`;
    $('#profileTabs').innerHTML = d.sections.map((sec, i) =>
      `<button class="ptab${i === 0 ? ' on' : ''}${secCount(sec) ? '' : ' empty'}" data-i="${i}">
        <span>${esc(sec.title)}</span>${secCount(sec) ? `<em class="cnt">${secCount(sec)}</em>` : ''}
      </button>`).join('');
    $('#profileTabs').querySelectorAll('.ptab').forEach((b) => {
      b.onclick = () => {
        $('#profileTabs').querySelectorAll('.ptab').forEach((x) => x.classList.toggle('on', x === b));
        renderProfileSection(d.sections[Number(b.dataset.i)]);
      };
    });
    const first = Math.max(0, d.sections.findIndex((s) => secCount(s) > 0));
    $('#profileTabs').querySelectorAll('.ptab').forEach((x, i) => x.classList.toggle('on', i === first));
    renderProfileSection(d.sections[first]);
    $('#profileModal').classList.add('on');
    $('#overlay').classList.add('on');
  }

  function secCount(sec) {
    if (!sec) return 0;
    if (sec.rows) return sec.rows.length;
    if (sec.groups) return sec.groups.length;
    if (sec.facts) return sec.facts.length;
    if (sec.summary) return 1;
    return 0;
  }

  function dataTable(columns, rows) {
    const nums = columns.map((_, i) => i > 0);
    const head = columns.map((c, i) => `<th${i > 0 ? ' class="num"' : ''}>${esc(c)}</th>`).join('');
    const body = rows.map((r) => `<tr>${r.map((v, i) => {
      const isNum = i > 0 && /^[-+]?\d[\d,]*(\.\d+)?%?$/.test(String(v));
      return `<td class="${isNum ? 'num' : (i === 0 ? 'name' : '')}">${esc(v == null || v === '' ? '—' : v)}</td>`;
    }).join('')}</tr>`).join('');
    return `<div class="table-wrap"><table class="data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function renderProfileSection(sec) {
    const el = $('#profileContent');
    if (!sec) return;
    const src = sec.doc
      ? `${sec.doc}${sec.pages && sec.pages.length ? ` 第 ${sec.pages.join('、')} 页` : ''}（巨潮资讯）`
      : (sec.pages && sec.pages.length ? `申报文件第 ${sec.pages.join('、')} 页` : '未检索到对应章节');
    let body = '';
    if (sec.unit && sec.columns && sec.rows) {
      body += `<div style="font-size:12px;color:#64748b;margin:6px 0 4px">单位：${esc(sec.unit)}</div>`;
    }
    if (sec.columns && sec.rows) {
      body += dataTable(sec.columns, sec.rows);
    }
    if (sec.groups && sec.groups.length) {
      body += sec.groups.map((g, i) => {
        const title = g.product && !g.product.startsWith('（') ? g.product : `产品组 ${i + 1}`;
        return `<div class="group-block">
        <div class="group-title">${esc(title)}</div>
        ${dataTable(sec.columns, g.rows)}</div>`;
      }).join('');
    }
    if (sec.facts && sec.facts.length) {
      body += `<div class="facts">${sec.facts.map(([k, v]) => `<div class="fact"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
    }
    if (sec.summary) {
      body += `<div class="summary-card">${esc(sec.summary)}</div>`;
    }
    if (!body) {
      body = `<div class="empty-state"><b>该申报文件未单独披露本部分内容</b>可能未在文件中设置该章节，或为摘要版本。</div>`;
    }
    el.innerHTML = `<div class="prof-head"><h3>${esc(sec.title)}</h3><span class="src">${esc(src)}</span></div>${body}`;
  }

  function closeDrawer() { $('#drawer').classList.remove('open'); $('#overlay').classList.remove('on'); }

  function csvCell(v) {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportCsvStatic(p) {
    const rows = StatEngine.filterRows(STATIC.items, { ...p, page: 1, pageSize: 5000 });
    const head = ['发行人', '市场', '板块', '类型', '审核状态', '状态阶段', '保荐机构', '受理日期',
      '问询日期', '回复日期', '上会日期', '提交注册', '过会日期', '注册日期',
      '发行日期', '发行价', '上市日期', '终止日期', '更新日期'];
    const lines = [head.join(',')];
    rows.forEach((x) => {
      lines.push([fullName(x), label('market', x.market), x.board, label('type', x.type),
        label('status', x.status), x.stage || '', x.sponsor_short, x.accept_date, x.inquiry_date,
        x.reply_date, x.meeting_date, x.submit_date, x.pass_date, x.register_date,
        x.issue_date, x.issue_price, x.list_date,
        x.terminate_date, x.update_date].map(csvCell).join(','));
    });
    const blob = new Blob([`\ufeff${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'review_projects.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- events ---------- */
  function bind() {
    $('#granSeg').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      state.gran = b.dataset.v;
      [...$('#granSeg').children].forEach((x) => x.classList.toggle('on', x === b));
      load();
    });
    $('#flowSel').addEventListener('change', (e) => {
      state.flow = e.target.value;
      if (!lastStats) return;
      renderMain(lastStats);
      const note = state.flow === 'all' ? '柱：受理 / 过会 / 提交注册 / 取得批文（堆叠）' : `当前：${flowInfo().name}`;
      $('#legendNote').textContent = `${note} · ${lastStats.from} — ${lastStats.to} · ${num(lastStats.projectCount)} 个有变动项目`;
    });
    $('#rangeSeg').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      state.range = b.dataset.v;
      [...$('#rangeSeg').children].forEach((x) => x.classList.toggle('on', x === b));
      $('#customDates').classList.toggle('hidden', state.range !== 'custom');
      if (state.range !== 'custom') { state.page = 1; load(); }
      else if ($('#fromDate').value && $('#toDate').value) { state.page = 1; load(); }
    });
    ['#fromDate', '#toDate'].forEach((id) => $(id).addEventListener('change', () => { if (state.range === 'custom') { state.page = 1; load(); } }));
    $('#marketChips').addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      const v = b.dataset.market;
      if (!v) state.markets = [];
      else state.markets = state.markets.includes(v) ? state.markets.filter((x) => x !== v) : [...state.markets, v];
      [...$('#marketChips').children].forEach((x) => x.classList.toggle('on', !x.dataset.market ? !state.markets.length : state.markets.includes(x.dataset.market)));
      state.page = 1; load();
    });
    $('#typeChips').addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      const v = b.dataset.type;
      if (!v) state.types = [];
      else state.types = state.types.includes(v) ? state.types.filter((x) => x !== v) : [...state.types, v];
      [...$('#typeChips').children].forEach((x) => x.classList.toggle('on', !x.dataset.type ? !state.types.length : state.types.includes(x.dataset.type)));
      state.page = 1; load();
    });
    const tblReload = () => { tbl.page = 1; loadTable(); };
    let tblQTimer;
    $('#tblQ').addEventListener('input', (e) => {
      clearTimeout(tblQTimer);
      tblQTimer = setTimeout(() => { tbl.q = e.target.value.trim(); tblReload(); }, 400);
    });
    let tblSpTimer;
    $('#tblSponsor').addEventListener('input', (e) => {
      clearTimeout(tblSpTimer);
      tblSpTimer = setTimeout(() => { tbl.sponsor = e.target.value.trim(); tblReload(); }, 400);
    });
    [['#tblMarket', 'market'], ['#tblType', 'type'], ['#tblStage', 'stage'], ['#tblBoard', 'board']]
      .forEach(([sel, key]) => {
        $(sel).addEventListener('change', (e) => { tbl[key] = e.target.value; tblReload(); });
      });
    [['#tblFrom', 'frm'], ['#tblTo', 'to']].forEach(([sel, key]) => {
      $(sel).addEventListener('change', (e) => { tbl[key] = e.target.value; tblReload(); });
    });
    $('#tblReset').addEventListener('click', () => {
      Object.assign(tbl, { frm: '', to: '', q: '', market: '', board: '', type: '', stage: '', sponsor: '', page: 1 });
      ['#tblQ', '#tblSponsor', '#tblFrom', '#tblTo'].forEach((s) => { $(s).value = ''; });
      ['#tblMarket', '#tblBoard', '#tblType', '#tblStage'].forEach((s) => { $(s).value = ''; });
      loadTable();
    });
    $('#pageSizeSel').addEventListener('change', (e) => { tbl.pageSize = Number(e.target.value); tblReload(); });
    let sponsorTimer;
    $('#sponsorInput').addEventListener('input', (e) => {
      clearTimeout(sponsorTimer);
      sponsorTimer = setTimeout(() => { state.sponsor = e.target.value.trim(); state.page = 1; load(); }, 500);
    });
    $('#sponsorBoard').addEventListener('click', (e) => {
      const row = e.target.closest('.sb-row'); if (!row) return;
      const s = row.dataset.sponsor;
      openProjectsModal({ title: `${s} · 过会项目`, basis: 'passed', sponsor: s })
        .catch((x) => toast(x.message));
    });
    ['#statusChart', '#boardMix'].forEach((sel) => {
      const box = $(sel);
      if (!box) return;
      box.addEventListener('mouseover', (e) => {
        const seg = e.target.closest('.mix-seg');
        if (seg) showMixTip(seg);
      });
      box.addEventListener('mousemove', moveMixTip);
      box.addEventListener('mouseleave', hideMixTip);
    });
    $('#statusChart').addEventListener('click', (e) => {
      const seg = e.target.closest('.mix-seg[data-stage]');
      if (!seg) return;
      openProjectsModal({
        title: `${label('market', seg.dataset.market)} · ${seg.dataset.stage}`,
        basis: 'stage', stage: seg.dataset.stage, markets: seg.dataset.market,
      });
    });
    $('#boardMix').addEventListener('click', (e) => {
      const node = e.target.closest('[data-board]');
      if (node) openBoardModal(node.dataset.basis, node.dataset.board);
    });
    $('#projectTable').addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]'); if (tr) openDetail(tr.dataset.id).catch((x) => toast(x.message));
    });
    $('#profileClose').addEventListener('click', () => { $('#profileModal').classList.remove('on'); if (!$('#drawer').classList.contains('open')) $('#overlay').classList.remove('on'); });
    $('#boardClose').addEventListener('click', () => { $('#boardModal').classList.remove('on'); if (!$('#drawer').classList.contains('open')) $('#overlay').classList.remove('on'); });
    $('#boardBody').addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      $('#boardModal').classList.remove('on');
      openDetail(tr.dataset.id).catch((x) => toast(x.message));
    });
    $('#drawerClose').addEventListener('click', closeDrawer);
    $('#overlay').addEventListener('click', () => { closeDrawer(); $('#profileModal').classList.remove('on'); $('#boardModal').classList.remove('on'); $('#overlay').classList.remove('on'); });
    $('#prevPage').addEventListener('click', () => { if (tbl.page > 1) { tbl.page--; loadTable(); } });
    $('#nextPage').addEventListener('click', () => {
      const pages = Number($('#prevPage').dataset.pages || 1);
      if (tbl.page < pages) { tbl.page++; loadTable(); }
    });
    const jumpToPage = () => {
      const pages = Number($('#prevPage').dataset.pages || 1);
      const n = Math.max(1, Math.min(pages, Number($('#jumpPage').value) || 1));
      $('#jumpPage').value = n; tbl.page = n; loadTable();
    };
    $('#jumpBtn').addEventListener('click', jumpToPage);
    $('#jumpPage').addEventListener('keydown', (e) => { if (e.key === 'Enter') jumpToPage(); });
    $('#exportBtn').addEventListener('click', () => {
      const p = tblParams();
      if (STATIC.on) { exportCsvStatic(p); return; }
      const u = new URL('/api/export', location.origin);
      Object.entries(p).forEach(([k, v]) => { if (v) u.searchParams.set(k, v); });
      location.href = u.toString();
    });
    $('#refreshBtn').addEventListener('click', async () => {
      $('#refreshBtn').disabled = true; $('#refreshBtn').textContent = '同步中…';
      try {
        const r = await api('/api/sync', null, { method: 'POST' });
        if (!r.started) toast(r.message || '已有同步任务在运行');
        const poll = setInterval(async () => {
          try {
            const st = await api('/api/sync/status');
            if (!st.active) {
              clearInterval(poll);
              $('#refreshBtn').disabled = false; $('#refreshBtn').textContent = '刷新数据';
              await loadMeta(); await load();
              toast('数据同步完成');
            }
          } catch (e) { clearInterval(poll); $('#refreshBtn').disabled = false; $('#refreshBtn').textContent = '刷新数据'; }
        }, 2000);
      } catch (e) {
        $('#refreshBtn').disabled = false; $('#refreshBtn').textContent = '刷新数据'; toast(e.message);
      }
    });
    window.addEventListener('resize', () => Object.values(charts).forEach((c) => c.resize()));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeDrawer(); $('#profileModal').classList.remove('on'); $('#boardModal').classList.remove('on'); $('#overlay').classList.remove('on'); }
    });
  }

  async function init() {
    charts.main = echarts.init($('#mainChart'));
    let labelSeries = -1;
    const toggleMainLabels = (idx) => {
      if (idx === labelSeries) return;
      labelSeries = idx;
      const opt = charts.main.getOption();
      const count = (opt.series || []).length;
      const n = ((opt.xAxis && opt.xAxis[0] && opt.xAxis[0].data) || []).length;
      const show = idx >= 0 && n <= 40;
      charts.main.setOption({
        series: Array.from({ length: count }, (_v, i) => ({ label: { show: show && i === idx } })),
      });
    };
    charts.main.on('mouseover', (p) => {
      if (p && p.componentType === 'series') toggleMainLabels(p.seriesIndex);
    });
    charts.main.on('globalout', () => toggleMainLabels(-1));
    charts.heatPass = echarts.init($('#heatPassChart'));
    charts.heatReg = echarts.init($('#heatRegChart'));
    charts.main.on('click', (p) => {
      if (!lastStats || !p || p.componentType !== 'series') return;
      const key = state.flow === 'all' ? ['accepted', 'passed', 'submit', 'registered'][p.seriesIndex] : state.flow;
      const b = lastStats.series[p.dataIndex];
      if (!b || !key) return;
      const names = {
        accepted: '新增受理', passed: '上市委会议通过', submit: '提交注册',
        registered: '取得批文', reviewing: '期末在审', pendingReg: '期末待注册', terminated: '终止审核',
      };
      if (key.startsWith('stage:')) {
        openProjectsModal({ title: `期末 · ${key.slice(6)} · ${b.label}`, basis: 'stage', stage: key.slice(6), frm: b.start, to: b.end });
      } else {
        openProjectsModal({ title: `${names[key] || key} · ${b.label}`, basis: key, frm: b.start, to: b.end });
      }
    });
    charts.heatPass.on('click', (p) => {
      if (!p.data || !p.data.month) return;
      const [frm, to] = monthBounds(p.data.month);
      openProjectsModal({
        title: `上市委会议通过 · ${p.data.board} · ${p.data.month}`,
        basis: 'passed', board: p.data.board, frm, to,
      });
    });
    charts.heatReg.on('click', (p) => {
      if (!p.data || !p.data.month) return;
      const [frm, to] = monthBounds(p.data.month);
      openProjectsModal({
        title: `取得批文 · ${p.data.board} · ${p.data.month}`,
        basis: 'registered', board: p.data.board, frm, to,
      });
    });
    bind();
    try { await boot(); await loadMeta(); await load(); await loadTable(); } catch (e) { toast(e.message); }
  }

  init();
})();
