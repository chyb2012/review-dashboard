/* 债券项目审核动态看板 */
(function () {
  'use strict';

  var DATA = window.__BOND_DATA__ || [];
  var $ = function (id) { return document.getElementById(id); };
  var num = function (v) { return Number(v || 0).toLocaleString('zh-CN'); };

  var MARKET = { SSE: '上交所', SZSE: '深交所', BSE: '北交所' };
  var STATUS = {
    ACCEPTED: '已受理', REVIEWING: '审核中', PASSED: '已通过',
    PENDING_REG: '提交注册', REGISTERED: '注册生效',
    TERMINATED: '终止/未通过', OTHER: '其他'
  };
  var STATUS_COLOR = {
    ACCEPTED: '#9A1831', REVIEWING: '#2563EB', PASSED: '#D97706',
    PENDING_REG: '#0891B2', REGISTERED: '#059669', TERMINATED: '#9CA3AF', OTHER: '#CBD5E1'
  };
  var MARKET_COLOR = { SSE: '#9A1831', SZSE: '#2563EB', BSE: '#059669' };
  var TYPE_COLOR = ['#9A1831', '#2563EB', '#059669', '#D97706', '#7C3AED', '#0891B2', '#9CA3AF'];

  var axis = {
    axisLabel: { color: '#6B7280', fontSize: 10 },
    axisLine: { lineStyle: { color: '#E5E7EB' } },
    axisTick: { show: false }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function parseDay(s) {
    var p = String(s || '').split('-');
    return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null;
  }
  function weekStart(d) {
    var t = new Date(d.getTime());
    t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    return t;
  }
  function weekKey(s) {
    var d = parseDay(s);
    if (!d) return '';
    var ws = weekStart(d);
    // ISO 周：以该周周四所在年份为周年
    var thu = new Date(ws.getTime() + 3 * 864e5);
    var jan1 = new Date(thu.getFullYear(), 0, 1);
    var week = Math.floor((thu - jan1) / 864e5 / 7) + 1;
    return thu.getFullYear() + '-W' + pad2(week);
  }
  function tickOf(s, gran) {
    if (!s) return '';
    if (gran === 'day') return s;
    if (gran === 'week') {
      var d = parseDay(s);
      return d ? ymd(weekStart(d)) : '';
    }
    return s.slice(0, 7);
  }
  function shortTick(v, gran) {
    if (!v) return v;
    if (gran === 'month') return v.slice(2);
    return v.slice(5);
  }

  /* ---------- 筛选状态 ---------- */
  var state = {
    q: '', market: '', type: '', status: '',
    gran: '', period: '',
    page: 1, per: 20
  };
  var trendGran = 'month';

  function timeFilter(r) {
    if (!state.gran || !state.period) return true;
    var d = r[9] || '';
    if (!d) return false;
    if (state.gran === 'day') return d === state.period;
    if (state.gran === 'week') return weekKey(d) === state.period;
    return d.slice(0, 7) === state.period;
  }

  function baseRows() {
    return DATA.filter(function (r) {
      if (state.market && r[1] !== state.market) return false;
      if (state.type && r[2] !== state.type) return false;
      if (state.status && r[6] !== state.status) return false;
      if (!timeFilter(r)) return false;
      var q = state.q.trim().toLowerCase();
      if (q && (r[3] + ' ' + r[4] + ' ' + r[8]).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  /* ---------- KPI ---------- */
  function renderKpi(rows) {
    var counts = {};
    var markets = {};
    var scale = 0;
    var latest = '';
    rows.forEach(function (r) {
      counts[r[6]] = (counts[r[6]] || 0) + 1;
      markets[r[1]] = (markets[r[1]] || 0) + 1;
      scale += r[5] || 0;
      if (r[10] && r[10] > latest) latest = r[10];
    });
    var total = rows.length;
    var review = (counts.ACCEPTED || 0) + (counts.REVIEWING || 0);
    var pct = function (v) { return total ? (v / total * 100).toFixed(1) + '%' : '0%'; };

    $('kTotal').textContent = num(total);
    $('kTotalSub').textContent = '亿元规模 ' + num(Math.round(scale)) + ' 亿';
    $('kReview').textContent = num(review);
    $('kReviewSub').textContent = '占 ' + pct(review);
    $('kPassed').textContent = num(counts.PASSED || 0);
    $('kPassedSub').textContent = '占 ' + pct(counts.PASSED || 0);
    $('kSubmit').textContent = num(counts.PENDING_REG || 0);
    $('kSubmitSub').textContent = '占 ' + pct(counts.PENDING_REG || 0);
    $('kReg').textContent = num(counts.REGISTERED || 0);
    $('kRegSub').textContent = '占 ' + pct(counts.REGISTERED || 0);
    $('kTerm').textContent = num(counts.TERMINATED || 0);
    $('kTermSub').textContent = '占 ' + pct(counts.TERMINATED || 0);

    $('stampDate').textContent = latest || '—';
    $('stampScope').textContent = Object.keys(markets).map(function (k) { return MARKET[k] || k; }).join(' · ') || '—';
    $('ovNote').textContent = (state.gran ? '当前筛选 ' : '全量 ') + num(total) +
      ' 个项目 · 以各交易所公示的最新状态统计';
  }

  /* ---------- 图表 ---------- */
  var charts = {};

  function initChart(id) {
    var el = $(id);
    if (!el) return null;
    if (!charts[id]) charts[id] = echarts.init(el, null, { renderer: 'svg' });
    return charts[id];
  }

  function rankBy(rows, idx) {
    var m = {};
    rows.forEach(function (r) { var k = r[idx]; if (k) m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).map(function (k) { return { name: k, value: m[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  function drawPie(id, rows, colorFn) {
    var chart = initChart(id);
    if (!chart) return;
    chart.setOption({
      animation: false,
      textStyle: { fontSize: 11, color: '#6B7280' },
      tooltip: { trigger: 'item', appendToBody: true, formatter: '{b}<br/>{c} 个（{d}%）' },
      legend: { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11, color: '#6B7280' } },
      series: [{
        type: 'pie', radius: ['48%', '70%'], center: ['50%', '44%'],
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
        label: { show: false }, labelLine: { show: false },
        data: rows.length ? rows.map(function (x, i) {
          return { name: x.name, value: x.value, itemStyle: { color: colorFn(x, i) } };
        }) : [{ name: '暂无数据', value: 1, itemStyle: { color: '#EEF0F3' } }]
      }]
    }, true);
  }

  function drawStatus(rows) {
    var chart = initChart('chartStatus');
    if (!chart) return;
    var stRows = rankBy(rows, 6);
    var el = $('chartStatus');
    el.style.height = Math.max(260, stRows.length * 34 + 40) + 'px';
    chart.resize();
    chart.setOption({
      animation: false,
      textStyle: { fontSize: 11, color: '#6B7280' },
      grid: { left: 92, right: 56, top: 8, bottom: 20 },
      tooltip: { trigger: 'item', appendToBody: true, formatter: '{b}<br/>{c} 个' },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: '#F0F1F3' } }, axisLabel: axis.axisLabel, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: {
        type: 'category', data: stRows.map(function (x) { return STATUS[x.name] || x.name; }),
        axisLabel: { color: '#111827', fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false }
      },
      series: [{
        type: 'bar', data: stRows.map(function (x) { return x.value; }), barWidth: '52%',
        showBackground: true, backgroundStyle: { color: '#F4F5F7', borderRadius: 3 },
        itemStyle: {
          borderRadius: 3,
          color: function (p) { return STATUS_COLOR[stRows[p.dataIndex].name] || '#9CA3AF'; }
        },
        label: { show: true, position: 'right', color: '#111827', fontSize: 10, fontWeight: 600 }
      }]
    }, true);
  }

  function drawTrend(rows) {
    var chart = initChart('chartTrend');
    if (!chart) return;
    var count = {};
    rows.forEach(function (r) {
      var k = tickOf(r[9], trendGran);
      if (k) count[k] = (count[k] || 0) + 1;
    });
    var ticks = Object.keys(count).sort();
    if (trendGran === 'month' && ticks.length > 36) ticks = ticks.slice(-36);
    var zoom = ticks.length > 40;
    chart.setOption({
      animation: false,
      textStyle: { fontSize: 11, color: '#6B7280' },
      grid: { left: 40, right: 14, top: 22, bottom: zoom ? 58 : 46 },
      tooltip: { trigger: 'axis', appendToBody: true, formatter: '{b}<br/>{c} 个' },
      dataZoom: zoom ? [
        { type: 'inside', start: ticks.length > 120 ? 70 : 0, end: 100 },
        { type: 'slider', height: 14, bottom: 8, borderColor: '#E5E7EB',
          fillerColor: 'rgba(154,24,31,.08)', handleSize: 12, showDetail: false }
      ] : [],
      xAxis: {
        type: 'category', data: ticks,
        axisLabel: {
          color: '#6B7280', fontSize: 9, rotate: 45, hideOverlap: true,
          formatter: function (v) { return shortTick(v, trendGran); }
        },
        axisLine: axis.axisLine, axisTick: { show: false }
      },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#F0F1F3' } }, axisLabel: axis.axisLabel, axisLine: { show: false }, axisTick: { show: false } },
      series: [{
        type: 'bar', data: ticks.map(function (m) { return count[m]; }), barWidth: '62%',
        itemStyle: {
          borderRadius: [3, 3, 0, 0],
          color: function (p) {
            var t = ticks.length > 1 ? p.dataIndex / (ticks.length - 1) : 1;
            return p.dataIndex === ticks.length - 1 ? '#D97706' : (t > 0.5 ? '#B32B4A' : '#9A1831');
          }
        }
      }]
    }, true);
  }

  function renderCharts(rows) {
    drawPie('chartMarket',
      rankBy(rows, 1).map(function (x) { return { name: MARKET[x.name] || x.name, value: x.value, key: x.name }; }),
      function (x) { return MARKET_COLOR[x.key || ''] || '#9CA3AF'; });
    drawPie('chartType', rankBy(rows, 2), function (x, i) { return TYPE_COLOR[i % TYPE_COLOR.length]; });
    drawStatus(rows);
    drawTrend(rows);
  }

  /* ---------- 明细表 ---------- */
  function opt(v, t) { var o = document.createElement('option'); o.value = v; o.textContent = t; return o; }

  function initSelects() {
    var typeVals = {}, statusVals = {}, marketVals = {};
    DATA.forEach(function (r) {
      if (r[2]) typeVals[r[2]] = 1;
      if (r[6]) statusVals[r[6]] = 1;
      if (r[1]) marketVals[r[1]] = 1;
    });
    Object.keys(MARKET).forEach(function (k) { if (marketVals[k]) $('fMarket').appendChild(opt(k, MARKET[k])); });
    Object.keys(typeVals).sort().forEach(function (k) { $('fType').appendChild(opt(k, k)); });
    Object.keys(STATUS).forEach(function (k) {
      if (statusVals[k]) $('fStatus').appendChild(opt(k, STATUS[k]));
    });
  }

  function renderTable(rows) {
    var totalRows = rows.length;
    var pages = Math.max(1, Math.ceil(totalRows / state.per));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * state.per;
    var page = rows.slice(start, start + state.per);
    $('cnt').textContent = num(totalRows);

    $('tbody').innerHTML = page.length ? page.map(function (r) {
      var st = r[6] || 'OTHER';
      return '<tr>' +
        '<td>' + esc(MARKET[r[1]] || r[1]) + '</td>' +
        '<td class="t-name" title="' + esc(r[4]) + '">' + esc(r[4]) + '</td>' +
        '<td class="t-iss" title="' + esc(r[3]) + '">' + (r[3] ? esc(r[3]) : '—') + '</td>' +
        '<td>' + esc(r[2] || '—') + '</td>' +
        '<td class="num">' + (r[5] == null ? '—' : num(r[5])) + '</td>' +
        '<td><span class="tag ' + st + '">' + esc(STATUS[st] || r[7] || st) + '</span></td>' +
        '<td class="t-iss" title="' + esc(r[8]) + '">' + (r[8] ? esc(r[8]) : '—') + '</td>' +
        '<td class="num">' + esc(r[9] || '—') + '</td>' +
        '<td class="num">' + esc(r[10] || '—') + '</td>' +
        '</tr>';
    }).join('') : '<tr><td colspan="9" style="text-align:center;padding:40px;color:#6B7280">没有符合条件的项目</td></tr>';

    var btns = ['<span class="info">第 ' + state.page + ' / ' + pages + ' 页</span>'];
    btns.push('<button data-p="1"' + (state.page === 1 ? ' disabled' : '') + '>首页</button>');
    btns.push('<button data-p="' + (state.page - 1) + '"' + (state.page === 1 ? ' disabled' : '') + '>‹</button>');
    var from = Math.max(1, state.page - 3), to = Math.min(pages, from + 6);
    if (to - from < 6) from = Math.max(1, to - 6);
    for (var p = from; p <= to; p++) {
      btns.push('<button data-p="' + p + '" class="' + (p === state.page ? 'active' : '') + '">' + p + '</button>');
    }
    btns.push('<button data-p="' + (state.page + 1) + '"' + (state.page === pages ? ' disabled' : '') + '>›</button>');
    btns.push('<button data-p="' + pages + '"' + (state.page === pages ? ' disabled' : '') + '>末页</button>');
    $('pager').innerHTML = btns.join('');
  }

  function renderAll() {
    var rows = baseRows();
    renderKpi(rows);
    renderCharts(rows);
    renderTable(rows);
  }

  /* ---------- 时间筛选控件 ---------- */
  function syncPeriodInput() {
    var el = $('fPeriod');
    var g = state.gran;
    if (!g) {
      el.value = '';
      el.disabled = true;
      el.removeAttribute('min');
      el.removeAttribute('max');
      state.period = '';
      return;
    }
    el.disabled = false;
    // 切换 input type 前清掉旧格式的 min/max，避免浏览器忽略或误判区间
    el.removeAttribute('min');
    el.removeAttribute('max');
    el.type = g === 'day' ? 'date' : (g === 'week' ? 'week' : 'month');
    var days = DATA.map(function (r) { return r[9]; }).filter(function (d) { return d && d.length === 10; }).sort();
    if (!el.value) {
      var last = days[days.length - 1] || '';
      el.value = g === 'month' ? last.slice(0, 7) : (g === 'week' ? weekKey(last) : last);
    }
    if (g === 'month' && days.length) {
      el.min = days[0].slice(0, 7);
      el.max = days[days.length - 1].slice(0, 7);
    }
    state.period = el.value;
  }

  function bind() {
    var timer;
    $('q').addEventListener('input', function (e) {
      clearTimeout(timer);
      var v = e.target.value;
      timer = setTimeout(function () { state.q = v; state.page = 1; renderAll(); }, 160);
    });
    $('fMarket').addEventListener('change', function (e) { state.market = e.target.value; state.page = 1; renderAll(); });
    $('fType').addEventListener('change', function (e) { state.type = e.target.value; state.page = 1; renderAll(); });
    $('fStatus').addEventListener('change', function (e) { state.status = e.target.value; state.page = 1; renderAll(); });
    $('fGran').addEventListener('change', function (e) {
      state.gran = e.target.value;
      state.page = 1;
      syncPeriodInput();
      renderAll();
    });
    $('fPeriod').addEventListener('change', function (e) {
      state.period = e.target.value;
      state.page = 1;
      renderAll();
    });
    $('pager').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      var p = Number(b.dataset.p);
      if (!p) return;
      state.page = p;
      renderTable(baseRows());
      document.querySelector('.table-wrap').scrollTop = 0;
    });
    var tg = $('trendGran');
    if (tg) {
      tg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-gran]');
        if (!b) return;
        Array.prototype.forEach.call(tg.querySelectorAll('button'), function (x) {
          x.classList.toggle('on', x === b);
        });
        trendGran = b.dataset.gran;
        drawTrend(baseRows());
      });
    }
  }

  initSelects();
  bind();
  renderAll();

  window.addEventListener('resize', function () {
    Object.keys(charts).forEach(function (k) { charts[k].resize(); });
  });

  /* ---------- 证监会每周受理申请 ---------- */
  var APPLY = window.__BOND_APPLY__ || [];
  if ($('applyBody')) {
    $('applyBody').innerHTML = APPLY.length ? APPLY.map(function (r) {
      return '<tr>' +
        '<td class="num">' + esc(r[0] || '—') + '</td>' +
        '<td>' + esc(MARKET[r[1]] || r[1]) + '</td>' +
        '<td class="t-name" title="' + esc(r[2]) + '">' + esc(r[2]) + '</td>' +
        '<td>' + esc(r[3] || '—') + '</td>' +
        '<td>' + esc(r[4] || '—') + '</td>' +
        '<td class="t-iss" title="' + esc(r[5]) + '">' + esc(r[5] || '—') + '</td>' +
        '<td class="t-iss" title="' + esc(r[7]) + '">' + esc(r[7] || '—') + '</td>' +
        '<td class="t-iss" title="' + esc(r[8]) + '">' + esc(r[8] || '—') + '</td>' +
        '</tr>';
    }).join('') : '<tr><td colspan="8" style="text-align:center;padding:30px;color:#6B7280">暂无数据</td></tr>';
    var snaps = {};
    APPLY.forEach(function (r) { if (r[0]) snaps[r[0]] = 1; });
    $('applyNote').textContent = '共 ' + num(APPLY.length) + ' 家 · ' +
      Object.keys(snaps).length + ' 期公示（截至 ' + (Object.keys(snaps).sort().pop() || '—') + '）';
  }

  /* ---------- 证监会债券注册批复与审核公告 ---------- */
  var NOTICES = window.__BOND_NOTICES__ || [];
  var KIND = { reg: '注册批复', process: '审核流程', notice: '其他公告' };
  var nState = { q: '', kind: '', page: 1, per: 20 };

  function nFiltered() {
    var q = nState.q.trim().toLowerCase();
    return NOTICES.filter(function (r) {
      if (nState.kind && r[2] !== nState.kind) return false;
      if (q && String(r[1] || '').toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  function nRender() {
    var rows = nFiltered();
    var totalRows = rows.length;
    var pages = Math.max(1, Math.ceil(totalRows / nState.per));
    if (nState.page > pages) nState.page = pages;
    var start = (nState.page - 1) * nState.per;
    $('nCnt').textContent = num(totalRows);
    $('noticeBody').innerHTML = rows.length ? rows.slice(start, start + nState.per).map(function (r) {
      var att = r[4] ? '<a href="' + esc(r[4]) + '" target="_blank" rel="noopener">' +
        (r[3] === 'zip' ? 'ZIP 下载' : (r[3] === 'pdf' ? 'PDF 查看' : '附件')) + '</a>' : '—';
      return '<tr>' +
        '<td class="num">' + esc(r[0] || '—') + '</td>' +
        '<td>' + esc(KIND[r[2]] || r[2]) + '</td>' +
        '<td class="t-name" title="' + esc(r[1]) + '">' + esc(r[1]) + '</td>' +
        '<td>' + att + '</td>' +
        '<td><a class="t-link" href="' + esc(r[5]) + '" target="_blank" rel="noopener">原文</a></td>' +
        '</tr>';
    }).join('') : '<tr><td colspan="5" style="text-align:center;padding:30px;color:#6B7280">没有符合条件的公告</td></tr>';

    var btns = ['<span class="info">第 ' + nState.page + ' / ' + pages + ' 页</span>'];
    btns.push('<button data-p="1"' + (nState.page === 1 ? ' disabled' : '') + '>首页</button>');
    btns.push('<button data-p="' + (nState.page - 1) + '"' + (nState.page === 1 ? ' disabled' : '') + '>‹</button>');
    var from = Math.max(1, nState.page - 3), to = Math.min(pages, from + 6);
    if (to - from < 6) from = Math.max(1, to - 6);
    for (var p = from; p <= to; p++) {
      btns.push('<button data-p="' + p + '" class="' + (p === nState.page ? 'active' : '') + '">' + p + '</button>');
    }
    btns.push('<button data-p="' + (nState.page + 1) + '"' + (nState.page === pages ? ' disabled' : '') + '>›</button>');
    btns.push('<button data-p="' + pages + '"' + (nState.page === pages ? ' disabled' : '') + '>末页</button>');
    $('nPager').innerHTML = btns.join('');
  }

  if ($('noticeBody')) {
    var nTimer;
    $('nq').addEventListener('input', function (e) {
      clearTimeout(nTimer);
      var v = e.target.value;
      nTimer = setTimeout(function () { nState.q = v; nState.page = 1; nRender(); }, 160);
    });
    $('nKind').addEventListener('change', function (e) {
      nState.kind = e.target.value; nState.page = 1; nRender();
    });
    $('nPager').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      var p = Number(b.dataset.p);
      if (!p) return;
      nState.page = p;
      nRender();
    });
    var dates = NOTICES.map(function (r) { return r[0]; }).filter(Boolean).sort();
    $('noticeNote').textContent = '共 ' + num(NOTICES.length) + ' 条 · 证监会「债券监管」主题 · 最早 ' +
      (dates[0] || '—');
    nRender();
  }
})();
