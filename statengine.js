/* 静态模式下的统计引擎：与 app/stats.py 保持一致的计算口径 */
(() => {
  const STAGE_ORDER = ['已受理', '已问询', '已回复', '上市委会议', '补充审核',
    '中止及财报更新', '提交注册', '注册结果', '审核结果', '已启动发行', '已上市', '终止', '其他'];
  const ISSUED_STAGES = ['注册结果', '已发行', '已上市', '已启动发行', '审核结果'];
  const IN_REVIEW_STAGES = new Set(['已受理', '已问询', '已回复', '补充审核', '中止及财报更新']);
  const isCurrent = (end) => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return end >= t;
  };
  const ACTIVE_STAGES = new Set(['已受理', '已问询', '已回复', '上市委会议', '补充审核', '中止及财报更新']);
  const MARKET_ORDER = ['SSE', 'SZSE', 'BSE', 'NEEQ'];
  const TYPE_ORDER = ['IPO', 'REFINANCE', 'MA', 'NEEQ_LISTING'];
  const STATUS_ORDER = ['ACCEPTED', 'REVIEWING', 'PASSED', 'PENDING_REG', 'REGISTERED', 'TERMINATED'];
  const SPONSOR_CANON = {
    '华泰联合证券': '华泰联合', '中信建投证券': '中信建投', '国信': '国信证券',
    '银河证券': '中国银河证券', '申万宏源证券承销保荐': '申万宏源承销保荐',
    '国联民生证券承销保荐': '国联民生承销保荐', '长江保荐': '长江承销',
    '长江证券承销保荐': '长江承销', '东方投行': '东方承销保荐',
    '中国国际金融': '中金公司', '国泰海通证券': '国泰海通',
    '国泰君安证券': '国泰君安', '东方证券承销保荐': '东方承销保荐',
    '中天国富证券': '中天国富', '恒泰长财': '恒泰长财证券',
    '东亚前海': '东亚前海证券', '东方花旗': '东方花旗证券',
    '瑞信方正': '瑞信方正证券', '中银证券': '中银国际证券',
    '湘财证券股份': '湘财证券', '国联民生': '国联民生承销保荐',
    '国联民生保荐': '国联民生承销保荐', '国联证券': '国联民生承销保荐',
    '方正证券承销保荐': '方正承销保荐',
    '第一创业证券承销保荐': '第一创业承销保荐',
    '一创投行': '第一创业承销保荐', '长江承销保荐': '长江承销',
  };
  const HEAT_GROUPS = [
    ['SSE', '主板', '上交所主板'], ['SSE', '科创板', '上交所科创板'],
    ['SZSE', '主板', '深交所主板'], ['SZSE', '创业板', '深交所创业板'], ['BSE', '北交所', '北交所'],
  ];
  const BOARD_ORDER = HEAT_GROUPS.map((g) => g[2]).concat(['新三板']);
  const BOARD_MAP = {};
  HEAT_GROUPS.forEach(([m, b, l]) => { BOARD_MAP[`${m}|${b}`] = l; });
  BOARD_MAP['NEEQ|新三板'] = '新三板';

  const pad = (n) => String(n).padStart(2, '0');
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const toDate = (s) => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };
  const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
  const split = (v) => (v || '').split(',').filter(Boolean);

  function canonSponsor(name) {
    const k = (name || '').trim();
    return SPONSOR_CANON[k] || k;
  }

  function boardLabel(p) {
    return BOARD_MAP[`${p.market}|${p.board}`] || p.board || '其他';
  }

  function normalizeRange(frm, to) {
    if (!frm && !to) return [toDate('2000-01-01'), toDate(todayISO())];
    const end = toDate(to) || toDate(todayISO());
    const start = toDate(frm) || addDays(end, -365);
    return start > end ? [end, start] : [start, end];
  }

  function buckets(gran, start, end) {
    const out = [];
    if (gran === 'day') {
      let cur = start;
      while (cur <= end && out.length < 800) {
        out.push([cur, addDays(cur, 1), iso(cur)]);
        cur = addDays(cur, 1);
      }
    } else if (gran === 'week') {
      const wd = (start.getUTCDay() + 6) % 7;
      let cur = addDays(start, -wd);
      while (cur <= end && out.length < 800) {
        const nxt = addDays(cur, 7);
        const last = addDays(nxt, -1);
        const lab = cur.getUTCFullYear() === last.getUTCFullYear()
          ? `${pad(cur.getUTCMonth() + 1)}-${pad(cur.getUTCDate())}~${pad(last.getUTCMonth() + 1)}-${pad(last.getUTCDate())}`
          : `${cur.getUTCFullYear()}-${pad(cur.getUTCMonth() + 1)}-${pad(cur.getUTCDate())}~${pad(last.getUTCMonth() + 1)}-${pad(last.getUTCDate())}`;
        out.push([cur, nxt, lab]);
        cur = nxt;
      }
    } else if (gran === 'year') {
      let cur = new Date(Date.UTC(start.getUTCFullYear(), 0, 1));
      while (cur <= end && out.length < 800) {
        const nxt = new Date(Date.UTC(cur.getUTCFullYear() + 1, 0, 1));
        out.push([cur, nxt, String(cur.getUTCFullYear())]);
        cur = nxt;
      }
    } else {
      let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      while (cur <= end && out.length < 800) {
        const nxt = new Date(Date.UTC(cur.getUTCFullYear() + (cur.getUTCMonth() === 11 ? 1 : 0), (cur.getUTCMonth() + 1) % 12, 1));
        out.push([cur, nxt, `${cur.getUTCFullYear()}-${pad(cur.getUTCMonth() + 1)}`]);
        cur = nxt;
      }
    }
    return out;
  }

  const inRange = (value, start, end) => {
    const d = toDate(value);
    return !!d && start <= d && d <= end;
  };

  function select(items, markets, types, sponsor) {
    let rows = items;
    if (markets.length) rows = rows.filter((p) => markets.includes(p.market));
    if (types.length) rows = rows.filter((p) => types.includes(p.type));
    if (sponsor) {
      const s = canonSponsor(sponsor);
      rows = rows.filter((p) => p.sponsor_short === s || p.sponsor === sponsor);
    }
    return rows;
  }

  function recentMonths(n) {
    const now = new Date();
    const base = now.getFullYear() * 12 + now.getMonth();
    const out = [];
    for (let i = n - 1; i >= 0; i -= 1) {
      const t = base - i;
      out.push(`${Math.floor(t / 12)}-${pad((t % 12) + 1)}`);
    }
    return out;
  }

  function heatData(rows) {
    const months = recentMonths(12);
    const index = {};
    months.forEach((m, i) => { index[m] = i; });
    const boards = HEAT_GROUPS.map((g) => g[2]);
    const groupOf = {};
    HEAT_GROUPS.forEach(([m, b, l]) => { groupOf[`${m}|${b}`] = l; });
    const out = { months, boards, passed: {}, registered: {} };
    boards.forEach((b) => { out.passed[b] = months.map(() => 0); out.registered[b] = months.map(() => 0); });
    rows.forEach((p) => {
      const lab = groupOf[`${p.market}|${p.board}`];
      if (!lab) return;
      [['passed', 'pass_date'], ['registered', 'register_date']].forEach(([key, field]) => {
        const d = p[field];
        if (!d) return;
        const mi = index[d.slice(0, 7)];
        if (mi !== undefined) out[key][lab][mi] += 1;
      });
    });
    return out;
  }

  function stageAt(stage, a, pa, rg, te, t, issue, listing, su, raw) {
    if (te && te < t) {
      const regTerm = /终止注册|撤销注册/.test(raw || '');
      return ['注册结果', '审核结果'].includes(stage) && regTerm ? stage : '终止';
    }
    if (listing && listing < t) return '已上市';
    if (issue && issue < t) return '已启动发行';
    if (rg && rg < t) {
      if (stage === '注册结果' || stage === '审核结果') return stage;
      if (stage === '已发行' || stage === '已上市') return '已上市';
      if (stage === '已启动发行') return '已启动发行';
    }
    if (pa && pa < t) {
      if (ISSUED_STAGES.includes(stage)) return stage === '已发行' ? '已上市' : stage;
      if (su && su < t) return '提交注册';
      if (['提交注册', '补充审核', '中止及财报更新', '上市委会议'].includes(stage)) return stage;
      return '上市委会议';
    }
    if (a && a < t) return ACTIVE_STAGES.has(stage) ? stage : (stage || '其他');
    return null;
  }

  function compute(items, params) {
    const p = params || {};
    const gran = ['day', 'week', 'month', 'year'].includes(p.gran) ? p.gran : 'month';
    const markets = split(p.markets);
    const types = split(p.types);
    const [start, end] = normalizeRange(p.frm, p.to);
    const rows = select(items, markets, types, p.sponsor);
    const parsed = rows.map((x) => ({
      p: x, a: toDate(x.accept_date), inq: toDate(x.inquiry_date), rep: toDate(x.reply_date),
      pa: toDate(x.pass_date), su: toDate(x.submit_date), rg: toDate(x.register_date),
      te: toDate(x.terminate_date), st: x.stage || '其他', sr: x.status_raw || '',
      isd: toDate(x.issue_date), lsd: toDate(x.list_date),
      legacy: String(x.id || '').startsWith('IFIND:'),
    }));
    const tEnd = addDays(end, 1);
    const current = isCurrent(end);
    const series = buckets(gran, start, end).map(([bStart, bEnd, label]) => {
      let accepted = 0; let passed = 0; let submitted = 0; let registered = 0;
      let terminated = 0; let reviewing = 0; let pending = 0;
      const stages = {};
      STAGE_ORDER.forEach((k) => { stages[k] = 0; });
      parsed.forEach((x) => {
        const base = x.a || x.inq || x.rep;
        if (x.a && x.a >= bStart && x.a < bEnd) accepted += 1;
        if (x.pa && x.pa >= bStart && x.pa < bEnd) passed += 1;
        if (x.su && x.su >= bStart && x.su < bEnd) submitted += 1;
        if (x.rg && x.rg >= bStart && x.rg < bEnd) registered += 1;
        if (x.te && x.te >= bStart && x.te < bEnd) terminated += 1;
        if (base && !x.legacy && base < bEnd && !(x.pa && x.pa < bEnd) && !(x.rg && x.rg < bEnd) && !(x.te && x.te < bEnd)) reviewing += 1;
        if (x.pa && !x.legacy && x.pa < bEnd && !(x.rg && x.rg < bEnd) && !(x.te && x.te < bEnd)) pending += 1;
        const at = x.legacy ? null : stageAt(x.st, x.a, x.pa, x.rg, x.te, bEnd, x.isd, x.lsd, x.su, x.sr);
        if (at) stages[at] = (stages[at] || 0) + 1;
      });
      return {
        label, start: iso(bStart), end: iso(addDays(bEnd, -1)),
        accepted, passed, submit: submitted, registered, terminated,
        reviewing, pendingReg: pending, stages,
      };
    });
    const sel = parsed.filter((x) => [x.a, x.pa, x.su, x.rg, x.te].some((d) => d && d >= start && d <= end));
    const reviewingNow = (x) => {
      if (current && !IN_REVIEW_STAGES.has(x.st)) return false;
      const base = x.a || x.inq || x.rep;
      return !!(base && !x.legacy && base < tEnd && !(x.pa && x.pa < tEnd) && !(x.rg && x.rg < tEnd) && !(x.te && x.te < tEnd));
    };
    const kpi = {
      accepted: parsed.filter((x) => x.a && x.a >= start && x.a <= end).length,
      passed: parsed.filter((x) => x.pa && x.pa >= start && x.pa <= end).length,
      submit: parsed.filter((x) => x.su && x.su >= start && x.su <= end).length,
      registered: parsed.filter((x) => x.rg && x.rg >= start && x.rg <= end).length,
      terminated: parsed.filter((x) => x.te && x.te >= start && x.te <= end).length,
      reviewing: parsed.filter(reviewingNow).length,
      pendingReg: parsed.filter((x) => !x.legacy && x.pa && x.pa < tEnd && !(x.rg && x.rg < tEnd) && !(x.te && x.te < tEnd)).length,
      total: sel.length,
    };
    const marketMix = {}; const typeMix = {}; const statusMix = {};
    sel.forEach((x) => {
      marketMix[x.p.market] = (marketMix[x.p.market] || 0) + 1;
      typeMix[x.p.type] = (typeMix[x.p.type] || 0) + 1;
      statusMix[x.p.status] = (statusMix[x.p.status] || 0) + 1;
    });
    const passBoard = {}; const reviewBoard = {};
    parsed.forEach((x) => {
      if (x.pa && x.pa >= start && x.pa <= end) {
        const k = boardLabel(x.p); passBoard[k] = (passBoard[k] || 0) + 1;
      }
      if (reviewingNow(x)) {
        const k = boardLabel(x.p); reviewBoard[k] = (reviewBoard[k] || 0) + 1;
      }
    });
    const mix = (src, order) => order.filter((k) => src[k]).map((k) => ({ key: k, value: src[k] }));
    const boardStats = {};
    parsed.forEach((x) => {
      if (x.legacy) return;
      const at = stageAt(x.st, x.a, x.pa, x.rg, x.te, tEnd, x.isd, x.lsd, x.su, x.sr);
      if (!at) return;
      const m = x.p.market;
      boardStats[m] = boardStats[m] || {};
      boardStats[m][at] = (boardStats[m][at] || 0) + 1;
    });
    return {
      from: iso(start), to: iso(end), gran,
      series, kpi, heat: heatData(rows),
      statusBoard: MARKET_ORDER.filter((m) => boardStats[m])
        .map((m) => ({ market: m, stages: boardStats[m] })),
      passBoardMix: mix(passBoard, BOARD_ORDER),
      reviewBoardMix: mix(reviewBoard, BOARD_ORDER),
      marketMix: mix(marketMix, MARKET_ORDER),
      typeMix: mix(typeMix, TYPE_ORDER),
      statusMix: mix(statusMix, STATUS_ORDER),
      projectCount: sel.length,
    };
  }

  function sponsors(items, params) {
    const p = params || {};
    const [start, end] = normalizeRange(p.frm, p.to);
    const rows = select(items, split(p.markets), split(p.types), null);
    const agg = {};
    rows.forEach((x) => {
      if (!['accept_date', 'pass_date', 'register_date', 'terminate_date', 'update_date']
        .some((k) => inRange(x[k], start, end))) return;
      const key = canonSponsor(x.sponsor_short || '未披露');
      const s = agg[key] || { sponsor: key, total: 0, accepted: 0, passed: 0, registered: 0, terminated: 0, ipo: 0 };
      s.total += 1;
      s.ipo += x.type === 'IPO' ? 1 : 0;
      s.accepted += inRange(x.accept_date, start, end) ? 1 : 0;
      s.passed += inRange(x.pass_date, start, end) ? 1 : 0;
      s.registered += inRange(x.register_date, start, end) ? 1 : 0;
      s.terminated += inRange(x.terminate_date, start, end) ? 1 : 0;
      agg[key] = s;
    });
    const out = Object.values(agg).filter((x) => x.passed > 0 && x.sponsor !== '未披露');
    out.sort((a, b) => (b.passed - a.passed) || (b.total - a.total) || a.sponsor.localeCompare(b.sponsor, 'zh'));
    const pageSize = Math.max(1, Number(p.pageSize || 30));
    const page = Math.max(1, Number(p.page || 1));
    return { total: out.length, items: out.slice((page - 1) * pageSize, page * pageSize) };
  }

  function boardProjects(items, params) {
    const p = params || {};
    const [start, end] = normalizeRange(p.frm, p.to);
    const rows = select(items, split(p.markets), split(p.types), p.sponsor);
    const tEnd = addDays(end, 1);
    const out = rows.filter((x) => {
      if (boardLabel(x) !== p.board) return false;
      if (p.basis === 'pass') return inRange(x.pass_date, start, end);
      const base = toDate(x.accept_date) || toDate(x.inquiry_date) || toDate(x.reply_date);
      const pa = toDate(x.pass_date);
      const rg = toDate(x.register_date);
      const te = toDate(x.terminate_date);
      return !!(base && base < tEnd && !(pa && pa < tEnd) && !(rg && rg < tEnd) && !(te && te < tEnd));
    });
    const key = p.basis === 'pass' ? 'pass_date' : 'update_date';
    out.sort((a, b) => ((b[key] || '') > (a[key] || '') ? 1 : -1));
    return { total: out.length, items: out.slice(0, 300) };
  }

  function chartProjects(items, params) {
    const p = params || {};
    const [start, end] = normalizeRange(p.frm, p.to);
    let rows = select(items, split(p.markets), split(p.types), p.sponsor);
    if (p.board) rows = rows.filter((x) => boardLabel(x) === p.board);
    const tEnd = addDays(end, 1);
    const fields = {
      accepted: 'accept_date', passed: 'pass_date', submit: 'submit_date',
      registered: 'register_date', terminated: 'terminate_date',
    };
    const field = fields[p.basis];
    let out;
    let sortKey;
    if (field) {
      out = rows.filter((x) => inRange(x[field], start, end));
      sortKey = field;
    } else {
      out = rows.filter((x) => {
        const a = toDate(x.accept_date);
        const inq = toDate(x.inquiry_date);
        const rep = toDate(x.reply_date);
        const pa = toDate(x.pass_date);
        const rg = toDate(x.register_date);
        const te = toDate(x.terminate_date);
        if (p.basis === 'reviewing') {
          const base = a || inq || rep;
          const stageOk = !isCurrent(end) || IN_REVIEW_STAGES.has(x.stage || '其他');
          return !!(stageOk && base && base < tEnd && !(pa && pa < tEnd) && !(rg && rg < tEnd) && !(te && te < tEnd));
        }
        if (p.basis === 'pendingReg') {
          return !!(pa && pa < tEnd && !(rg && rg < tEnd) && !(te && te < tEnd));
        }
        if (p.basis === 'stage') {
          return !String(x.id || '').startsWith('IFIND:')
            && stageAt(x.stage || '其他', a, pa, rg, te, tEnd,
              toDate(x.issue_date), toDate(x.list_date), toDate(x.submit_date), x.status_raw) === p.stage;
        }
        return false;
      });
      sortKey = 'update_date';
    }
    out.sort((a, b) => ((b[sortKey] || '') > (a[sortKey] || '') ? 1 : -1));
    return { total: out.length, items: out.slice(0, 300) };
  }

  function filterRows(items, params) {
    const p = params || {};
    const [start, end] = normalizeRange(p.frm, p.to);
    let rows = select(items, split(p.markets), split(p.types), p.sponsor);
    rows = rows.filter((x) => ['accept_date', 'pass_date', 'register_date', 'terminate_date', 'update_date']
      .some((k) => inRange(x[k], start, end)));
    if (p.board) rows = rows.filter((x) => (x.board || '') === p.board);
    if (p.status) rows = rows.filter((x) => x.status === p.status);
    if (p.stage) rows = rows.filter((x) => x.stage === p.stage);
    if (p.q) {
      const ql = p.q.toLowerCase();
      rows = rows.filter((x) => [x.name, x.short_name, x.code]
        .some((v) => (v || '').toLowerCase().includes(ql)));
    }
    const sort = p.sort || '-update_date';
    const field = sort.replace(/^-/, '');
    if (['accept_date', 'pass_date', 'register_date', 'update_date', 'name'].includes(field)) {
      const dir = sort.startsWith('-') ? -1 : 1;
      rows = rows.slice().sort((a, b) => {
        const av = a[field] || '0000-00-00';
        const bv = b[field] || '0000-00-00';
        return av === bv ? 0 : (av > bv ? 1 : -1) * dir;
      });
    }
    return rows;
  }

  function query(items, params) {
    const p = params || {};
    const rows = filterRows(items, p);
    const total = rows.length;
    const pageSize = Math.max(1, Math.min(200, Number(p.pageSize || 20)));
    const page = Math.max(1, Number(p.page || 1));
    return { total, page, pageSize, items: rows.slice((page - 1) * pageSize, page * pageSize) };
  }

  window.StatEngine = { compute, sponsors, query, filterRows, boardProjects, chartProjects, boardLabel, canonSponsor, STAGE_ORDER };
})();
