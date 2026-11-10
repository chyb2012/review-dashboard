/* 债券项目审核动态看板 */
(function () {
  'use strict';

  var DATA = window.__BOND_DATA__ || [];
  var BY_ID = {};
  DATA.forEach(function (r) { BY_ID[r[0]] = r; });
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
    if (gran === 'year') return s.slice(0, 4);
    return s.slice(0, 7);
  }
  function shortTick(v, gran) {
    if (!v) return v;
    if (gran === 'year') return v;
    if (gran === 'month') return v.slice(2);
    return v.slice(5);
  }

  /* ---------- 筛选状态 ---------- */
  var LATEST = DATA.reduce(function (m, r) { return r[9] > m ? r[9] : m; }, '');
  var RANGE_DAYS = { '1m': 31, '3m': 92, '1y': 366 };
  var RANGE_LABEL = { '1m': '近1月', '3m': '近3月', '1y': '近1年', all: '全部时间' };

  var state = {
    q: '', status: '', sponsor: '',
    markets: {}, types: {},
    gran: 'month', range: '1y',
    page: 1, per: 20
  };

  function rangeStart() {
    var days = RANGE_DAYS[state.range];
    if (!days || !LATEST) return '';
    var p = LATEST.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() - days);
    return ymd(d);
  }

  function picked(map) {
    return Object.keys(map).filter(function (k) { return map[k]; });
  }

  function baseRows() {
    var start = rangeStart();
    var mk = picked(state.markets);
    var tp = picked(state.types);
    var q = state.q.trim().toLowerCase();
    var sp = state.sponsor.trim().toLowerCase();
    return DATA.filter(function (r) {
      if (start && (!r[9] || r[9] < start)) return false;
      if (mk.length && mk.indexOf(r[1]) === -1) return false;
      if (tp.length && tp.indexOf(r[2]) === -1) return false;
      if (state.status && r[6] !== state.status) return false;
      if (sp && String(r[8] || '').toLowerCase().indexOf(sp) === -1) return false;
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

    $('stampDate').textContent = LATEST || '—';
    $('stampScope').textContent = Object.keys(markets).map(function (k) { return MARKET[k] || k; }).join(' · ') || '—';
    $('ovNote').textContent = (RANGE_LABEL[state.range] || '全部时间') + ' · ' + num(total) +
      ' 个项目 · 以各交易所公示的最新状态统计';
  }

  /* ---------- 图表 ---------- */
  var charts = {};

  function initChart(id) {
    var el = $(id);
    if (!el) return null;
    if (!charts[id]) charts[id] = echarts.init(el, null, { renderer: 'svg' });
    bindChartHit(id);
    return charts[id];
  }

  /* ECharts 的 SVG click 在部分环境不响应，改为容器级原生 click 定位 */
  function bindChartHit(id) {
    var el = $(id);
    if (!el || el.__hitBound) return;
    el.__hitBound = true;
    el.addEventListener('click', function (e) {
      var chart = charts[id];
      if (!chart) return;
      var rect = el.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var name = id === 'chartType'
        ? pieNameAt(el, chart, x, y)
        : cartNameAt(chart, x, y, id === 'chartStatus' || id === 'chartMarket');
      if (name) onChartClick(id, { name: name });
    });
  }

  function pieNameAt(el, chart, x, y) {
    var w = el.clientWidth;
    var h = el.clientHeight;
    var base = Math.min(w, h);
    var dx = x - w * 0.5;
    var dy = y - h * 0.44;
    var r = Math.sqrt(dx * dx + dy * dy);
    if (r < base * 0.235 || r > base * 0.355) return null;
    var deg = ((Math.atan2(dy, dx) * 180 / Math.PI) + 450) % 360;
    var opt = chart.getOption();
    var data = (opt.series && opt.series[0] && opt.series[0].data) || [];
    var total = data.reduce(function (s, d) { return s + (Number(d.value) || 0); }, 0);
    if (!total) return null;
    var acc = 0;
    for (var i = 0; i < data.length; i++) {
      var span = (Number(data[i].value) || 0) / total * 360;
      if (deg >= acc && deg < acc + span) return data[i].name;
      acc += span;
    }
    return null;
  }

  function cartNameAt(chart, x, y, horizontal) {
    var pos = chart.convertFromPixel({ gridIndex: 0 }, [x, y]);
    if (!pos) return null;
    var idx = Math.round(horizontal ? pos[1] : pos[0]);
    var opt = chart.getOption();
    var axis = horizontal ? (opt.yAxis && opt.yAxis[0]) : (opt.xAxis && opt.xAxis[0]);
    var cats = (axis && axis.data) || [];
    return cats[idx] || null;
  }

  function rankBy(rows, idx) {
    var m = {};
    rows.forEach(function (r) { var k = r[idx]; if (k) m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).map(function (k) { return { name: k, value: m[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  /* 债券类型统一配色：同一类型在所有图表中颜色一致 */
  var TYPE_ORDER = ['私募', '公募', '小公募', '大公募', 'ABS', '其他'];
  var TYPE_COLORS = {
    '私募': '#9A1831', '公募': '#2563EB', '小公募': '#D97706',
    '大公募': '#7C3AED', 'ABS': '#059669', '其他': '#9CA3AF'
  };
  var TYPE_EXTRA = ['#0891B2', '#DB2777', '#65A30D', '#EA580C'];

  function typeList(rows) {
    var set = {};
    rows.forEach(function (r) { if (r[2]) set[r[2]] = 1; });
    var known = TYPE_ORDER.filter(function (t) { return set[t]; });
    var extra = Object.keys(set).filter(function (t) {
      return TYPE_ORDER.indexOf(t) === -1;
    }).sort();
    return known.concat(extra);
  }

  function typeColor(t, list) {
    if (TYPE_COLORS[t]) return TYPE_COLORS[t];
    var i = list.indexOf(t);
    return TYPE_EXTRA[Math.max(0, i) % TYPE_EXTRA.length];
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

  function drawTypePie(rows) {
    var list = typeList(rows);
    var counts = {};
    rows.forEach(function (r) { if (r[2]) counts[r[2]] = (counts[r[2]] || 0) + 1; });
    drawPie('chartType', list.map(function (t) { return { name: t, value: counts[t] }; }),
      function (x) { return typeColor(x.name, list); });
  }

  /* 横向堆叠条形：按债券类型分段着色 */
  function drawStack(id, catNames, catKeys, types, countFn, barH) {
    var chart = initChart(id);
    if (!chart) return;
    var el = $(id);
    el.style.height = Math.max(260, catNames.length * barH + 92) + 'px';
    chart.resize();
    chart.setOption({
      animation: false,
      textStyle: { fontSize: 11, color: '#6B7280' },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, appendToBody: true },
      legend: { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11, color: '#6B7280' } },
      grid: { left: 96, right: 60, top: 12, bottom: 48 },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: '#F0F1F3' } }, axisLabel: axis.axisLabel, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: {
        type: 'category', data: catNames,
        axisLabel: { color: '#111827', fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false }
      },
      series: types.map(function (t) {
        return {
          name: t, type: 'bar', stack: 's', barWidth: '54%',
          itemStyle: { color: typeColor(t, types) },
          data: catKeys.map(function (k) { return countFn(k, t); })
        };
      })
    }, true);
  }

  function drawMarket(rows) {
    var types = typeList(rows);
    var keys = ['SSE', 'SZSE', 'BSE'].filter(function (k) {
      return rows.some(function (r) { return r[1] === k; });
    });
    drawStack('chartMarket', keys.map(function (k) { return MARKET[k] || k; }), keys, types,
      function (k, t) {
        return rows.filter(function (r) { return r[1] === k && r[2] === t; }).length;
      }, 46);
  }

  function drawStatus(rows) {
    var st = rankBy(rows, 6);
    var types = typeList(rows);
    drawStack('chartStatus', st.map(function (x) { return STATUS[x.name] || x.name; }),
      st.map(function (x) { return x.name; }), types,
      function (k, t) {
        return rows.filter(function (r) { return r[6] === k && r[2] === t; }).length;
      }, 40);
  }

  function drawTrend(rows) {
    var chart = initChart('chartTrend');
    if (!chart) return;
    var types = typeList(rows);
    var count = {};
    rows.forEach(function (r) {
      var k = tickOf(r[9], state.gran);
      if (!k) return;
      if (!count[k]) count[k] = {};
      var t = r[2] || '其他';
      count[k][t] = (count[k][t] || 0) + 1;
    });
    var ticks = Object.keys(count).sort();
    if (state.gran === 'month' && ticks.length > 36) ticks = ticks.slice(-36);
    var zoom = ticks.length > 40;
    chart.setOption({
      animation: false,
      textStyle: { fontSize: 11, color: '#6B7280' },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, appendToBody: true },
      legend: { bottom: zoom ? 34 : 0, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11, color: '#6B7280' } },
      grid: { left: 40, right: 14, top: 22, bottom: zoom ? 88 : 60 },
      dataZoom: zoom ? [
        { type: 'inside', start: ticks.length > 120 ? 70 : 0, end: 100 },
        { type: 'slider', height: 14, bottom: 8, borderColor: '#E5E7EB',
          fillerColor: 'rgba(154,24,31,.08)', handleSize: 12, showDetail: false }
      ] : [],
      xAxis: {
        type: 'category', data: ticks,
        axisLabel: {
          color: '#6B7280', fontSize: 9, rotate: 45, hideOverlap: true,
          formatter: function (v) { return shortTick(v, state.gran); }
        },
        axisLine: axis.axisLine, axisTick: { show: false }
      },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#F0F1F3' } }, axisLabel: axis.axisLabel, axisLine: { show: false }, axisTick: { show: false } },
      series: types.map(function (t) {
        return {
          name: t, type: 'bar', stack: 'tr', barWidth: '62%',
          itemStyle: { color: typeColor(t, types) },
          data: ticks.map(function (k) { return (count[k] && count[k][t]) || 0; })
        };
      })
    }, true);
  }

  function renderCharts(rows) {
    drawMarket(rows);
    drawTypePie(rows);
    drawStatus(rows);
    drawTrend(rows);
  }

  /* ---------- 图表下钻 ---------- */
  function onChartClick(id, p) {
    if (!p || !p.name || p.name === '暂无数据') return;
    var rows = baseRows();
    if (id === 'chartMarket') {
      var code = '';
      Object.keys(MARKET).forEach(function (k) { if (MARKET[k] === p.name) code = k; });
      openList('市场 · ' + p.name, rows.filter(function (r) { return r[1] === code; }));
    } else if (id === 'chartType') {
      openList('债券类型 · ' + p.name, rows.filter(function (r) { return r[2] === p.name; }));
    } else if (id === 'chartStatus') {
      var sc = '';
      Object.keys(STATUS).forEach(function (k) { if (STATUS[k] === p.name) sc = k; });
      openList('审核状态 · ' + p.name, rows.filter(function (r) { return r[6] === sc; }));
    } else if (id === 'chartTrend') {
      openList('受理 · ' + p.name,
        rows.filter(function (r) { return tickOf(r[9], state.gran) === p.name; }));
    }
  }

  /* ---------- 弹窗：项目列表 ---------- */
  var listState = { rows: [], page: 1, per: 50 };

  function openList(title, rows) {
    listState = { rows: rows, page: 1, per: 50 };
    $('listTitle').textContent = title;
    $('listModal').classList.add('on');
    $('overlay').classList.add('on');
    renderList();
  }

  function renderList() {
    var s = listState;
    var total = s.rows.length;
    var pages = Math.max(1, Math.ceil(total / s.per));
    if (s.page > pages) s.page = pages;
    var start = (s.page - 1) * s.per;
    var page = s.rows.slice(start, start + s.per);
    $('listSub').textContent = total
      ? '共 ' + num(total) + ' 个项目 · 第 ' + s.page + ' / ' + pages + ' 页 · 点击行查看详情'
      : '当前条件下没有项目';
    if (!total) {
      $('listBody').innerHTML = '<div style="text-align:center;padding:48px;color:#6B7280">没有符合条件的项目</div>';
      return;
    }
    var head = '<table class="modal-table"><thead><tr>' +
      '<th style="width:64px">市场</th><th>债券名称</th><th style="width:200px">发行人</th>' +
      '<th style="width:80px">类型</th><th style="width:84px">规模(亿元)</th><th style="width:92px">状态</th>' +
      '<th style="width:96px">受理日期</th><th style="width:96px">更新日期</th>' +
      '</tr></thead><tbody>';
    var body = page.map(function (r) {
      var st = r[6] || 'OTHER';
      return '<tr data-id="' + esc(r[0]) + '">' +
        '<td>' + esc(MARKET[r[1]] || r[1]) + '</td>' +
        '<td class="t-name" title="' + esc(r[4]) + '">' + esc(r[4]) + '</td>' +
        '<td class="t-iss" title="' + esc(r[3]) + '">' + esc(r[3] || '—') + '</td>' +
        '<td>' + esc(r[2] || '—') + '</td>' +
        '<td class="num">' + (r[5] == null ? '—' : num(r[5])) + '</td>' +
        '<td><span class="tag ' + st + '">' + esc(STATUS[st] || r[7] || st) + '</span></td>' +
        '<td class="num">' + esc(r[9] || '—') + '</td>' +
        '<td class="num">' + esc(r[10] || '—') + '</td>' +
        '</tr>';
    }).join('');
    var foot = '<div class="modal-foot"><span>' + num(total) + ' 个项目</span><span>' +
      '<button class="btn" data-lp="' + (s.page - 1) + '"' + (s.page === 1 ? ' disabled' : '') + '>上一页</button> ' +
      '<button class="btn" data-lp="' + (s.page + 1) + '"' + (s.page === pages ? ' disabled' : '') + '>下一页</button>' +
      '</span></div>';
    $('listBody').innerHTML = head + body + '</tbody></table>' + foot;
  }

  /* ---------- 抽屉：单个项目详情 ---------- */
  function openDetail(id) {
    var r = BY_ID[id];
    if (!r) return;
    var st = r[6] || 'OTHER';
    var pid = String(r[0] || '').split(':')[1] || r[0] || '—';
    var items = [
      ['市场', MARKET[r[1]] || r[1] || '—'],
      ['债券类型', r[2] || '—'],
      ['发行人', r[3] || '—'],
      ['拟发行规模', r[5] == null ? '—' : num(r[5]) + ' 亿元'],
      ['审核状态', STATUS[st] || r[7] || st],
      ['交易所原始状态', r[7] || '—'],
      ['地区', r[12] || '—'],
      ['交易所确认文件文号', r[13] || '—'],
      ['承销商 / 管理人', r[8] || '—'],
      ['受理日期', r[9] || '—'],
      ['更新日期', r[10] || '—'],
      ['项目编号', pid]
    ];
    $('drawerBody').innerHTML =
      '<div class="d-hero">' +
        '<div class="eyebrow">' + esc(MARKET[r[1]] || r[1]) + ' / 债券项目</div>' +
        '<h3>' + esc(r[4] || '—') + '</h3>' +
        '<div class="meta"><span class="tag ' + st + '">' + esc(STATUS[st] || r[7] || st) + '</span>' +
        '<span class="hint">最后更新 ' + esc(r[10] || '—') + '</span></div>' +
      '</div>' +
      '<div class="d-grid">' + items.map(function (x) {
        return '<div class="item"><div class="k">' + x[0] + '</div><div class="v">' + esc(x[1]) + '</div></div>';
      }).join('') + '</div>' +
      '<div class="d-sec">来源</div>' +
      (r[11]
        ? '<a class="d-link" href="' + esc(r[11]) + '" target="_blank" rel="noopener">' +
            esc({ SSE: '上交所项目详情页', SZSE: '深交所项目进度信息', BSE: '北交所项目详情页' }[r[1]] || '交易所项目页') +
          '</a><div style="font-size:11px;color:#9CA3AF;word-break:break-all;margin-top:4px">' + esc(r[11]) + '</div>'
        : '<div class="hint">未提供公开链接</div>');
    $('drawer').classList.add('open');
    $('overlay').classList.add('on');
  }

  function syncOverlay() {
    var on = $('drawer').classList.contains('open') || $('listModal').classList.contains('on');
    $('overlay').classList.toggle('on', on);
  }

  function closeList() {
    $('listModal').classList.remove('on');
    syncOverlay();
  }

  function closeDrawer() {
    $('drawer').classList.remove('open');
    syncOverlay();
  }

  /* ---------- 明细表 ---------- */
  function opt(v, t) { var o = document.createElement('option'); o.value = v; o.textContent = t; return o; }

  function initSelects() {
    var statusVals = {};
    DATA.forEach(function (r) { if (r[6]) statusVals[r[6]] = 1; });
    Object.keys(STATUS).forEach(function (k) {
      if (statusVals[k]) $('fStatus').appendChild(opt(k, STATUS[k]));
    });
  }

  function initChips() {
    var markets = {}, types = {};
    DATA.forEach(function (r) {
      if (r[1]) markets[r[1]] = 1;
      if (r[2]) types[r[2]] = 1;
    });
    function build(box, values, labels) {
      var all = document.createElement('button');
      all.type = 'button';
      all.className = 'chip all on';
      all.dataset.v = '';
      all.textContent = '全部';
      box.appendChild(all);
      Object.keys(values).sort().forEach(function (v) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.dataset.v = v;
        b.textContent = labels ? (labels[v] || v) : v;
        box.appendChild(b);
      });
    }
    build($('marketChips'), markets, MARKET);
    build($('typeChips'), types, null);
  }

  function syncChips(box, key) {
    Array.prototype.forEach.call(box.querySelectorAll('.chip'), function (x) {
      if (!x.dataset.v) {
        x.classList.toggle('on', picked(state[key]).length === 0);
      } else {
        x.classList.toggle('on', !!state[key][x.dataset.v]);
      }
    });
  }

  /* 顶部市场标签与明细区市场下拉共用同一状态 */
  function syncMarketSelect() {
    var mk = picked(state.markets);
    $('fMarket').value = mk.length === 1 ? mk[0] : '';
    syncChips($('marketChips'), 'markets');
  }

  function toggleChips(box, key) {
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button.chip');
      if (!b) return;
      if (!b.dataset.v) {
        state[key] = {};
      } else {
        state[key][b.dataset.v] = !state[key][b.dataset.v];
      }
      if (key === 'markets') syncMarketSelect();
      else syncChips(box, key);
      state.page = 1;
      renderAll();
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
      return '<tr data-id="' + esc(r[0]) + '">' +
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

  /* ---------- 事件绑定 ---------- */
  function bind() {
    var timer;
    var spTimer;
    $('q').addEventListener('input', function (e) {
      clearTimeout(timer);
      var v = e.target.value;
      timer = setTimeout(function () { state.q = v; state.page = 1; renderAll(); }, 160);
    });
    $('fSponsor').addEventListener('input', function (e) {
      clearTimeout(spTimer);
      var v = e.target.value;
      spTimer = setTimeout(function () { state.sponsor = v; state.page = 1; renderAll(); }, 220);
    });
    $('fMarket').addEventListener('change', function (e) {
      state.markets = {};
      if (e.target.value) state.markets[e.target.value] = true;
      syncMarketSelect();
      state.page = 1;
      renderAll();
    });
    $('fStatus').addEventListener('change', function (e) { state.status = e.target.value; state.page = 1; renderAll(); });
    $('fPer').addEventListener('change', function (e) {
      state.per = Number(e.target.value) || 20;
      state.page = 1;
      renderTable(baseRows());
    });
    $('granSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-g]');
      if (!b) return;
      state.gran = b.dataset.g;
      Array.prototype.forEach.call($('granSeg').children, function (x) {
        x.classList.toggle('on', x === b);
      });
      renderAll();
    });
    $('rangeSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-r]');
      if (!b) return;
      state.range = b.dataset.r;
      Array.prototype.forEach.call($('rangeSeg').children, function (x) {
        x.classList.toggle('on', x === b);
      });
      state.page = 1;
      renderAll();
    });
    toggleChips($('marketChips'), 'markets');
    toggleChips($('typeChips'), 'types');
    $('pager').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      var p = Number(b.dataset.p);
      if (!p) return;
      state.page = p;
      renderTable(baseRows());
      document.querySelector('.table-wrap').scrollTop = 0;
    });

    /* 明细行 → 项目详情抽屉 */
    $('tbody').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-id]');
      if (tr) openDetail(tr.dataset.id);
    });
    /* 弹窗内：翻页与行点击 */
    $('listBody').addEventListener('click', function (e) {
      var lp = e.target.closest('button[data-lp]');
      if (lp) {
        if (lp.disabled) return;
        listState.page = Number(lp.dataset.lp) || 1;
        renderList();
        $('listBody').scrollTop = 0;
        return;
      }
      var tr = e.target.closest('tr[data-id]');
      if (tr) {
        closeList();
        openDetail(tr.dataset.id);
      }
    });
    $('listClose').addEventListener('click', closeList);
    $('drawerClose').addEventListener('click', closeDrawer);
    $('overlay').addEventListener('click', function () { closeList(); closeDrawer(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeList(); closeDrawer(); }
    });
  }

  initSelects();
  initChips();
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
