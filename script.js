(() => {
  const $ = s => document.querySelector(s);
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const urlbar = $('#urlbar'), home = $('#home'), frames = $('#frames'),
        progress = $('#progress'), tabBtn = $('#btnTabs');
  let tabs = [], active = -1, incog = false;
  const A = window.Android || null; // jembatan ke aplikasi Android (kalau ada)
  const pagesVis = v => { if (A) A.vis(v); };

  const SHORTCUTS = [
    ['G', 'GitHub', 'https://github.com'], ['Y', 'YouTube', 'https://www.youtube.com'],
    ['W', 'Wikipedia', 'https://id.wikipedia.org'], ['G', 'Google', 'https://www.google.com/webhp?igu=1']
  ];
  $('#shortcuts').innerHTML = SHORTCUTS.map(([l, n, u]) =>
    `<a class="sc" data-u="${u}"><i>${l}</i>${n}</a>`).join('');
  $('#shortcuts').addEventListener('click', e => {
    const a = e.target.closest('.sc'); if (a) navigate(a.dataset.u);
  });

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.id); toast.id = setTimeout(() => t.hidden = true, 2200);
  }

  function resolve(q) {
    q = q.trim(); if (!q) return null;
    if (/^https?:\/\//i.test(q)) return q;
    if (/^[^\s]+\.[^\s]{2,}$/.test(q)) return 'https://' + q;
    return 'https://www.google.com/search?igu=1&q=' + encodeURIComponent(q);
  }

  function newTab(isIncog = incog) {
    let iframe = null;
    if (A) A.nt();
    else {
      iframe = document.createElement('iframe');
      iframe.referrerPolicy = 'no-referrer';
      iframe.allow = 'fullscreen';
      iframe.addEventListener('load', () => {
        progress.style.width = '100%';
        setTimeout(() => { progress.style.opacity = 0; progress.style.width = 0; }, 250);
      });
      frames.appendChild(iframe);
    }
    tabs.push({ iframe, url: '', title: 'Tab baru', incog: isIncog });
    switchTab(tabs.length - 1);
  }

  function switchTab(i) {
    active = i;
    if (A) A.st(tabs[i].url ? i : -1);
    else tabs.forEach((t, j) => t.iframe.classList.toggle('active', j === i && !!t.url));
    const t = tabs[i];
    incog = t.incog;
    document.body.classList.toggle('incog', incog);
    $('#btnIncog').textContent = incog ? '🕶 Samaran: AKTIF' : '🕶 Samaran';
    home.classList.toggle('hidden', !!t.url);
    urlbar.value = t.url;
    tabBtn.textContent = tabs.length;
  }

  function navigate(q) {
    const url = resolve(q); if (!url) return;
    if (active < 0) newTab();
    const t = tabs[active];
    t.url = url; t.title = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    progress.style.opacity = 1; progress.style.width = '60%';
    if (A) A.load(active, url); else t.iframe.src = url;
    if (!t.incog) addTo('hist', { t: t.title, u: url, d: Date.now() }, 200);
    switchTab(active);
    urlbar.blur();
  }

  function showHome() {
    const t = tabs[active]; t.url = ''; t.title = 'Tab baru';
    if (!A) t.iframe.removeAttribute('src');
    switchTab(active);
  }

  function addTo(key, item, max = 500) {
    const l = store.get(key, []).filter(x => x.u !== item.u);
    l.unshift(item); store.set(key, l.slice(0, max));
  }

  // ----- Sheet (histori / bookmark / tab) -----
  function openSheet(title, items, onPick, onDel, clearLabel, onClear) {
    $('#sheetTitle').textContent = title;
    const ul = $('#sheetList');
    ul.innerHTML = items.length ? '' : '<div class="empty">Masih kosong</div>';
    items.forEach((it, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<div class="t"></div>${onDel ? '<span class="x">✕</span>' : ''}`;
      const box = li.querySelector('.t');
      box.append(document.createTextNode(it.t));
      const s = document.createElement('small'); s.textContent = it.u || ''; box.append(s);
      li.addEventListener('click', e => {
        if (e.target.classList.contains('x')) { onDel(i); li.remove(); return; }
        closeSheet(); onPick(i);
      });
      ul.appendChild(li);
    });
    const c = $('#sheetClear'); c.textContent = clearLabel || '';
    c.style.visibility = clearLabel ? 'visible' : 'hidden';
    c.onclick = () => { onClear(); closeSheet(); };
    $('#sheet').hidden = false; pagesVis(false);
  }
  const closeSheet = () => { $('#sheet').hidden = true; pagesVis(true); };
  $('#sheetClose').onclick = closeSheet;
  $('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });

  // ----- Menu -----
  const menu = $('#menu'), backdrop = $('#menuBackdrop');
  const toggleMenu = show => { menu.hidden = backdrop.hidden = !show; pagesVis(!show); };
  $('#btnMenu').onclick = () => toggleMenu(menu.hidden);
  backdrop.onclick = () => toggleMenu(false);

  const actions = {
    back: () => { if (A) return A.cmd(active, 'back'); try { tabs[active].iframe.contentWindow.history.back(); } catch { toast('Tidak bisa kembali'); } },
    fwd: () => { if (A) return A.cmd(active, 'fwd'); try { tabs[active].iframe.contentWindow.history.forward(); } catch { toast('Tidak bisa maju'); } },
    reload: () => { const t = tabs[active]; if (!t.url) return; if (A) A.cmd(active, 'reload'); else t.iframe.src = t.url; },
    bm: () => {
      const t = tabs[active];
      if (!t.url) return toast('Buka halaman dulu');
      addTo('bm', { t: t.title, u: t.url }); toast('Bookmark disimpan');
    },
    newtab: () => { newTab(false); },
    incog: () => { newTab(true); toast('Tab Samaran: histori tidak disimpan'); },
    hist: () => {
      const l = store.get('hist', []);
      openSheet('Histori', l, i => navigate(l[i].u),
        i => { l.splice(i, 1); store.set('hist', l); }, 'Hapus semua', () => store.set('hist', []));
    },
    bmlist: () => {
      const l = store.get('bm', []);
      openSheet('Bookmark', l, i => navigate(l[i].u),
        i => { l.splice(i, 1); store.set('bm', l); }, 'Hapus semua', () => store.set('bm', []));
    },
    tabs: () => {
      openSheet('Tab terbuka (' + tabs.length + ')',
        tabs.map(t => ({ t: (t.incog ? '🕶 ' : '') + t.title, u: t.url })),
        i => switchTab(i),
        i => {
          if (tabs.length === 1) { showHome(); return; }
          if (A) A.close(i); else tabs[i].iframe.remove();
          tabs.splice(i, 1);
          switchTab(Math.min(active, tabs.length - 1));
        });
    },
    clear: () => { store.set('hist', []); if (A) A.clearData(); toast('Data penjelajahan dihapus'); },
    'newtab-open': () => { const u = tabs[active]?.url; u ? window.open(u, '_blank') : toast('Buka halaman dulu'); }
  };
  menu.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    toggleMenu(false); actions[b.dataset.a]?.();
  });

  // ----- Input -----
  $('#searchForm').addEventListener('submit', e => {
    e.preventDefault(); navigate($('#searchInput').value); $('#searchInput').value = '';
  });
  urlbar.addEventListener('keydown', e => { if (e.key === 'Enter') navigate(urlbar.value); });
  urlbar.addEventListener('focus', () => urlbar.select());
  $('#btnHome').onclick = showHome;
  $('#btnTabs').onclick = actions.tabs;
  $('#btnAI').onclick = () => navigate('https://www.google.com/search?igu=1&udm=50');
  $('#btnIncog').onclick = () => {
    const t = tabs[active]; t.incog = !t.incog; switchTab(active);
    toast(t.incog ? 'Mode Samaran aktif' : 'Mode Samaran dimatikan');
  };

  // ----- Jembatan Android -----
  window.openUrl = navigate;
  window.onProg = (i, p) => {
    if (i !== active) return;
    progress.style.opacity = p < 100 ? 1 : 0;
    progress.style.width = (p < 100 ? p : 0) + '%';
  };
  window.onPage = (i, url, title) => {
    const t = tabs[i]; if (!t || !url || url === 'about:blank') return;
    t.url = url;
    t.title = title || url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    if (i === active) urlbar.value = url;
    if (title && !t.incog) addTo('hist', { t: t.title, u: url, d: Date.now() }, 200);
  };
  window.nativeBack = () => {
    if (!$('#sheet').hidden) closeSheet();
    else if (!menu.hidden) toggleMenu(false);
    else if (tabs[active] && tabs[active].url) showHome();
    else if (A) A.exit();
  };
  if (A) {
    const nb = document.querySelector('[data-a="newtab-open"]'); if (nb) nb.remove();
    const setTop = () => A.setTop($('#content').getBoundingClientRect().top);
    setTop(); window.addEventListener('resize', setTop);
  }

  newTab(false);
})();
