/* 辅导看板增强：KPI / 头部数字动态化 + 辅导 → 审核 转化漏斗 */
(function () {
  'use strict';

  var STATUS_KEYS = {
    '辅导项目总数': null,
    '辅导备案（在辅导）': '辅导备案',
    '辅导工作完成': '辅导工作完成',
    '辅导验收': '辅导验收',
    '撤回辅导备案': '撤回辅导备案',
    '辅导验收终止': '辅导验收终止'
  };

  function fmt(n) {
    return Number(n || 0).toLocaleString('zh-CN');
  }

  function rows() {
    return (window.__IPO_DATA__ || []).slice();
  }

  /* ---------- 头部 / KPI / 注释数字 ---------- */
  function applyBase() {
    var data = rows();
    if (!data.length) return;

    var byStatus = {};
    var bureau = {};
    var agency = {};
    var latest = '';
    data.forEach(function (r) {
      var st = r[4] || '';
      byStatus[st] = (byStatus[st] || 0) + 1;
      if (r[5]) bureau[r[5]] = 1;
      if (r[2]) agency[r[2]] = 1;
      if (r[8] && r[8] > latest) latest = r[8];
    });
    var total = data.length;

    // KPI
    Array.prototype.forEach.call(document.querySelectorAll('.kpi'), function (box) {
      var labelEl = box.querySelector('.k-label');
      var valueEl = box.querySelector('.k-value');
      var subEl = box.querySelector('.k-sub');
      if (!labelEl || !valueEl) return;
      var label = labelEl.textContent.trim();
      if (!(label in STATUS_KEYS)) return;
      var key = STATUS_KEYS[label];
      var count = key === null ? total : (byStatus[key] || 0);
      valueEl.textContent = fmt(count);
      if (subEl) {
        subEl.textContent = key === null
          ? '个'
          : '占 ' + (total ? (count / total * 100).toFixed(1) : '0.0') + '%';
      }
    });

    // 文案中写死的 1196
    Array.prototype.forEach.call(
      document.querySelectorAll('.sec-note, .sub, footer, .stamp'),
      function (el) {
        if (el.innerHTML.indexOf('1196') >= 0) {
          el.innerHTML = el.innerHTML.replace(/1,?196/g, fmt(total));
        }
      }
    );

    // 页头数据截止与覆盖范围
    var stamp = document.querySelector('.stamp');
    if (stamp) {
      stamp.innerHTML = '数据截止 <b>' + (latest || '—') + '</b> 覆盖 ' +
        Object.keys(bureau).length + ' 个派出机构 · ' +
        Object.keys(agency).length + ' 家辅导机构';
    }
  }

  /* ---------- 转化漏斗（横向柱状图，绝对数量） ---------- */
  var BAR_COLORS = {
    filing: '#6B7280',
    accepted: '#9A1831',
    inquiry: '#B32B4A',
    reply: '#C2415E',
    passed: '#D97706',
    submit: '#B45309',
    registered: '#059669',
    issued: '#0891B2',
    listed: '#0F766E',
    abort: '#9CA3AF',
    terminated: '#DC2626'
  };

  function renderFunnel(f) {
    var wrap = document.getElementById('funnelSteps');
    if (!wrap || !f || !f.bars || !f.bars.length) return;

    var base = f.bars[0].count || 1;
    var html = f.bars.map(function (b) {
      var share = base ? b.count / base * 100 : 0;
      var width = b.count ? Math.max(share, 1.5) : 0;
      var note = b.kind === 'base' ? '基准'
        : (b.kind === 'state' ? '当前状态' : '环节转化 ' + (b.rate || 0).toFixed(1) + '%');
      return '<div class="funnel-row' + (b.kind === 'state' ? ' state' : '') + '" data-key="' + b.key +
        '" title="' + b.label + '：' + fmt(b.count) + ' 家">' +
        '<div class="funnel-label">' + b.label + '</div>' +
        '<div class="funnel-track">' +
          '<div class="funnel-bar" style="width:' + width.toFixed(1) + '%;background:' +
            (BAR_COLORS[b.key] || '#9A1831') + '"></div>' +
        '</div>' +
        '<div class="funnel-count">' + fmt(b.count) + '</div>' +
        '<div class="funnel-rate muted">' + note + '</div>' +
      '</div>';
    }).join('');
    wrap.innerHTML = html;

    var note = document.getElementById('funnelNote2');
    if (note) {
      note.innerHTML = '口径：辅导备案为全部公示企业（' + fmt(f.stages[0].count) + ' 家）；' +
        '「已受理」至「已上市」为其中按企业名称精确匹配到审核项目、且累计曾到达该阶段的家数' +
        '（日期缺失时按审核阶段推断）；「中止及财报更新」「终止」为匹配项目当前所处状态，与其他阶段口径不同。' +
        '匹配成功 <b>' + fmt(f.matched) + '</b> 家（匹配率 ' + (f.match_rate || 0).toFixed(1) + '%），未匹配 <b>' +
        fmt(f.unmatched) + '</b> 家（多为已上市多年或已终止、当前不在审核库的企业）。' +
        '第三列为绝对家数，柱长按“占全部辅导备案企业”比例绘制，第四列为相对上一阶段的环节转化率或状态说明。';
    }

    var head = document.getElementById('funnelNote');
    if (head) {
      head.textContent = '辅导备案 ' + fmt(f.stages[0].count) + ' 家 · 匹配到审核项目 ' +
        fmt(f.matched) + ' 家（' + (f.match_rate || 0).toFixed(1) + '%）';
    }
  }

  /* ---------- 明细弹窗 ---------- */
  var COLS = [
    { k: 'co', t: '辅导对象' },
    { k: 'agency', t: '辅导机构' },
    { k: 'bureau', t: '派出机构' },
    { k: 'filing', t: '备案时间', num: true },
    { k: 'status', t: '辅导状态' },
    { k: 'stage', t: '当前审核阶段' },
    { k: 'history', t: '历史审核次数' },
    { k: 'notice', t: '最新公告', num: true }
  ];
  var MAX_ROWS = 500;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function reviewStage(r) {
    // r[13] 为匹配到的审核项目当前阶段（如：已受理 / 已问询 / 终止 / 注册结果…）
    return r[13] || '';
  }

  function openList(title, sub, list) {
    var mask = document.getElementById('coachModal');
    if (!mask) return;
    var body = document.getElementById('coachModalBody');
    document.getElementById('coachModalTitle').textContent = title;
    document.getElementById('coachModalSub').textContent =
      sub + ' · 共 ' + fmt(list.length) + ' 家' +
      (list.length > MAX_ROWS ? '（仅显示前 ' + MAX_ROWS + ' 家）' : '');

    var trs = list.slice(0, MAX_ROWS).map(function (r) {
      var st = reviewStage(r);
      return '<tr>' +
        '<td class="co"><a href="project.html?id=' + r[0] + '">' + esc(r[1]) + '</a></td>' +
        '<td>' + esc(r[2]) + '</td>' +
        '<td>' + esc(r[5]) + '</td>' +
        '<td class="num">' + esc(r[3]) + '</td>' +
        '<td>' + esc(r[4]) + '</td>' +
        '<td class="num' + (st ? '' : ' dim') + '">' + (st || '—') + '</td>' +
        '<td class="num">' + (r[14] ? r[14] : '—') + '</td>' +
        '<td class="num">' + esc(r[8]) + '</td>' +
        '</tr>';
    }).join('');

    body.innerHTML =
      '<table class="mtable"><thead><tr>' +
      COLS.map(function (c) { return '<th>' + c.t + '</th>'; }).join('') +
      '</tr></thead><tbody>' + trs + '</tbody></table>';
    body.scrollTop = 0;
    mask.classList.add('open');
  }

  function closeModal() {
    var mask = document.getElementById('coachModal');
    if (mask) mask.classList.remove('open');
  }

  function bindModal() {
    var mask = document.getElementById('coachModal');
    if (!mask) return;
    document.getElementById('coachModalClose').addEventListener('click', closeModal);
    mask.addEventListener('click', function (e) { if (e.target === mask) closeModal(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    var wrap = document.getElementById('funnelSteps');
    if (wrap) {
      wrap.addEventListener('click', function (e) {
        var row = e.target.closest('.funnel-row');
        if (!row) return;
        var key = row.dataset.key;
        var label = row.querySelector('.funnel-label').textContent;
        var fn = FILTERS[key];
        if (!fn) return;
        var sub = (key === 'abort' || key === 'terminated')
          ? '口径：匹配项目当前审核阶段为「' + label + '」'
          : '口径：辅导企业按名称匹配到审核项目，且累计曾到达「' + label + '」阶段';
        openList('转化漏斗 · ' + label, sub, rows().filter(function (r) { return fn(r); }));
      });
    }
  }

  var FILTERS = {
    status: function (r, n) { return r[4] === n; },
    region: function (r, n) { return r[5] === n; },
    agency: function (r, n) { return r[2] === n; },
    year: function (r, n) { return String(r[3] || '').slice(0, 4) === String(n); },
    filing: function () { return true; },
    accepted: function (r) { return r[10]; },
    inquiry: function (r) { return r[15]; },
    reply: function (r) { return r[16]; },
    passed: function (r) { return r[11]; },
    submit: function (r) { return r[17]; },
    registered: function (r) { return r[12]; },
    issued: function (r) { return r[18]; },
    listed: function (r) { return r[19]; },
    abort: function (r) { return r[13] === '中止及财报更新'; },
    terminated: function (r) { return r[13] === '终止'; }
  };
  var TITLES = {
    status: '辅导状态构成', region: '派出机构分布', agency: '辅导机构分布', year: '备案年度'
  };
  var SUBS = {
    status: '按项目当前辅导状态', region: '按派出机构',
    agency: '按辅导机构', year: '按辅导备案年份'
  };

  // 供内联图表脚本调用
  window.__coachOpen = function (key, name) {
    var f = FILTERS[key];
    if (!f) return;
    var title = (TITLES[key] || '项目明细') + (name ? ' · ' + name : '');
    openList(title, (SUBS[key] || '') + ' · 点击条形/扇区可查看', rows().filter(function (r) { return f(r, name); }));
  };

  applyBase();
  bindModal();

  fetch('assets/funnel.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(renderFunnel)
    .catch(function () {
      var note = document.getElementById('funnelNote2');
      if (note) note.textContent = '漏斗数据尚未生成（需执行 tools/export_static.py 导出）。';
    });
})();
