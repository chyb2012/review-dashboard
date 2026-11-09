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

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- KPI ---------- */
  var counts = {};
  var total = DATA.length;
  var latest = '';
  var markets = {};
  DATA.forEach(function (r) {
    counts[r[6]] = (counts[r[6]] || 0) + 1;
    markets[r[1]] = (markets[r[1]] || 0) + 1;
    if (r[10] && r[10] > latest) latest = r[10];
  });
  var review = (counts.ACCEPTED || 0) + (counts.REVIEWING || 0);
  var pct = function (v) { return total ? (v / total * 100).toFixed(1) + '%' : '0%'; };

  $('kTotal').textContent = num(total);
  $('kTotalSub').textContent = '亿元规模 ' + num(Math.round(DATA.reduce(function (a, r) { return a + (r[5] || 0); }, 0))) + ' 亿';
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
  $('stampScope').textContent = Object.keys(markets).map(function (k) { return MARKET[k] || k; }).join(' · ');
  $('ovNote').textContent = '全量 ' + num(total) + ' 个项目 · 以各交易所公示的最新状态统计';

  /* ---------- 图表 ---------- */
  var axis = {
    axisLabel: { color: '#6B7280', fontSize: 10 },
    axisLine: { lineStyle: { color: '#E5E7EB' } },
    axisTick: { show: false }
  };

  function pie(id, rows, colorFn) {
    var el = $(id);
    if (!el) return;
    var chart = echarts.init(el, null, { renderer: 'svg' });
    chart.setOption({
      animation: false,
      textStyle: { fontSize: 11, color: '#6B7280' },
      tooltip: { trigger: 'item', appendToBody: true, formatter: '{b}<br/>{c} 个（{d}%）' },
      legend: { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11, color: '#6B7280' } },
      series: [{
        type: 'pie', radius: ['48%', '70%'], center: ['50%', '44%'],
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
        label: { show: false }, labelLine: { show: false },
        data: rows.map(function (x, i) {
          return { name: x.name, value: x.value, itemStyle: { color: colorFn(x, i) } };
        })
      }]
    });
    window.addEventListener('resize', function () { chart.resize(); });
  }

  function rankBy(idx) {
    var m = {};
    DATA.forEach(function (r) { var k = r[idx]; if (k) m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).map(function (k) { return { name: k, value: m[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  pie('chartMarket', rankBy(1).map(function (x) { return { name: MARKET[x.name] || x.name, value: x.value, key: x.name }; }),
    function (x) { return MARKET_COLOR[x.key || ''] || '#9CA3AF'; });
  pie('chartType', rankBy(2), function (x, i) { return TYPE_COLOR[i % TYPE_COLOR.length]; });

  // 审核状态横向条
  var stRows = rankBy(6).filter(function (x) { return x.name !== 'OTHER' || x.value; });
  var stEl = $('chartStatus');
  if (stEl) {
    var stChart = echarts.init(stEl, null, { renderer: 'svg' });
    var stMax = Math.max.apply(null, stRows.map(function (x) { return x.value; }).concat([1]));
    stEl.style.height = Math.max(260, stRows.length * 34 + 40) + 'px';
    stChart.setOption({
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
          color: function (p) {
            var name = stRows[p.dataIndex].name;
            return STATUS_COLOR[name] || '#9CA3AF';
          }
        },
        label: { show: true, position: 'right', color: '#111827', fontSize: 10, fontWeight: 600 }
      }]
    });
    window.addEventListener('resize', function () { stChart.resize(); });
  }

  // 近 36 个月受理趋势
  var trendEl = $('chartTrend');
  if (trendEl) {
    var monthCount = {};
    DATA.forEach(function (r) {
      var d = r[9] || '';
      if (d.length >= 7) monthCount[d.slice(0, 7)] = (monthCount[d.slice(0, 7)] || 0) + 1;
    });
    var months = Object.keys(monthCount).sort().slice(-36);
    var trChart = echarts.init(trendEl, null, { renderer: 'svg' });
    trChart.setOption({
      animation: false,
      textStyle: { fontSize: 11, color: '#6B7280' },
      grid: { left: 40, right: 14, top: 22, bottom: 46 },
      tooltip: { trigger: 'axis', appendToBody: true, formatter: '{b}<br/>{c} 个' },
      xAxis: { type: 'category', data: months, axisLabel: { color: '#6B7280', fontSize: 9, rotate: 45 }, axisLine: axis.axisLine, axisTick: { show: false } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#F0F1F3' } }, axisLabel: axis.axisLabel, axisLine: { show: false }, axisTick: { show: false } },
      series: [{
        type: 'bar', data: months.map(function (m) { return monthCount[m]; }), barWidth: '60%',
        itemStyle: {
          borderRadius: [3, 3, 0, 0],
          color: function (p) {
            var t = months.length > 1 ? p.dataIndex / (months.length - 1) : 1;
            return p.dataIndex === months.length - 1 ? '#D97706' : (t > 0.5 ? '#B32B4A' : '#9A1831');
          }
        }
      }]
    });
    window.addEventListener('resize', function () { trChart.resize(); });
  }

  /* ---------- 表格 ---------- */
  var state = { q: '', market: '', type: '', status: '', page: 1, per: 20 };
  var typeVals = {}, statusVals = {};
  DATA.forEach(function (r) {
    if (r[2]) typeVals[r[2]] = 1;
    if (r[6]) statusVals[r[6]] = 1;
  });
  Object.keys(MARKET).forEach(function (k) { if (markets[k]) $('fMarket').appendChild(opt(k, MARKET[k])); });
  Object.keys(typeVals).sort().forEach(function (k) { $('fType').appendChild(opt(k, k)); });
  Object.keys(STATUS).forEach(function (k) {
    if (statusVals[k]) $('fStatus').appendChild(opt(k, STATUS[k]));
  });
  function opt(v, t) { var o = document.createElement('option'); o.value = v; o.textContent = t; return o; }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return DATA.filter(function (r) {
      if (state.market && r[1] !== state.market) return false;
      if (state.type && r[2] !== state.type) return false;
      if (state.status && r[6] !== state.status) return false;
      if (q) {
        var hay = (r[3] + ' ' + r[4] + ' ' + r[8]).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function render() {
    var rows = filtered();
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

  var timer;
  $('q').addEventListener('input', function (e) {
    clearTimeout(timer);
    var v = e.target.value;
    timer = setTimeout(function () { state.q = v; state.page = 1; render(); }, 160);
  });
  $('fMarket').addEventListener('change', function (e) { state.market = e.target.value; state.page = 1; render(); });
  $('fType').addEventListener('change', function (e) { state.type = e.target.value; state.page = 1; render(); });
  $('fStatus').addEventListener('change', function (e) { state.status = e.target.value; state.page = 1; render(); });
  $('pager').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || b.disabled) return;
    var p = Number(b.dataset.p);
    if (!p) return;
    state.page = p;
    render();
    document.querySelector('.table-wrap').scrollTop = 0;
  });

  render();

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
})();
