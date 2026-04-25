/* ══════════════════════════════════════════
   BUURTWERK VENNING — app.js
   Logica gebaseerd op broncode_kladblok.ps1
   Layout op buurtwerk_venning_volledig.html
══════════════════════════════════════════ */

'use strict';

var APP_VERSION = '2.9.3';

/* ══════════════════════════════════════════
   FIREBASE CONFIG & INIT
══════════════════════════════════════════ */
var _fbConfig = {
  apiKey: "AIzaSyDt6GX4DLd_7q7HgnkQU0IHuHk9tWiGxH8",
  authDomain: "buurtwerk-1b254.firebaseapp.com",
  projectId: "buurtwerk-1b254",
  storageBucket: "buurtwerk-1b254.firebasestorage.app",
  messagingSenderId: "202662610346",
  appId: "1:202662610346:web:a5f620dee6960c1e03d7d3",
  measurementId: "G-6WE2VPG30D"
};
firebase.initializeApp(_fbConfig);
var _fs      = firebase.firestore();
var _auth    = firebase.auth();
var _storage = firebase.storage();

/* ── HELPERS ── */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function nu() {
  return new Date().toISOString();
}

function huidigJaar() {
  return new Date().getFullYear();
}

function geldbedrag(n) {
  return '€' + parseFloat(n || 0).toFixed(2).replace('.', ',');
}

function parseBedrag(s) {
  return parseFloat((s || '0').replace(',', '.')) || 0;
}

function getInitials(naam) {
  if (!naam || !naam.trim()) return '?';
  return naam.trim().split(/\s+/).filter(Boolean)
    .map(function(w) { return w.charAt(0).toUpperCase(); }).join('');
}

function verkleenFoto(file, callback) {
  var maxB = 1200;
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var w = img.width, h = img.height;
      if (w > maxB) { h = Math.round(h * maxB / w); w = maxB; }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(function(blob) { callback(blob); }, 'image/jpeg', 0.85);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/* ══════════════════════════════════════════
   DATA  (Firestore + in-memory cache)
══════════════════════════════════════════ */
var DB = {
  _personen:    [],
  _individueel: [],
  _collectief:  [],
  _unsubs:      [],
  _uid:         null,
  _laadGereed:  0,

  // Geeft de Firestore-collectie voor de ingelogde gebruiker terug
  _col: function(naam) {
    return _fs.collection('users/' + DB._uid + '/' + naam);
  },

  // Getters — lezen uit cache
  get personen()    { return this._personen; },
  get individueel() { return this._individueel; },
  get collectief()  { return this._collectief; },

  // Start realtime-listeners naar Firestore (gebruiker-gekoppeld)
  startListeners: function() {
    DB._unsubs.forEach(function(u) { u(); });
    DB._unsubs = [];
    DB._laadGereed = 0;
    App.toast('Data laden\u2026', false, true);
    DB._unsubs.push(
      DB._col('personen').onSnapshot(function(snap) {
        DB._personen = snap.docs.map(function(d) { return d.data(); });
        if (DB._laadGereed < 3) { DB._laadGereed++; if (DB._laadGereed === 3) App.toast('Data geladen', true); }
        App._herlaadHuidigePagina();
      }, function(e) { console.error('personen listener:', e); })
    );
    DB._unsubs.push(
      DB._col('individueel').onSnapshot(function(snap) {
        DB._individueel = snap.docs.map(function(d) { return d.data(); });
        if (DB._laadGereed < 3) { DB._laadGereed++; if (DB._laadGereed === 3) App.toast('Data geladen', true); }
        App._herlaadHuidigePagina();
      }, function(e) { console.error('individueel listener:', e); })
    );
    DB._unsubs.push(
      DB._col('collectief').onSnapshot(function(snap) {
        DB._collectief = snap.docs.map(function(d) { return d.data(); });
        if (DB._laadGereed < 3) { DB._laadGereed++; if (DB._laadGereed === 3) App.toast('Data geladen', true); }
        App._herlaadHuidigePagina();
      }, function(e) { console.error('collectief listener:', e); })
    );
  },

  // Stop listeners en leeg cache bij uitloggen
  stopListeners: function() {
    DB._unsubs.forEach(function(u) { u(); });
    DB._unsubs = [];
    DB._personen = [];
    DB._individueel = [];
    DB._collectief = [];
    DB._uid = null;
    DB._laadGereed = 0;
  },

  // Detecteer wijzigingen en schrijf naar Firestore (users/{uid}/{colNaam})
  _syncLijst: function(colNaam, oudeLijst, nieuweLijst) {
    var schrijfOps = [];
    nieuweLijst.forEach(function(record) {
      var oud = oudeLijst.find(function(r) { return r.id === record.id; });
      if (!oud || JSON.stringify(oud) !== JSON.stringify(record)) {
        schrijfOps.push(DB._col(colNaam).doc(record.id).set(record));
      }
    });
    oudeLijst.forEach(function(r) {
      if (!nieuweLijst.find(function(p) { return p.id === r.id; })) {
        schrijfOps.push(DB._col(colNaam).doc(r.id).delete());
      }
    });
    if (schrijfOps.length) {
      Promise.all(schrijfOps)
        .then(function() {
          App.toast('Gegevens bijgewerkt', true);
        })
        .catch(function(e) {
          console.error('Firestore sync fout voor ' + colNaam + ':', e);
          App.toast('Sync fout: ' + e.message);
        });
    }
  },

  // Setters — update cache + Firestore
  slaPerOp: function(lijst) {
    var oud = this._personen.slice();
    this._personen = lijst;
    DB._syncLijst('personen', oud, lijst);
  },
  slaIndOp: function(lijst) {
    var oud = this._individueel.slice();
    this._individueel = lijst;
    DB._syncLijst('individueel', oud, lijst);
  },
  slaColOp: function(lijst) {
    var oud = this._collectief.slice();
    this._collectief = lijst;
    DB._syncLijst('collectief', oud, lijst);
  },

  // Volgnummer
  volgNummer: function() {
    var p = this._personen;
    if (!p.length) return 1;
    return Math.max.apply(null, p.map(function(x) { return x.volgnummer || 0; })) + 1;
  },

  // Unieke actienamen (collectief hoofdrecords)
  actieNamen: function() {
    return this._collectief
      .filter(function(r) { return !r.module && r.status === 'actief'; })
      .map(function(r) { return r.naamVanDeActie; })
      .filter(function(v, i, a) { return a.indexOf(v) === i; })
      .sort();
  }
};

/* ══════════════════════════════════════════
   STATE  (huidige wizard-data)
══════════════════════════════════════════ */
var State = {
  huidigePagina: 'pg-start',
  gekozenPersoon: null,    // persoon-object voor ind. actie
  huidigActie: null,       // naam van actie voor module
  perStap: 1,
  iaStap:  1,
  caStap:  1,
  // Tijdelijke uitgaven/inkomsten
  logUitgaven: [],
  actUitgaven: [],
  actInkomsten: [],
  // Foto URLs voor collectieve modules
  logFotoUrl: null,
  ovFotoUrl:  null,
  actFotoUrl: null,
  // Bewerkmodus ID's
  _bewerktIaId: null,
  _bewerktCaId: null,
  _bewerktModuleId: null
};

/* ══════════════════════════════════════════
   APP  (hoofd-object)
══════════════════════════════════════════ */
var App = {

  /* ── NAVIGATIE ── */
  nav: function(pagina) {
    document.querySelectorAll('.pagina').forEach(function(p) {
      p.classList.remove('actief');
    });
    var doel = document.getElementById(pagina);
    if (doel) {
      doel.classList.add('actief');
      // Scroll de interne wrap terug naar boven bij paginawissel
      var wrap = doel.querySelector('.wizard-wrap, .start-wrap, .dash-wrap');
      if (wrap) wrap.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      State.huidigePagina = pagina;
    }
    // Bottom navbar actieve tab bijwerken
    var _navMap = {
      'pg-individueel-start':'pg-individueel-start','pg-persoon-wiz':'pg-individueel-start','pg-ind-actie-wiz':'pg-individueel-start',
      'pg-collectief-start':'pg-collectief-start','pg-col-actie-wiz':'pg-collectief-start','pg-collectief-module':'pg-collectief-start',
      'pg-mod-logistiek':'pg-collectief-start','pg-mod-overleg':'pg-collectief-start','pg-mod-activiteit':'pg-collectief-start',
      'pg-jaarplan':'pg-jaarplan','pg-rapport-personen':'pg-jaarplan','pg-rapport-individueel':'pg-jaarplan',
      'pg-rapport-collectief':'pg-jaarplan','pg-jaarplan-mod':'pg-jaarplan','pg-persoon-detail':'pg-jaarplan',
      'pg-archief':'pg-archief',
      'pg-dashboard':'pg-dashboard'
    };
    var _actNav = _navMap[pagina] || 'pg-start';
    document.querySelectorAll('.bn-item').forEach(function(btn) {
      btn.classList.toggle('actief', btn.getAttribute('data-page') === _actNav);
    });
    // Init hooks
    if (pagina === 'pg-start')             App.renderStart();
    if (pagina === 'pg-individueel-start') App.renderIndStart();
    if (pagina === 'pg-collectief-start')  App.renderColStart();
    if (pagina === 'pg-jaarplan')          App.renderFotoOverzicht();
    if (pagina === 'pg-collectief-module') App.vulActieKeuze();
    if (pagina === 'pg-rapport-personen')  App.renderPersonenRap();
    if (pagina === 'pg-rapport-individueel') { App._vulIndFilter(); App.renderIndRap(); }
    if (pagina === 'pg-rapport-collectief')  { App._vulColFilter(); App.renderColRap(); }
    if (pagina === 'pg-archief')           App.renderArchief();
    if (pagina === 'pg-persoon-wiz')       App.resetPer();
    if (pagina === 'pg-ind-actie-wiz')     App.resetIa();
    if (pagina === 'pg-col-actie-wiz')     App.resetCa();
    if (pagina === 'pg-jaarplan-mod')      App.renderJaarplan();
    if (pagina === 'pg-dashboard')         App.renderDashboard();
  },

  /* ── UI HELPERS ── */
  toggle: function(el) {
    el.classList.toggle('geselecteerd');
  },

  enkeleKeuze: function(el, groepId) {
    var groep = document.getElementById(groepId);
    if (!groep) return;
    groep.querySelectorAll('.keuze').forEach(function(k) {
      k.classList.remove('geselecteerd');
    });
    el.classList.add('geselecteerd');
  },

  getKeuzes: function(id) {
    var groep = document.getElementById(id);
    if (!groep) return [];
    return Array.from(groep.querySelectorAll('.keuze.geselecteerd')).map(function(k) {
      return k.textContent.trim();
    });
  },

  getEnkele: function(id) {
    return App.getKeuzes(id)[0] || '';
  },

  teller: function(id, delta) {
    var inp = document.getElementById(id);
    if (!inp) return;
    var val = (parseInt(inp.value) || 0) + delta;
    if (val < 0) val = 0;
    inp.value = val;
    if (id === 'ca-vrijw') App.updateVrijwNames();
    if (id === 'ca-bewoners' || id === 'ca-vrijw') App.updateTotaal();
  },

  updateTotaal: function() {
    var bewoners = parseInt(document.getElementById('ca-bewoners').value) || 0;
    var vrijw    = parseInt(document.getElementById('ca-vrijw').value)    || 0;
    var totaal   = document.getElementById('ca-totaal');
    if (totaal) totaal.value = bewoners + vrijw;
  },

  toast: function(bericht, ok, permanent) {
    var t = document.getElementById('toast');
    t.textContent = bericht;
    t.className = 'toast toon' + (ok ? ' ok' : '');
    clearTimeout(App._toastTimer);
    if (!permanent) {
      App._toastTimer = setTimeout(function() {
        t.classList.remove('toon');
      }, 3000);
    }
  },

  succes: function(icon, titel, tekst, btn1Lbl, btn1Fn, btn2Lbl, btn2Fn) {
    document.getElementById('suc-icon').textContent  = icon;
    document.getElementById('suc-titel').textContent = titel;
    document.getElementById('suc-tekst').textContent = tekst;
    var b1 = document.getElementById('suc-btn1');
    var b2 = document.getElementById('suc-btn2');
    b1.textContent = btn1Lbl || '🏠 Naar start';
    b2.textContent = btn2Lbl || '➕ Nog een';
    b1.onclick = btn1Fn || function() { App.nav('pg-start'); };
    b2.onclick = btn2Fn || function() { App.nav('pg-start'); };
    App.nav('pg-succes');
  },

  toggleSignalen: function(prefix, toon) {
    var wrap = document.getElementById(prefix + '-signaal-types');
    if (wrap) wrap.style.display = toon ? 'block' : 'none';
  },

  /* ── LIGHTBOX ── */
  openLightbox: function(url) {
    var lb  = document.getElementById('lightbox');
    var img = document.getElementById('lightbox-img');
    if (!lb || !img) { window.open(url, '_blank'); return; }
    img.src = url;
    lb.style.display = 'flex';
  },
  closeLightbox: function() {
    var lb  = document.getElementById('lightbox');
    var img = document.getElementById('lightbox-img');
    if (lb)  lb.style.display  = 'none';
    if (img) img.src = '';
  },

  /* ── START RENDER ── */
  renderStart: function() {
    var per = DB.personen.filter(function(p) { return p.status === 'actief'; });
    var ind = DB.individueel.filter(function(i) { return i.status === 'actief'; });
    var col = DB.collectief.filter(function(c) { return !c.module && c.status === 'actief'; });
    var alle = [];
    ind.forEach(function(a) {
      var p = per.find(function(x) { return x.volgnummer === a.persoonNummer; });
      var init = p ? getInitials(p.voornaam + ' ' + p.familienaam) : 'P#' + a.persoonNummer;
      alle.push({ datum: a.datum, label: init, meta: a.maand + ' — ' + (a.tijd || '?'), badge: 'badge-groen', badgeTxt: 'Individueel', pagina: 'pg-rapport-individueel' });
    });
    col.forEach(function(a) {
      alle.push({ datum: a.datum, label: a.naamVanDeActie, meta: a.maand + ' — ' + a.aantalBewoners + ' bewoners', badge: 'badge-blauw', badgeTxt: 'Collectief', pagina: 'pg-rapport-collectief' });
    });
    alle.sort(function(a, b) { return b.datum < a.datum ? -1 : 1; });
    var html = '';
    alle.forEach(function(item) {
      var klik = item.pagina ? 'onclick="App.nav(\'' + item.pagina + '\')" style="cursor:pointer"' : '';
      html += '<div class="mini-kaart" ' + klik + '>' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
        '<div class="mini-kaart-info"><div class="mini-kaart-naam">' + App.esc(item.label) + '</div>' +
        '<div class="mini-kaart-meta">' + App.esc(item.meta) + '</div></div>' +
        '<span class="mini-badge ' + item.badge + '">' + item.badgeTxt + '</span></div></div>';
    });
    if (!alle.length) html = '<div style="color:var(--zacht);font-size:0.9rem">Nog geen registraties.</div>';
    document.getElementById('start-recente').innerHTML = html;
  },

  renderIndStart: function() {
    var per = DB.personen.filter(function(p) { return p.status === 'actief'; });
    var ind = DB.individueel.filter(function(a) { return a.status === 'actief'; });
    var perMap = {};
    per.forEach(function(p) { perMap[p.volgnummer] = p; });
    per.sort(function(a, b) { return (b.aangemaakt || '') > (a.aangemaakt || '') ? 1 : -1; });
    ind.sort(function(a, b) { return (b.datum || '') > (a.datum || '') ? 1 : -1; });

    // Combineer en sorteer op datum
    var alle = [];
    per.slice(0, 5).forEach(function(p) {
      alle.push({ datum: p.aangemaakt || '', soort: 'persoon', item: p });
    });
    ind.slice(0, 5).forEach(function(a) {
      alle.push({ datum: a.datum || '', soort: 'actie', item: a });
    });
    alle.sort(function(a, b) { return b.datum > a.datum ? 1 : -1; });

    var html = '';
    alle.slice(0, 8).forEach(function(entry) {
      if (entry.soort === 'persoon') {
        var p = entry.item;
        html += '<div class="mini-kaart" style="flex-direction:row;justify-content:space-between;align-items:center">' +
          '<div class="mini-kaart-info"><div class="mini-kaart-naam">' + App.esc(getInitials(p.voornaam + ' ' + p.familienaam)) + '</div>' +
          '<div class="mini-kaart-meta">Nr. ' + p.volgnummer + (p.gemeente ? ' — ' + App.esc(p.gemeente) : '') + '</div></div>' +
          '<div style="display:flex;align-items:center;gap:6px">' +
          '<span class="mini-badge badge-groen">Persoon</span>' +
          '<button class="mini-kaart-btn" onclick="App.bekijkPersoon(\'' + p.id + '\')">Bewerk</button>' +
          '</div></div>';
      } else {
        var a = entry.item;
        var p2 = perMap[a.persoonNummer];
        var naam = p2 ? getInitials(p2.voornaam + ' ' + p2.familienaam) : 'P#' + a.persoonNummer;
        html += '<div class="mini-kaart" style="flex-direction:row;justify-content:space-between;align-items:center">' +
          '<div class="mini-kaart-info"><div class="mini-kaart-naam">' + App.esc(naam) + '</div>' +
          '<div class="mini-kaart-meta">' + App.esc(a.maand || '') + ' ' + (a.jaar || '') + ' — ' + App.esc((a.methodiek || []).join(', ') || '—') + '</div></div>' +
          '<div style="display:flex;align-items:center;gap:6px">' +
          '<span class="mini-badge badge-blauw">Actie</span>' +
          '<button class="mini-kaart-btn" onclick="App.laadIaBewerk(\'' + a.id + '\')">Bewerk</button>' +
          '</div></div>';
      }
    });
    var el = document.getElementById('ind-recente-personen');
    if (el) el.innerHTML = html || '<div style="color:var(--zacht);font-size:0.9rem">Nog geen registraties.</div>';
  },

  renderColStart: function() {
    var badgeKleur = { '': 'badge-groen', 'Logistiek': 'badge-blauw', 'Overleg': 'badge-paars', 'Activiteit': 'badge-oranje' };
    var alle = DB.collectief.filter(function(c) { return c.status === 'actief'; });
    alle.sort(function(a, b) { return (b.datum || '') > (a.datum || '') ? 1 : -1; });
    var html = '';
    alle.slice(0, 8).forEach(function(c) {
      var type = c.module || '';
      var badge = badgeKleur[type] || 'badge-groen';
      var typeLabel = type || 'Actie';
      var meta = (c.maand || '') + ' ' + (c.jaar || '');
      if (!c.module) meta += ' — ' + (c.aantalBewoners || 0) + ' bewoners';
      else meta += ' — ' + App.esc(c.naamVanDeActie || '');
      html += '<div class="mini-kaart">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
        '<div><div class="mini-kaart-naam">' + App.esc(c.module ? (typeLabel + ': ' + c.naamVanDeActie) : c.naamVanDeActie) + '</div>' +
        '<div class="mini-kaart-meta">' + meta + '</div></div>' +
        '<span class="mini-badge ' + badge + '">' + typeLabel + '</span>' +
        '</div>' +
        '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
        (c.module
          ? '<button onclick="App.laadModuleBewerk(\'' + c.id + '\')" style="background:var(--groen);color:white;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.78rem;font-weight:600">Bewerk</button>'
          : '<button onclick="App.laadCaBewerk(\'' + c.id + '\')" style="background:var(--groen);color:white;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.78rem;font-weight:600">Bewerk</button>') +
        '<button onclick="App.nav(\'pg-rapport-collectief\')" style="background:var(--blauw);color:white;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.78rem;font-weight:600">Bekijk</button>' +
        '<button onclick="App.archiveerRecord(\'' + c.id + '\',\'collectief\')" style="background:var(--oranje);color:white;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.78rem;font-weight:600">Archiveer</button>' +
        '</div></div>';
    });
    var el = document.getElementById('col-recente');
    if (el) el.innerHTML = html || '<div style="color:var(--zacht);font-size:0.9rem">Nog geen collectieve acties.</div>';
  },

  esc: function(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  /* ══════════════════════════════════════
     PERSOON WIZARD
  ══════════════════════════════════════ */
  resetPer: function() {
    var isEdit = !!State._bewerktPersoId;
    State.perStap = 1;
    if (!isEdit) {
      State._bewerktPersoId = null;
      ['per-voornaam','per-familienaam','per-adres','per-postcode','per-gemeente','per-notitie'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
      ['per-leeftijd','per-inkomen','per-woon','per-woonsituatie','per-eerste','per-type','per-gekend-bij'].forEach(function(id) {
        App._resetKeuzes(id);
      });
      App._clearDubbeleNaam();
      // Herstel originele header en terug-knop
      var wh = document.querySelector('#pg-persoon-wiz .wiz-header h1');
      var wp = document.querySelector('#pg-persoon-wiz .wiz-header p');
      if (wh) wh.textContent = '👤 Persoon registreren';
      if (wp) wp.textContent = 'Vul de gegevens in van de nieuwe persoon';
      var terugBtn = document.querySelector('#pg-persoon-wiz .terug-link button');
      if (terugBtn) {
        terugBtn.textContent = '← Individueel';
        terugBtn.onclick = function() { App.nav('pg-individueel-start'); };
      }
    }
    App.perStap(1);
  },

  /* ── Duplikaat naam-controle ── */
  _checkDubbeleNaam: function() {
    var vnEl = document.getElementById('per-voornaam');
    var fnEl = document.getElementById('per-familienaam');
    if (!vnEl || !fnEl) return;
    var vn = vnEl.value.trim().toLowerCase();
    var fn = fnEl.value.trim().toLowerCase();
    if (!vn || !fn) { App._clearDubbeleNaam(); return; }
    var editId = State._bewerktPersoId || null;
    var dubbel = DB.personen.filter(function(p) { return p.status === 'actief' && p.id !== editId; })
      .find(function(p) {
        return p.voornaam.trim().toLowerCase() === vn &&
               p.familienaam.trim().toLowerCase() === fn;
      });
    if (dubbel) {
      vnEl.style.borderColor = 'var(--rood)';
      fnEl.style.borderColor = 'var(--rood)';
      var msg = document.getElementById('per-dubbel-msg');
      if (msg) {
        msg.textContent = '⚠️ ' + dubbel.voornaam + ' ' + dubbel.familienaam +
          ' bestaat al (nr. ' + dubbel.volgnummer + '). Pas de naam aan om door te gaan.';
        msg.style.display = 'block';
      }
      var verder  = document.querySelector('#per-s1 .btn-volgende');
      var opslaan = document.querySelector('#per-s3 .btn-volgende.opslaan');
      if (verder)  { verder.disabled  = true; verder.style.opacity  = '0.45'; verder.style.cursor  = 'not-allowed'; }
      if (opslaan) { opslaan.disabled = true; opslaan.style.opacity = '0.45'; opslaan.style.cursor = 'not-allowed'; }
      State._perDubbel = true;
    } else {
      App._clearDubbeleNaam();
    }
  },

  _clearDubbeleNaam: function() {
    var vnEl = document.getElementById('per-voornaam');
    var fnEl = document.getElementById('per-familienaam');
    if (vnEl) vnEl.style.borderColor = '';
    if (fnEl) fnEl.style.borderColor = '';
    var msg = document.getElementById('per-dubbel-msg');
    if (msg) { msg.textContent = ''; msg.style.display = 'none'; }
    var verder  = document.querySelector('#per-s1 .btn-volgende');
    var opslaan = document.querySelector('#per-s3 .btn-volgende.opslaan');
    if (verder)  { verder.disabled  = false; verder.style.opacity  = ''; verder.style.cursor  = ''; }
    if (opslaan) { opslaan.disabled = false; opslaan.style.opacity = ''; opslaan.style.cursor = ''; }
    State._perDubbel = false;
  },

  _resetKeuzes: function(id) {
    var groep = document.getElementById(id);
    if (!groep) return;
    groep.querySelectorAll('.keuze').forEach(function(k) { k.classList.remove('geselecteerd'); });
  },

  _setKeuzes: function(id, waarden) {
    var groep = document.getElementById(id);
    if (!groep) return;
    groep.querySelectorAll('.keuze').forEach(function(k) {
      if (waarden && waarden.indexOf(k.textContent.trim()) !== -1) {
        k.classList.add('geselecteerd');
      } else {
        k.classList.remove('geselecteerd');
      }
    });
  },

  perStap: function(n) {
    State.perStap = n;
    // Valideer stap 1
    if (n > 1) {
      var vn = document.getElementById('per-voornaam').value.trim();
      var fn = document.getElementById('per-familienaam').value.trim();
      if (!vn || !fn) {
        App.toast('Voornaam en familienaam zijn verplicht.');
        State.perStap = 1;
        n = 1;
      }
    }
    [1,2,3].forEach(function(i) {
      var s = document.getElementById('per-s' + i);
      if (s) s.style.display = i === n ? 'block' : 'none';
      var ind = document.getElementById('per-stap-' + i);
      if (ind) {
        ind.classList.remove('actief','klaar');
        if (i < n) ind.classList.add('klaar');
        if (i === n) ind.classList.add('actief');
      }
    });
    var ww = document.querySelector('#pg-persoon-wiz .wizard-wrap');
    if (ww) ww.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  slaPerOp: function() {
    var voornaam    = document.getElementById('per-voornaam').value.trim();
    var familienaam = document.getElementById('per-familienaam').value.trim();
    if (!voornaam || !familienaam) {
      App.toast('Voornaam en familienaam zijn verplicht.');
      return;
    }

    // BEWERK MODUS
    if (State._bewerktPersoId) {
      var editId = State._bewerktPersoId;
      var lijst = DB.personen.map(function(p) {
        if (p.id === editId) {
          p.voornaam      = voornaam;
          p.familienaam   = familienaam;
          p.adres         = document.getElementById('per-adres').value.trim();
          p.postcode      = document.getElementById('per-postcode').value.trim();
          p.gemeente      = document.getElementById('per-gemeente').value.trim();
          p.leeftijd      = App.getEnkele('per-leeftijd');
          p.inkomen       = App.getKeuzes('per-inkomen');
          p.huisvesting   = App.getKeuzes('per-woon');
          p.woonsituatie  = App.getEnkele('per-woonsituatie');
          p.eersteContact = App.getEnkele('per-eerste');
          p.type          = App.getKeuzes('per-type');
          p.gekendBij     = App.getKeuzes('per-gekend-bij');
          p.notitie       = document.getElementById('per-notitie').value.trim();
          p.gewijzigd     = nu();
        }
        return p;
      });
      DB.slaPerOp(lijst);
      State._bewerktPersoId = null;
      App.toast('Persoon bijgewerkt.', true);
      App.nav('pg-rapport-personen');
      return;
    }

    // NIEUW MODUS — duplicaat-controle
    var bestaande = DB.personen.filter(function(p) { return p.status === 'actief'; });
    var dubbel = bestaande.find(function(p) {
      return p.voornaam.toLowerCase() === voornaam.toLowerCase() &&
             p.familienaam.toLowerCase() === familienaam.toLowerCase();
    });
    if (dubbel) {
      if (!confirm('⚠️ ' + voornaam + ' ' + familienaam + ' bestaat al (nr. ' + dubbel.volgnummer + '). Toch opslaan als nieuwe persoon?')) {
        return;
      }
    }
    var record = {
      id:            uuid(),
      volgnummer:    DB.volgNummer(),
      voornaam:      voornaam,
      familienaam:   familienaam,
      adres:         document.getElementById('per-adres').value.trim(),
      postcode:      document.getElementById('per-postcode').value.trim(),
      gemeente:      document.getElementById('per-gemeente').value.trim(),
      leeftijd:      App.getEnkele('per-leeftijd'),
      inkomen:       App.getKeuzes('per-inkomen'),
      huisvesting:   App.getKeuzes('per-woon'),
      woonsituatie:  App.getEnkele('per-woonsituatie'),
      eersteContact: App.getEnkele('per-eerste'),
      type:          App.getKeuzes('per-type'),
      gekendBij:     App.getKeuzes('per-gekend-bij'),
      notitie:       document.getElementById('per-notitie').value.trim(),
      aangemaakt:    nu(),
      status:        'actief'
    };
    var lijst2 = DB.personen.slice();
    lijst2.push(record);
    DB.slaPerOp(lijst2);
    App.succes('✅', 'Persoon opgeslagen!',
      voornaam + ' ' + familienaam + ' — nr. ' + record.volgnummer,
      '🏠 Naar start', function() { App.nav('pg-start'); },
      '➕ Nieuwe persoon', function() { App.nav('pg-persoon-wiz'); }
    );
  },

  /* ══════════════════════════════════════
     INDIVIDUELE ACTIE WIZARD
  ══════════════════════════════════════ */
  resetIa: function() {
    var isEdit = !!State._bewerktIaId;
    State.iaStap = 1;
    if (!isEdit) {
      State._bewerktIaId = null;
      State.gekozenPersoon = null;
      document.getElementById('ia-zoek').value = '';
      document.getElementById('ia-zoek-resultaten').innerHTML = '';
      document.getElementById('ia-gekozen-persoon').style.display = 'none';
      ['ia-maand','ia-vindplaats','ia-tijd','ia-leven','ia-methodiek','ia-toeleiding'].forEach(function(id) {
        App._resetKeuzes(id);
      });
      var jaarEl = document.getElementById('ia-jaar');
      if (jaarEl) jaarEl.value = new Date().getFullYear();
      var el = document.getElementById('ia-extra');
      if (el) el.value = '';
      var wh = document.querySelector('#pg-ind-actie-wiz .wiz-header h1');
      if (wh) wh.textContent = 'Individuele actie';
      var terugBtn = document.querySelector('#pg-ind-actie-wiz .terug-link button');
      if (terugBtn) {
        terugBtn.textContent = '← Individueel';
        terugBtn.onclick = function() { App.nav('pg-individueel-start'); };
      }
    }
    App.iaStap(1);
  },

  iaStap: function(n) {
    if (n === 2 && !State.gekozenPersoon) {
      App.toast('Selecteer eerst een persoon.');
      return;
    }
    State.iaStap = n;
    [1,2,3].forEach(function(i) {
      var s = document.getElementById('ia-s' + i);
      if (s) s.style.display = i === n ? 'block' : 'none';
      var ind = document.getElementById('ia-stap-' + i);
      if (ind) {
        ind.classList.remove('actief','klaar');
        if (i < n) ind.classList.add('klaar');
        if (i === n) ind.classList.add('actief');
      }
    });
    var ww = document.querySelector('#pg-ind-actie-wiz .wizard-wrap');
    if (ww) ww.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  zoekPersoon: function() {
    var q = document.getElementById('ia-zoek').value.trim().toLowerCase();
    var resultDiv = document.getElementById('ia-zoek-resultaten');
    if (!q) { resultDiv.innerHTML = ''; return; }
    var personen = DB.personen.filter(function(p) {
      return p.status === 'actief' &&
        (p.voornaam + ' ' + p.familienaam).toLowerCase().indexOf(q) !== -1;
    });
    if (!personen.length) {
      resultDiv.innerHTML = '<div style="color:var(--zacht);font-size:0.9rem;margin-top:8px">Geen resultaten.</div>';
      return;
    }
    var html = personen.slice(0, 8).map(function(p) {
      return '<div class="persoon-resultaat" onclick="App.kiesPersoon(' + p.volgnummer + ')">' +
        '<div class="pr-naam">' + App.esc(p.voornaam + ' ' + p.familienaam) + '</div>' +
        '<div class="pr-meta">Nr. ' + p.volgnummer + (p.gemeente ? ' — ' + App.esc(p.gemeente) : '') + '</div>' +
        '</div>';
    }).join('');
    resultDiv.innerHTML = html;
  },

  kiesPersoon: function(volgnummer) {
    var p = DB.personen.find(function(x) { return x.volgnummer === volgnummer; });
    if (!p) return;
    State.gekozenPersoon = p;
    document.getElementById('ia-zoek-resultaten').innerHTML = '';
    var el = document.getElementById('ia-gekozen-persoon');
    el.textContent = '✓ ' + p.voornaam + ' ' + p.familienaam + ' (nr. ' + p.volgnummer + ')';
    el.style.display = 'block';
    document.getElementById('ia-zoek').value = p.voornaam + ' ' + p.familienaam;
  },

  slaIaOp: function() {
    if (!State.gekozenPersoon) {
      App.toast('Geen persoon geselecteerd.');
      return;
    }
    var maand = App.getEnkele('ia-maand');
    if (!maand) { App.toast('Selecteer een maand.'); return; }
    var jaarInput = document.getElementById('ia-jaar');
    var jaar = jaarInput ? (parseInt(jaarInput.value) || huidigJaar()) : huidigJaar();
    var editId = State._bewerktIaId;
    if (editId) {
      var lijst = DB.individueel.slice();
      var idx = -1;
      for (var i = 0; i < lijst.length; i++) { if (lijst[i].id === editId) { idx = i; break; } }
      if (idx !== -1) {
        lijst[idx] = Object.assign({}, lijst[idx], {
          persoonNummer: State.gekozenPersoon.volgnummer,
          maand:         maand,
          jaar:          jaar,
          vindplaats:    App.getKeuzes('ia-vindplaats'),
          levensdomein:  App.getKeuzes('ia-leven'),
          methodiek:     App.getKeuzes('ia-methodiek'),
          extraInfo:     document.getElementById('ia-extra').value.trim(),
          toeleiding:    App.getKeuzes('ia-toeleiding'),
          tijd:          App.getEnkele('ia-tijd')
        });
      }
      DB.slaIndOp(lijst);
      State._bewerktIaId = null;
      var p = State.gekozenPersoon;
      App.succes('✅', 'Actie bijgewerkt!',
        'Actie voor ' + p.voornaam + ' ' + p.familienaam + ' — ' + maand,
        '🏠 Naar start', function() { App.nav('pg-start'); },
        '⚡ Andere actie', function() { App.nav('pg-ind-actie-wiz'); }
      );
      return;
    }
    var record = {
      id:            uuid(),
      persoonNummer: State.gekozenPersoon.volgnummer,
      maand:         maand,
      jaar:          jaar,
      vindplaats:    App.getKeuzes('ia-vindplaats'),
      levensdomein:  App.getKeuzes('ia-leven'),
      methodiek:     App.getKeuzes('ia-methodiek'),
      extraInfo:     document.getElementById('ia-extra').value.trim(),
      toeleiding:    App.getKeuzes('ia-toeleiding'),
      tijd:          App.getEnkele('ia-tijd'),
      datum:         nu(),
      status:        'actief'
    };
    var lijst2 = DB.individueel.slice();
    lijst2.push(record);
    DB.slaIndOp(lijst2);
    var p2 = State.gekozenPersoon;
    App.succes('✅', 'Actie opgeslagen!',
      'Actie voor ' + p2.voornaam + ' ' + p2.familienaam + ' — ' + maand,
      '🏠 Naar start', function() { App.nav('pg-start'); },
      '⚡ Nog een actie', function() { App.nav('pg-ind-actie-wiz'); }
    );
  },

  /* ══════════════════════════════════════
     COLLECTIEVE ACTIE WIZARD
  ══════════════════════════════════════ */
  startNieuweCollActie: function() {
    App.nav('pg-col-actie-wiz');
  },

  resetCa: function() {
    var isEdit = !!State._bewerktCaId;
    State.caStap = 1;
    if (!isEdit) {
      State._bewerktCaId = null;
      ['ca-maand','ca-type','ca-duur','ca-cluster','ca-thema'].forEach(function(id) {
        App._resetKeuzes(id);
      });
      var naam = document.getElementById('ca-naam');
      if (naam) naam.value = '';
      var jaar = document.getElementById('ca-jaar');
      if (jaar) jaar.value = new Date().getFullYear();
      var buurt = document.getElementById('ca-buurt');
      if (buurt) buurt.value = 'centrum 2: venning';
      document.getElementById('ca-bewoners').value = 0;
      document.getElementById('ca-nieuw').value = 0;
      document.getElementById('ca-vrijw').value = 0;
      document.getElementById('ca-vrijw-namen').innerHTML = '';
      var totaal = document.getElementById('ca-totaal');
      if (totaal) totaal.value = 0;
      var partner = document.getElementById('ca-partner');
      if (partner) partner.value = '';
      var wh = document.querySelector('#pg-col-actie-wiz .wiz-header h1');
      if (wh) wh.textContent = 'Collectieve actie';
      var terugBtn = document.querySelector('#pg-col-actie-wiz .terug-link button');
      if (terugBtn) {
        terugBtn.textContent = '← Collectief';
        terugBtn.onclick = function() { App.nav('pg-collectief-start'); };
      }
    }
    App.caStap(1);
    App.renderCaNaamSuggesties();
  },

  renderCaNaamSuggesties: function() {
    var namen = DB.actieNamen();
    var div = document.getElementById('ca-naam-suggesties');
    if (!div || !namen.length) return;
    var html = '<div style="font-size:0.78rem;color:var(--zacht);margin-bottom:6px;font-weight:700">Bestaande namen:</div>';
    html += '<div class="keuzes">';
    namen.forEach(function(n) {
      html += '<div class="keuze" onclick="document.getElementById(\'ca-naam\').value=\'' + App.esc(n) + '\'">' + App.esc(n) + '</div>';
    });
    html += '</div>';
    div.innerHTML = html;
  },

  caStap: function(n) {
    if (n === 2) {
      var nm = document.getElementById('ca-naam').value.trim();
      var maand = App.getEnkele('ca-maand');
      if (!nm) { App.toast('Naam van de actie is verplicht.'); return; }
      if (!maand) { App.toast('Selecteer een maand.'); return; }
    }
    State.caStap = n;
    [1,2,3].forEach(function(i) {
      var s = document.getElementById('ca-s' + i);
      if (s) s.style.display = i === n ? 'block' : 'none';
      var ind = document.getElementById('ca-stap-' + i);
      if (ind) {
        ind.classList.remove('actief','klaar');
        if (i < n) ind.classList.add('klaar');
        if (i === n) ind.classList.add('actief');
      }
    });
    var ww = document.querySelector('#pg-col-actie-wiz .wizard-wrap');
    if (ww) ww.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  updateVrijwNames: function() {
    var n = parseInt(document.getElementById('ca-vrijw').value) || 0;
    var div = document.getElementById('ca-vrijw-namen');
    if (!n) { div.innerHTML = ''; return; }
    var html = '<div class="vraag"><div class="vraag-label">Namen vrijwilligers</div>';
    for (var i = 1; i <= n; i++) {
      html += '<input type="text" id="ca-vw-' + i + '" placeholder="Naam vrijwilliger ' + i + '" style="margin-bottom:8px">';
    }
    html += '</div>';
    div.innerHTML = html;
  },

  slaCaOp: function() {
    var naamVanDeActie = document.getElementById('ca-naam').value.trim();
    var maand = App.getEnkele('ca-maand');
    if (!naamVanDeActie || !maand) { App.toast('Naam en maand zijn verplicht.'); return; }
    var n = parseInt(document.getElementById('ca-vrijw').value) || 0;
    var namen = [];
    for (var i = 1; i <= n; i++) {
      var el = document.getElementById('ca-vw-' + i);
      if (el && el.value.trim()) namen.push(el.value.trim());
    }
    var jaarInput = document.getElementById('ca-jaar');
    var jaar = jaarInput ? (parseInt(jaarInput.value) || huidigJaar()) : huidigJaar();
    var aantalBewoners = parseInt(document.getElementById('ca-bewoners').value) || 0;
    var editId = State._bewerktCaId;
    if (editId) {
      var lijst = DB.collectief.slice();
      var idx = -1;
      for (var j = 0; j < lijst.length; j++) { if (lijst[j].id === editId) { idx = j; break; } }
      if (idx !== -1) {
        lijst[idx] = Object.assign({}, lijst[idx], {
          maand:                 maand,
          jaar:                  jaar,
          naamVanDeActie:        naamVanDeActie,
          cluster:               App.getKeuzes('ca-cluster'),
          thema:                 App.getKeuzes('ca-thema'),
          typeActie:             App.getKeuzes('ca-type'),
          buurt:                 (document.getElementById('ca-buurt') || {}).value || 'centrum 2: venning',
          duur:                  App.getEnkele('ca-duur'),
          aantalBewoners:        aantalBewoners,
          waarvanNieuweBewoners: parseInt(document.getElementById('ca-nieuw').value) || 0,
          aantalVrijwilligers:   n,
          totaal:                aantalBewoners + n,
          naamVrijwilligers:     namen,
          naamPartner:           document.getElementById('ca-partner').value.trim()
        });
      }
      DB.slaColOp(lijst);
      State._bewerktCaId = null;
      App.succes('✅', 'Collectieve actie bijgewerkt!',
        naamVanDeActie + ' — ' + maand,
        '🏠 Naar start', function() { App.nav('pg-start'); },
        '🔗 Module toevoegen', function() {
          State.huidigActie = naamVanDeActie;
          App.nav('pg-collectief-module');
        }
      );
      return;
    }
    var record = {
      id:                    uuid(),
      module:                null,
      maand:                 maand,
      jaar:                  jaar,
      naamVanDeActie:        naamVanDeActie,
      cluster:               App.getKeuzes('ca-cluster'),
      thema:                 App.getKeuzes('ca-thema'),
      typeActie:             App.getKeuzes('ca-type'),
      buurt:                 (document.getElementById('ca-buurt') || {}).value || 'centrum 2: venning',
      duur:                  App.getEnkele('ca-duur'),
      aantalBewoners:        aantalBewoners,
      waarvanNieuweBewoners: parseInt(document.getElementById('ca-nieuw').value) || 0,
      aantalVrijwilligers:   n,
      totaal:                aantalBewoners + n,
      naamVrijwilligers:     namen,
      naamPartner:           document.getElementById('ca-partner').value.trim(),
      datum:                 nu(),
      status:                'actief'
    };
    var lijst2 = DB.collectief.slice();
    lijst2.push(record);
    DB.slaColOp(lijst2);
    App.succes('✅', 'Collectieve actie opgeslagen!',
      naamVanDeActie + ' — ' + maand,
      '🏠 Naar start', function() { App.nav('pg-start'); },
      '🔗 Module toevoegen', function() {
        State.huidigActie = naamVanDeActie;
        App.nav('pg-collectief-module');
      }
    );
  },

  /* ══════════════════════════════════════
     MODULES
  ══════════════════════════════════════ */
  vulActieKeuze: function() {
    var sel = document.getElementById('mod-actie-keuze');
    if (!sel) return;
    var namen = DB.actieNamen();
    var html = '<option value="">— Selecteer een actie —</option>';
    namen.forEach(function(n) {
      var selected = n === State.huidigActie ? ' selected' : '';
      html += '<option value="' + App.esc(n) + '"' + selected + '>' + App.esc(n) + '</option>';
    });
    sel.innerHTML = html;
  },

  selecteerModActie: function(naam) {
    State.huidigActie = naam;
  },

  startModule: function(type) {
    if (!State.huidigActie) {
      App.toast('Selecteer eerst een actie hierboven.');
      return;
    }
    var vandaag = new Date().toISOString().substr(0, 10);
    if (type === 'Logistiek') {
      App._resetKeuzes('log-type');
      App._resetKeuzes('log-signalen');
      App._resetKeuzes('log-sig-types');
      document.getElementById('log-datum').value = vandaag;
      document.getElementById('log-notitie').value = '';
      document.getElementById('log-signaal-types').style.display = 'none';
      document.getElementById('log-actienaam-lbl').textContent = State.huidigActie;
      State.logUitgaven = [];
      State.logFotoUrl = null;
      App.renderKostLijst('log-uitgaven-lijst', State.logUitgaven, 'log');
      App._resetModuleFotoUI('log');
      App.nav('pg-mod-logistiek');
    } else if (type === 'Overleg') {
      App._resetKeuzes('ov-signalen');
      App._resetKeuzes('ov-sig-types');
      document.getElementById('ov-datum').value = vandaag;
      document.getElementById('ov-notitie').value = '';
      document.getElementById('ov-signaal-types').style.display = 'none';
      document.getElementById('ov-actienaam-lbl').textContent = State.huidigActie;
      State.ovFotoUrl = null;
      App._resetModuleFotoUI('ov');
      App.nav('pg-mod-overleg');
    } else if (type === 'Activiteit') {
      App._resetKeuzes('act-locatie');
      App._resetKeuzes('act-type');
      App._resetKeuzes('act-participatie');
      App._resetKeuzes('act-doel');
      App._resetKeuzes('act-signalen');
      App._resetKeuzes('act-sig-types');
      document.getElementById('act-locatie-vrij').value = '';
      document.getElementById('act-notitie').value = '';
      document.getElementById('act-signaal-types').style.display = 'none';
      document.getElementById('act-impact-wrap').style.display = 'none';
      document.getElementById('act-actienaam-lbl').textContent = State.huidigActie;
      State.actUitgaven = [];
      State.actInkomsten = [];
      State.actFotoUrl = null;
      App.renderKostLijst('act-uitgaven-lijst', State.actUitgaven, 'act-ug');
      App.renderKostLijst('act-inkomsten-lijst', State.actInkomsten, 'act-ik');
      App.updateFinTotaal();
      App._resetModuleFotoUI('act');
      App.nav('pg-mod-activiteit');
    }
  },

  /* ── Module foto upload ── */
  _resetModuleFotoUI: function(prefix) {
    var preview = document.getElementById(prefix + '-foto-preview');
    if (preview) { preview.style.display = 'none'; preview.textContent = ''; }
  },

  _uploadModuleFoto: function(prefix, input) {
    var file = input.files[0];
    if (!file) return;
    var preview = document.getElementById(prefix + '-foto-preview');
    if (preview) {
      preview.style.display = 'inline-flex';
      preview.innerHTML = '<span style="color:var(--oranje);font-weight:600;font-size:0.82rem">⏳ Foto verkleinen en uploaden…</span>';
    }
    verkleenFoto(file, function(blob) {
      var nu2 = new Date();
      var datumTijd = nu2.toISOString().substr(0, 16).replace(/[-T:]/g, '');
      var modulenaam = prefix === 'log' ? 'Logistiek' : prefix === 'ov' ? 'Overleg' : 'Activiteit';
      var bestandsnaam = modulenaam + '_' + datumTijd + '.jpg';
      var ref = _storage.ref('bewijzen/collectief/' + bestandsnaam);
      ref.put(blob, { contentType: 'image/jpeg' }).then(function() {
        if (preview) preview.innerHTML = '<span style="color:var(--oranje);font-weight:600;font-size:0.82rem">⏳ Bezig met opslaan…</span>';
        return ref.getDownloadURL();
      }).then(function(url) {
        if (prefix === 'log') State.logFotoUrl = url;
        else if (prefix === 'ov') State.ovFotoUrl = url;
        else State.actFotoUrl = url;
        if (preview) {
          preview.style.display = 'inline-flex';
          preview.innerHTML = '<span onclick="App.openLightbox(this.dataset.url)" data-url="' + App.esc(url) + '" style="color:var(--groen);font-weight:700;cursor:pointer">✅ Foto opgeslagen — bekijk</span>';
        }
        App.toast('Foto opgeslagen.', true);
      }).catch(function(err) {
        if (preview) {
          preview.style.display = 'inline-flex';
          preview.innerHTML = '<span style="color:var(--rood);font-size:0.82rem">❌ Upload mislukt</span>';
        }
        App.toast('Upload mislukt: ' + (err.message || err));
      });
    });
  },

  /* ── Kosten UI ── */
  renderKostLijst: function(containerId, lijst, prefix) {
    var div = document.getElementById(containerId);
    if (!div) return;
    if (!lijst.length) { div.innerHTML = ''; return; }
    var isUg = prefix !== 'act-ik';
    var html = '';
    lijst.forEach(function(item, i) {
      if (isUg) {
        var bonKnop = '<label style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:var(--groen);color:#fff;border-radius:6px;font-size:0.75rem;font-weight:600">' +
          '📷 Foto/Bewijs<input type="file" accept="image/*" capture="environment" style="display:none" onchange="App._uploadBon(\'' + prefix + '\',' + i + ',this)"></label>';
        var bonLink = item.bonUrl ? '<span onclick="App.openLightbox(this.dataset.url)" data-url="' + App.esc(item.bonUrl) + '" title="Bekijk bewijs" style="font-size:1.3rem;cursor:pointer;margin-right:6px">🖼️</span>' : '';
        html += '<div class="kostlijn ug">' +
          '<div><div class="col-lbl">Beschrijving</div><input type="text" value="' + App.esc(item.beschrijving) + '" oninput="App._kostUpdate(\'' + prefix + '\','+i+',\'beschrijving\',this.value)"></div>' +
          '<div><div class="col-lbl">Leverancier</div><input type="text" value="' + App.esc(item.leverancier || '') + '" oninput="App._kostUpdate(\'' + prefix + '\','+i+',\'leverancier\',this.value)"></div>' +
          '<div><div class="col-lbl">Bedrag €</div><input type="number" step="0.01" value="' + (item.bedrag || 0) + '" oninput="App._kostUpdate(\'' + prefix + '\','+i+',\'bedrag\',this.value)"></div>' +
          '<div><div class="col-lbl">Bon</div><div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px">' + bonLink + bonKnop + '</div></div>' +
          '<button class="del-btn" onclick="App._kostDel(\'' + prefix + '\',' + i + ')">✕</button></div>';
      } else {
        var ikTot = ((item.aantal || 1) * (item.bedragPerStuk || 0)).toFixed(2);
        html += '<div class="kostlijn ik">' +
          '<div><div class="col-lbl">Beschrijving</div><input type="text" value="' + App.esc(item.beschrijving) + '" oninput="App._kostIkUpdate(' + i + ',\'beschrijving\',this.value)"></div>' +
          '<div><div class="col-lbl">Aantal</div><input type="number" min="0" max="99" step="1" placeholder="St." value="' + (item.aantal || 1) + '" oninput="App._kostIkUpdate(' + i + ',\'aantal\',this.value)"></div>' +
          '<div><div class="col-lbl">Per stuk €</div><input type="number" step="0.01" min="0" value="' + (item.bedragPerStuk || 0) + '" oninput="App._kostIkUpdate(' + i + ',\'bedragPerStuk\',this.value)"></div>' +
          '<div><div class="col-lbl">Totaal €</div><input type="number" id="ik-tot-' + i + '" readonly value="' + ikTot + '" style="background:var(--bg);cursor:default"></div>' +
          '<button class="del-btn" onclick="App._kostDel(\'' + prefix + '\',' + i + ')">✕</button></div>';
      }
    });
    div.innerHTML = html;
    if (prefix.indexOf('act') !== -1) App.updateFinTotaal();
  },

  _getLijst: function(prefix) {
    if (prefix === 'log')    return State.logUitgaven;
    if (prefix === 'act-ug') return State.actUitgaven;
    if (prefix === 'act-ik') return State.actInkomsten;
    return [];
  },
  _getContainerId: function(prefix) {
    if (prefix === 'log')    return 'log-uitgaven-lijst';
    if (prefix === 'act-ug') return 'act-uitgaven-lijst';
    if (prefix === 'act-ik') return 'act-inkomsten-lijst';
    return '';
  },

  _kostUpdate: function(prefix, idx, veld, waarde) {
    var lijst = App._getLijst(prefix);
    if (lijst[idx]) {
      lijst[idx][veld] = veld === 'bedrag' ? parseBedrag(waarde) : waarde;
    }
    if (prefix.indexOf('act') !== -1) App.updateFinTotaal();
  },

  _kostDel: function(prefix, idx) {
    var lijst = App._getLijst(prefix);
    lijst.splice(idx, 1);
    App.renderKostLijst(App._getContainerId(prefix), lijst, prefix);
  },

  _uploadBon: function(prefix, idx, input) {
    var file = input.files[0];
    if (!file) return;
    var lijst = App._getLijst(prefix);
    if (!lijst[idx]) return;
    // Toon upload-status in de bon-cel van de rij
    var containerId = App._getContainerId(prefix);
    var row = document.getElementById(containerId) && document.getElementById(containerId).children[idx];
    var statusEl = null;
    if (row) {
      statusEl = row.querySelector('.bon-status');
      if (!statusEl) {
        statusEl = document.createElement('span');
        statusEl.className = 'bon-status';
        statusEl.style.cssText = 'font-size:0.78rem;font-weight:600;margin-left:4px';
        var bonCol = row.querySelector('div:last-of-type');
        if (bonCol) bonCol.appendChild(statusEl);
      }
      statusEl.style.color = 'var(--oranje)';
      statusEl.textContent = '⏳ Uploaden…';
    } else {
      App.toast('⏳ Bezig met uploaden…');
    }
    verkleenFoto(file, function(blob) {
      var datum = new Date().toISOString().substr(0, 10).replace(/-/g, '');
      var bedrag = String(Math.round((lijst[idx].bedrag || 0) * 100));
      var willekeurig = Math.random().toString(36).substr(2, 6);
      var bestandsnaam = datum + '_' + bedrag + '_' + willekeurig + '.jpg';
      var ref = _storage.ref('bewijzen/uitgaven/' + bestandsnaam);
      ref.put(blob, { contentType: 'image/jpeg' }).then(function() {
        if (statusEl) statusEl.textContent = '⏳ Opslaan…';
        return ref.getDownloadURL();
      }).then(function(url) {
        lijst[idx].bonUrl = url;
        App.toast('✅ Bonnetje opgeslagen.', true);
        App.renderKostLijst(containerId, lijst, prefix);
      }).catch(function(err) {
        if (statusEl) { statusEl.style.color = 'var(--rood)'; statusEl.textContent = '❌ Mislukt'; }
        App.toast('Upload mislukt: ' + (err.message || err));
      });
    });
  },

  voegUitgaveToe: function(prefix) {
    var volledigPrefix = prefix === 'log' ? 'log' : 'act-ug';
    var lijst = App._getLijst(volledigPrefix);
    lijst.push({ beschrijving: '', leverancier: '', bedrag: 0 });
    App.renderKostLijst(App._getContainerId(volledigPrefix), lijst, volledigPrefix);
  },

  voegInkomstToe: function() {
    State.actInkomsten.push({ beschrijving: '', aantal: 1, bedragPerStuk: 0, bedrag: 0 });
    App.renderKostLijst('act-inkomsten-lijst', State.actInkomsten, 'act-ik');
  },

  _kostIkUpdate: function(idx, veld, waarde) {
    var item = State.actInkomsten[idx];
    if (!item) return;
    if (veld === 'beschrijving')  item.beschrijving  = waarde;
    else if (veld === 'aantal')        item.aantal        = parseInt(waarde)  || 0;
    else if (veld === 'bedragPerStuk') item.bedragPerStuk = parseBedrag(waarde);
    item.bedrag = (item.aantal || 0) * (item.bedragPerStuk || 0);
    var totEl = document.getElementById('ik-tot-' + idx);
    if (totEl) totEl.value = item.bedrag.toFixed(2);
    App.updateFinTotaal();
  },

  updateFinTotaal: function() {
    var ug  = State.actUitgaven.reduce(function(s, i) { return s + (i.bedrag || 0); }, 0);
    var ik  = State.actInkomsten.reduce(function(s, i) { return s + (i.bedrag || 0); }, 0);
    var net = ik - ug;
    var netEl = document.getElementById('act-tot-net');
    document.getElementById('act-tot-ug').textContent  = geldbedrag(ug);
    document.getElementById('act-tot-ik').textContent  = geldbedrag(ik);
    if (netEl) {
      netEl.textContent = geldbedrag(net);
      netEl.closest('.fin-vak').className = 'fin-vak ' + (net >= 0 ? 'pos' : 'neg');
    }
  },

  /* ── Impact (afhankelijk van doel) ── */
  updateImpact: function() {
    var doelen = App.getKeuzes('act-doel');
    var opties = [];
    if (doelen.indexOf('Sociale doelen') !== -1) {
      opties = opties.concat(['Nieuwe contacten gelegd','Sterkere buurtbanden','Meer vertrouwen tussen bewoners','Verminderd isolement']);
    }
    if (doelen.indexOf('Individuele doelen') !== -1) {
      opties = opties.concat(['Verhoogd zelfvertrouwen','Vaker initiatief nemen','Verbeterd mentaal en sociaal welzijn']);
    }
    if (doelen.indexOf('Ontwikkelingsgerichte doelen') !== -1) {
      opties = opties.concat(['Taal','Digitaal','Vaardigheden']);
    }
    if (doelen.indexOf('Activerende doelen') !== -1) {
      opties = opties.concat(['Mee organiseren','Stijgende deelname aan activiteiten','Doorstroom opleiding of werk','Vrijwilligersengagement']);
    }
    if (doelen.indexOf('Organisatorische doelen') !== -1) {
      opties = opties.concat(['Nieuwe doelgroepen','Verhoogde zichtbaarheid','Vertrouwen bevorderen in werking/organisatie','Signalen','Preventie']);
    }
    // Uniek
    opties = opties.filter(function(v, i, a) { return a.indexOf(v) === i; });
    var wrap = document.getElementById('act-impact-wrap');
    var div  = document.getElementById('act-impact');
    if (!opties.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    div.innerHTML = opties.map(function(o) {
      return '<div class="keuze" onclick="App.toggle(this)">' + App.esc(o) + '</div>';
    }).join('');
  },

  /* ── Opslaan Logistiek ── */
  slaLogOp: function() {
    if (!State.huidigActie) { App.toast('Geen actie geselecteerd.'); return; }
    var editId = State._bewerktModuleId;
    var record = {
      id:             editId || uuid(),
      module:         'Logistiek',
      naamVanDeActie: State.huidigActie,
      datum:          document.getElementById('log-datum').value,
      uitlegType:     App.getKeuzes('log-type'),
      uitgaven:       State.logUitgaven.slice(),
      signalen:       App.getEnkele('log-signalen') === 'Ja',
      signaalTypes:   App.getKeuzes('log-sig-types'),
      notitie:        document.getElementById('log-notitie').value.trim(),
      fotoUrl:        State.logFotoUrl || null,
      aangemaakt:     nu(),
      status:         'actief'
    };
    State._bewerktModuleId = null;
    var lijst = editId
      ? DB.collectief.map(function(r) { return r.id === editId ? record : r; })
      : DB.collectief.concat([record]);
    DB.slaColOp(lijst);
    App.succes('🔧', 'Logistiek opgeslagen!', State.huidigActie,
      '🏠 Naar start', function() { App.nav('pg-start'); },
      '🔗 Nog een module', function() { App.nav('pg-collectief-module'); }
    );
  },

  /* ── Opslaan Overleg ── */
  slaOvOp: function() {
    if (!State.huidigActie) { App.toast('Geen actie geselecteerd.'); return; }
    var editId = State._bewerktModuleId;
    var record = {
      id:             editId || uuid(),
      module:         'Overleg',
      naamVanDeActie: State.huidigActie,
      datum:          document.getElementById('ov-datum').value,
      signalen:       App.getEnkele('ov-signalen') === 'Ja',
      signaalTypes:   App.getKeuzes('ov-sig-types'),
      notitie:        document.getElementById('ov-notitie').value.trim(),
      fotoUrl:        State.ovFotoUrl || null,
      aangemaakt:     nu(),
      status:         'actief'
    };
    State._bewerktModuleId = null;
    var lijst = editId
      ? DB.collectief.map(function(r) { return r.id === editId ? record : r; })
      : DB.collectief.concat([record]);
    DB.slaColOp(lijst);
    App.succes('🗣', 'Overleg opgeslagen!', State.huidigActie,
      '🏠 Naar start', function() { App.nav('pg-start'); },
      '🔗 Nog een module', function() { App.nav('pg-collectief-module'); }
    );
  },

  /* ── Opslaan Activiteit ── */
  slaActOp: function() {
    if (!State.huidigActie) { App.toast('Geen actie geselecteerd.'); return; }
    var editId = State._bewerktModuleId;
    var locatie = App.getEnkele('act-locatie') || document.getElementById('act-locatie-vrij').value.trim();
    var record = {
      id:             editId || uuid(),
      module:         'Activiteit',
      naamVanDeActie: State.huidigActie,
      locatie:        locatie,
      type:           App.getEnkele('act-type'),
      uitgaven:       State.actUitgaven.slice(),
      inkomsten:      State.actInkomsten.slice(),
      participatie:   App.getKeuzes('act-participatie'),
      doel:           App.getKeuzes('act-doel'),
      impact:         App.getKeuzes('act-impact'),
      signalen:       App.getEnkele('act-signalen') === 'Ja',
      signaalTypes:   App.getKeuzes('act-sig-types'),
      notitie:        document.getElementById('act-notitie').value.trim(),
      fotoUrl:        State.actFotoUrl || null,
      aangemaakt:     nu(),
      status:         'actief'
    };
    State._bewerktModuleId = null;
    var lijst = editId
      ? DB.collectief.map(function(r) { return r.id === editId ? record : r; })
      : DB.collectief.concat([record]);
    DB.slaColOp(lijst);
    App.succes('🎉', 'Activiteit opgeslagen!', State.huidigActie,
      '🏠 Naar start', function() { App.nav('pg-start'); },
      '🔗 Nog een module', function() { App.nav('pg-collectief-module'); }
    );
  },

  /* ══════════════════════════════════════
     RAPPORTEN
  ══════════════════════════════════════ */
  renderPersonenRap: function() {
    var q = (document.getElementById('rp-zoek') ? document.getElementById('rp-zoek').value.trim().toLowerCase() : '');
    var per = DB.personen.filter(function(p) {
      if (p.status !== 'actief') return false;
      if (!q) return true;
      return (p.voornaam + ' ' + p.familienaam).toLowerCase().indexOf(q) !== -1;
    });
    per.sort(function(a, b) { return (a.familienaam || '').localeCompare(b.familienaam || '', 'nl'); });
    document.getElementById('rp-teller').textContent = per.length + ' personen';
    var html = per.map(function(p) {
      var init = getInitials((p.voornaam || '') + ' ' + (p.familienaam || ''));
      return '<tr>' +
        '<td>' + p.volgnummer + '</td>' +
        '<td>' + App.esc(init) + '</td>' +
        '<td>' + App.esc((p.inkomen || []).join(', ') || '—') + '</td>' +
        '<td style="white-space:nowrap">' +
        '<button onclick="App.bekijkPersoon(\'' + p.id + '\')" style="background:var(--groen);color:white;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.8rem;margin-right:4px">Bewerk</button>' +
        '<button onclick="App.archiveerRecord(\'' + p.id + '\',\'personen\')" style="background:var(--oranje);color:white;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.8rem">Archiveer</button>' +
        '</td>' +
        '</tr>';
    }).join('');
    document.getElementById('rp-tbody').innerHTML = html || '<tr><td colspan="4" style="color:var(--zacht);text-align:center">Geen personen.</td></tr>';
  },

  /* ── Filter-helpers rapport-individueel ── */
  _vulIndFilter: function() {
    var jaarEl = document.getElementById('ri-jaar-filter');
    if (!jaarEl) return;
    var huidig = jaarEl.value;
    var jaren = {};
    DB.individueel.forEach(function(r) { if (r.status === 'actief' && r.jaar) jaren[r.jaar] = true; });
    var html = '<option value="">Alle jaren</option>';
    Object.keys(jaren).sort().reverse().forEach(function(j) {
      html += '<option value="' + j + '"' + (String(j) === huidig ? ' selected' : '') + '>' + j + '</option>';
    });
    jaarEl.innerHTML = html;
    App._vulIndMaandFilter();
  },

  _vulIndMaandFilter: function() {
    var maandEl = document.getElementById('ri-maand-filter');
    if (!maandEl) return;
    var huidig = maandEl.value;
    var jaarFilter = (document.getElementById('ri-jaar-filter') || {}).value || '';
    var volgorde = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
    var aanwezig = {};
    DB.individueel.forEach(function(r) {
      if (r.status !== 'actief') return;
      if (jaarFilter && String(r.jaar) !== jaarFilter) return;
      if (r.maand) aanwezig[r.maand] = true;
    });
    var html = '<option value="">Hele jaar</option>';
    volgorde.forEach(function(m) {
      if (aanwezig[m]) html += '<option value="' + m + '"' + (m === huidig ? ' selected' : '') + '>' + m + '</option>';
    });
    maandEl.innerHTML = html;
  },

  _indJaarChange: function() {
    var maandEl = document.getElementById('ri-maand-filter');
    if (maandEl) maandEl.value = '';
    App._vulIndMaandFilter();
    App.renderIndRap();
  },

  renderIndRap: function() {
    var jaarFilter  = (document.getElementById('ri-jaar-filter')  || {}).value || '';
    var maandFilter = (document.getElementById('ri-maand-filter') || {}).value || '';
    var ind = DB.individueel.filter(function(i) {
      if (i.status !== 'actief') return false;
      if (jaarFilter  && String(i.jaar) !== jaarFilter)  return false;
      if (maandFilter && i.maand !== maandFilter)         return false;
      return true;
    });
    var per = DB.personen;
    var teller = document.getElementById('ri-teller');
    if (teller) {
      var label = ind.length + ' acties';
      if (jaarFilter || maandFilter) label += ' — ' + [jaarFilter, maandFilter].filter(Boolean).join(' ');
      teller.textContent = label;
    }
    var html = ind.map(function(a) {
      var p = per.find(function(x) { return x.volgnummer === a.persoonNummer; });
      var init = p ? getInitials((p.voornaam || '') + ' ' + (p.familienaam || '')) : 'P#' + a.persoonNummer;
      return '<tr>' +
        '<td>' + App.esc(a.maand || '') + '</td>' +
        '<td>' + App.esc(init) + '</td>' +
        '<td style="white-space:nowrap">' +
        '<button onclick="App.laadIaBewerk(\'' + a.id + '\')" style="background:var(--groen);color:white;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.8rem;margin-right:4px">Bewerk</button>' +
        '<button onclick="App.archiveerRecord(\'' + a.id + '\',\'individueel\')" style="background:var(--oranje);color:white;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.8rem">Archiveer</button>' +
        '</td>' +
        '</tr>';
    }).join('');
    document.getElementById('ri-tbody').innerHTML = html || '<tr><td colspan="3" style="color:var(--zacht);text-align:center">Geen acties.</td></tr>';
  },

  /* ── Filter-helpers rapport-collectief ── */
  _vulColFilter: function() {
    var jaarEl = document.getElementById('rc-jaar-filter');
    if (!jaarEl) return;
    var huidig = jaarEl.value;
    var jaren = {};
    DB.collectief.forEach(function(r) { if (r.status === 'actief' && !r.module && r.jaar) jaren[r.jaar] = true; });
    var html = '<option value="">Alle jaren</option>';
    Object.keys(jaren).sort().reverse().forEach(function(j) {
      html += '<option value="' + j + '"' + (String(j) === huidig ? ' selected' : '') + '>' + j + '</option>';
    });
    jaarEl.innerHTML = html;
    App._vulColMaandFilter();
  },

  _vulColMaandFilter: function() {
    var maandEl = document.getElementById('rc-maand-filter');
    if (!maandEl) return;
    var huidig = maandEl.value;
    var jaarFilter = (document.getElementById('rc-jaar-filter') || {}).value || '';
    var volgorde = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
    var aanwezig = {};
    DB.collectief.forEach(function(r) {
      if (r.status !== 'actief' || r.module) return;
      if (jaarFilter && String(r.jaar) !== jaarFilter) return;
      if (r.maand) aanwezig[r.maand] = true;
    });
    var html = '<option value="">Hele jaar</option>';
    volgorde.forEach(function(m) {
      if (aanwezig[m]) html += '<option value="' + m + '"' + (m === huidig ? ' selected' : '') + '>' + m + '</option>';
    });
    maandEl.innerHTML = html;
  },

  _colJaarChange: function() {
    var maandEl = document.getElementById('rc-maand-filter');
    if (maandEl) maandEl.value = '';
    App._vulColMaandFilter();
    App.renderColRap();
  },

  renderColRap: function() {
    var jaarFilter  = (document.getElementById('rc-jaar-filter')  || {}).value || '';
    var maandFilter = (document.getElementById('rc-maand-filter') || {}).value || '';
    var col = DB.collectief.filter(function(c) {
      if (c.module || c.status !== 'actief') return false;
      if (jaarFilter  && String(c.jaar) !== jaarFilter)  return false;
      if (maandFilter && c.maand !== maandFilter)         return false;
      return true;
    });
    var teller = document.getElementById('rc-teller');
    if (teller) {
      var label = col.length + ' acties';
      if (jaarFilter || maandFilter) label += ' — ' + [jaarFilter, maandFilter].filter(Boolean).join(' ');
      teller.textContent = label;
    }
    var html = col.map(function(c) {
      var totaal = (c.aantalBewoners || 0) + (c.aantalVrijwilligers || 0);
      // Zoek foto's in gekoppelde modules (Logistiek, Overleg, Activiteit)
      var moduleFotos = DB.collectief.filter(function(m) {
        return m.module && m.naamVanDeActie === c.naamVanDeActie && m.fotoUrl;
      });
      var bijlageHtml = moduleFotos.length
        ? moduleFotos.map(function(m) {
            return '<span onclick="App.openLightbox(this.dataset.url)" data-url="' + App.esc(m.fotoUrl) + '" title="' + App.esc(m.module) + '" style="font-size:1.2rem;cursor:pointer;margin-right:2px">🖼️</span>';
          }).join('')
        : '—';
      return '<tr>' +
        '<td>' + App.esc(c.naamVanDeActie) + '</td>' +
        '<td>' + App.esc(c.maand || '') + '</td>' +
        '<td>' + totaal + '</td>' +
        '<td>' + App.esc((c.typeActie || []).join(', ') || '—') + '</td>' +
        '<td style="text-align:center">' + bijlageHtml + '</td>' +
        '<td style="white-space:nowrap">' +
        '<button onclick="App.laadCaBewerk(\'' + c.id + '\')" style="background:var(--groen);color:white;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.8rem;margin-right:4px">Bewerk</button>' +
        '<button onclick="App.archiveerRecord(\'' + c.id + '\',\'collectief\')" style="background:var(--oranje);color:white;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.8rem">Archiveer</button>' +
        '</td>' +
        '</tr>';
    }).join('');
    document.getElementById('rc-tbody').innerHTML = html || '<tr><td colspan="6" style="color:var(--zacht);text-align:center">Geen acties.</td></tr>';
  },

  renderArchief: function() {
    var alle = DB.personen.concat(DB.individueel).concat(DB.collectief)
      .filter(function(r) { return r.status === 'gearchiveerd'; });
    var div = document.getElementById('archief-inhoud');
    if (!alle.length) {
      div.innerHTML = '<div style="color:var(--zacht)">Archief is leeg.</div>';
      return;
    }
    var allePerMap = {};
    DB.personen.forEach(function(p) { allePerMap[p.volgnummer] = p; });
    var html = alle.map(function(r) {
      var label;
      if (r.voornaam) {
        label = r.voornaam + ' ' + r.familienaam;
      } else if (r.persoonNummer) {
        var p = allePerMap[r.persoonNummer];
        label = (p ? p.voornaam + ' ' + p.familienaam : 'Persoon #' + r.persoonNummer) + ' (individuele actie, ' + (r.maand || '') + ')';
      } else if (r.naamVanDeActie) {
        label = r.naamVanDeActie + (r.module ? ' [' + r.module + ']' : '');
      } else {
        label = 'Record ' + r.id.substr(0,8);
      }
      var type = r.voornaam ? 'personen' : r.persoonNummer ? 'individueel' : 'collectief';
      var bewerkBtn = (type === 'personen') ? '<button onclick="App.bekijkPersoon(\'' + r.id + '\')" style="background:var(--blauw);color:white;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:0.82rem;font-weight:700">Wijzigen</button>' : '';
      return '<div class="mini-kaart" style="flex-direction:column;gap:10px">' +
        '<div><div class="mini-kaart-naam">' + App.esc(label) + '</div>' +
        '<div class="mini-kaart-meta">' + App.esc(type) + ' — gearchiveerd op ' + App.esc((r.gearchiveerdOp || '').substr(0,10)) + '</div></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        bewerkBtn +
        '<button onclick="App.herstelRecord(\'' + r.id + '\')" style="background:var(--groen);color:white;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:0.82rem;font-weight:700">Terugplaatsen</button>' +
        '<button onclick="App.wisRecord(\'' + r.id + '\')" style="background:var(--rood);color:white;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:0.82rem;font-weight:700">Definitief wissen</button>' +
        '</div></div>';
    }).join('');
    div.innerHTML = html;
  },

  archiveerRecord: function(id, type) {
    if (!confirm('Dit record archiveren?')) return;
    try {
      DB._col(type).doc(id).update({ status: 'gearchiveerd', gearchiveerdOp: nu() })
        .then(function() {
          App.toast('Record gearchiveerd.', true);
        })
        .catch(function(e) {
          console.error('archiveer ' + type + ':', e);
          App.toast('Fout bij archiveren: ' + e.message);
        });
    } catch(e) {
      console.error('archiveer ' + type + ':', e);
      App.toast('Fout bij archiveren: ' + e.message);
    }
  },

  herstelRecord: function(id) {
    var gevonden = null;
    var zoekLijst = [
      { col: 'personen', data: DB._personen },
      { col: 'individueel', data: DB._individueel },
      { col: 'collectief', data: DB._collectief }
    ];
    zoekLijst.forEach(function(item) {
      if (!gevonden && item.data.find(function(r) { return r.id === id; })) {
        gevonden = item.col;
      }
    });
    if (!gevonden) { App.toast('Record niet gevonden.'); return; }
    try {
      DB._col(gevonden).doc(id).update({ status: 'actief', gearchiveerdOp: firebase.firestore.FieldValue.delete() })
        .then(function() {
          App.toast('Record teruggeplaatst.', true);
          App.renderArchief();
        })
        .catch(function(e) {
          console.error('herstel ' + gevonden + ':', e);
          App.toast('Fout bij terugplaatsen: ' + e.message);
        });
    } catch(e) {
      console.error('herstelRecord:', e);
      App.toast('Fout bij terugplaatsen: ' + e.message);
    }
  },

  wisRecord: function(id) {
    if (!confirm('Dit record definitief wissen? Dit kan niet ongedaan worden gemaakt.')) return;
    var gevonden = null;
    var zoekLijst = [
      { col: 'personen', data: DB._personen },
      { col: 'individueel', data: DB._individueel },
      { col: 'collectief', data: DB._collectief }
    ];
    zoekLijst.forEach(function(item) {
      if (!gevonden && item.data.find(function(r) { return r.id === id; })) {
        gevonden = item.col;
      }
    });
    if (!gevonden) { App.toast('Record niet gevonden.'); return; }
    try {
      DB._col(gevonden).doc(id).delete()
        .then(function() {
          App.toast('Record definitief gewist.', true);
          App.renderArchief();
        })
        .catch(function(e) {
          console.error('wisRecord ' + gevonden + ':', e);
          App.toast('Fout bij wissen: ' + e.message);
        });
    } catch(e) {
      console.error('wisRecord:', e);
      App.toast('Fout bij wissen: ' + e.message);
    }
  },

  /* ══════════════════════════════════════
     EXPORT
  ══════════════════════════════════════ */
  exportCSVMetFilter: function(type) {
    var vanEl = document.getElementById('csv-van-datum');
    var totEl = document.getElementById('csv-tot-datum');
    var van = vanEl && vanEl.value ? vanEl.value : null;
    var tot = totEl && totEl.value ? totEl.value : null;
    App.exportCSV(type, van, tot);
  },

  exportBackup: function() {
    var types = ['personen', 'individueel', 'collectief'];
    var lijsten = [DB._personen, DB._individueel, DB._collectief];
    var heeftData = lijsten.some(function(l) { return l.length > 0; });
    if (!heeftData) { App.toast('Geen data om te exporteren.'); return; }
    types.forEach(function(type) { App.exportCSV(type); });
    App.toast('Back-up (Excel) geëxporteerd.', true);
  },

  exportCSV: function(type, vanDatum, totDatum) {
    if (typeof XLSX === 'undefined') { App.toast('XLSX niet beschikbaar.'); return; }
    function datumFilter(arr, veld) {
      if (!vanDatum && !totDatum) return arr;
      return arr.filter(function(r) {
        var d = (r[veld] || '').substr(0, 10);
        if (!d) return true;
        if (vanDatum && d < vanDatum) return false;
        if (totDatum && d > totDatum) return false;
        return true;
      });
    }
    function maakSuffix() {
      if (!vanDatum && !totDatum) return '';
      return '_' + (vanDatum || '') + (totDatum ? '_' + totDatum : '');
    }
    function arrStr(v) {
      if (Array.isArray(v)) return v.join(' | ');
      return v === null || v === undefined ? '' : String(v);
    }
    function downloadXLSX(rijen, headers, bestandsnaam) {
      var ws = XLSX.utils.aoa_to_sheet([headers].concat(rijen));
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      XLSX.writeFile(wb, bestandsnaam);
      App.toast('Excel geëxporteerd.', true);
    }

    var data;

    if (type === 'personen') {
      data = datumFilter(DB.personen.slice(), 'aangemaakt');
      if (!data.length) { App.toast('Geen data om te exporteren.'); return; }
      var perHeaders = ['Volgnummer','Voornaam','Familienaam','Leeftijd','Inkomen','Huisvesting','Woonsituatie','Eerste contact','Type','MW','SHW','Woonzorg','Brugfiguur','Adres','Notitie','ID'];
      var rijen = data.map(function(p) {
        var adres = [p.adres, p.postcode, p.gemeente].filter(Boolean).join(', ');
        var gekend = Array.isArray(p.gekendBij) ? p.gekendBij : (p.gekendBij ? [p.gekendBij] : []);
        return [
          p.volgnummer, p.voornaam, p.familienaam, p.leeftijd || '',
          arrStr(p.inkomen), arrStr(p.huisvesting), p.woonsituatie || '',
          p.eersteContact || '', arrStr(p.type),
          gekend.indexOf('MW') !== -1 ? 'x' : '-',
          gekend.indexOf('SHW') !== -1 ? 'x' : '-',
          gekend.indexOf('Woonzorg') !== -1 ? 'x' : '-',
          gekend.indexOf('Brugfiguur') !== -1 ? 'x' : '-',
          adres, p.notitie || '', p.id || ''
        ];
      });
      downloadXLSX(rijen, perHeaders, 'personen_export' + maakSuffix() + '.xlsx');

    } else if (type === 'individueel') {
      data = datumFilter(DB.individueel.slice(), 'datum');
      if (!data.length) { App.toast('Geen data om te exporteren.'); return; }
      var indHeaders = ['Persoon nr','Maand','Jaar','Levensdomein','Vindplaats','Methodiek','Extra info','Toeleiding','Tijd','ID','Datum','Status'];
      var keys = ['persoonNummer','maand','jaar','levensdomein','vindplaats','methodiek','extraInfo','toeleiding','tijd','id','datum','status'];
      var rijen = data.map(function(r) { return keys.map(function(k) { return arrStr(r[k]); }); });
      downloadXLSX(rijen, indHeaders, 'individueel_export' + maakSuffix() + '.xlsx');

    } else {
      data = DB.collectief.filter(function(r) { return !r.module; });
      data = datumFilter(data, 'datum');
      if (!data.length) { App.toast('Geen data om te exporteren.'); return; }
      var colHeaders = ['Volgnummer','Maand','Jaar','Naam van de actie','Cluster','Thema','Type actie','Buurt','Totaal','Aantal bewoners','Waarvan nieuwe bewoners','Aantal vrijwilligers','Naam partners','Duur','ID','Datum','Status'];
      var rijen = data.map(function(r, i) {
        return [
          i + 1, r.maand || '', r.jaar || '', r.naamVanDeActie || '',
          arrStr(r.cluster), r.thema || '', r.typeActie || '', r.buurt || '',
          r.totaal || '', r.aantalBewoners || '', r.waarvanNieuweBewoners || '',
          r.aantalVrijwilligers || '',
          Array.isArray(r.naamPartner) ? r.naamPartner.join(' | ') : (r.naamPartner || ''),
          r.duur || '', r.id || '', r.datum || '', r.status || ''
        ];
      });
      downloadXLSX(rijen, colHeaders, 'collectief_export' + maakSuffix() + '.xlsx');
    }
  },

  exportBuurtwerkPDF: function() {
    var jsPDFLib = (window.jspdf && window.jspdf.jsPDF) || (typeof jsPDF !== 'undefined' ? jsPDF : null);
    if (!jsPDFLib) { App.toast('jsPDF niet beschikbaar.'); return; }

    var per = DB.personen;
    var ind = DB.individueel;
    var col = DB.collectief.filter(function(c) { return !c.module; });

    var vrijwMap = {};
    DB.collectief.forEach(function(r) {
      (r.naamVrijwilligers || []).forEach(function(n) {
        if (n && n.trim()) vrijwMap[n.trim().toLowerCase()] = true;
      });
    });
    var aantalUniekeVrijw = Object.keys(vrijwMap).length;

    var totUren = 0;
    ind.forEach(function(r) { totUren += App._tijdNaarUren(r.tijd); });
    var totBereik = 0, totNieuw = 0;
    col.forEach(function(r) {
      totBereik += (r.aantalBewoners || 0);
      totNieuw  += (r.waarvanNieuweBewoners || 0);
    });

    var fotoRefs = [];
    DB.collectief.forEach(function(r) {
      if (r.fotoUrl) fotoRefs.push({ url: r.fotoUrl, label: (r.module || 'Actie') + ': ' + (r.naamVanDeActie || '') + ' (' + (r.datum || '').substr(0,10) + ')' });
      (r.uitgaven || []).forEach(function(u) {
        if (u.bonUrl) fotoRefs.push({ url: u.bonUrl, label: 'Bewijs: ' + (u.beschrijving || '') + ' \u2014 ' + geldbedrag(u.bedrag) + ' (' + (r.naamVanDeActie || '') + ')' });
      });
    });

    App.toast('PDF genereren\u2026');

    Promise.all(fotoRefs.map(function(f) {
      return App._fetchImageDataUrl(f.url).then(function(res) {
        f.dataUrl = res ? res.dataUrl : null;
        f.origW   = res ? res.w : 0;
        f.origH   = res ? res.h : 0;
      });
    })).then(function() {
      var doc = new jsPDFLib({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      var y = 40;

      doc.setFillColor(45, 106, 79);
      doc.rect(0, 0, 595, 50, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
      doc.text('Buurtwerk Venning \u2014 Buurtwerk rapport PDF', 40, 30);
      doc.setFontSize(10);
      doc.text('Gegenereerd op: ' + new Date().toLocaleString('nl-BE'), 40, 44);
      doc.setTextColor(0, 0, 0);
      y = 70;

      function sectie(tekst) {
        if (y > 700) { doc.addPage(); y = 40; }
        doc.setFillColor(64, 145, 108);
        doc.rect(40, y - 2, 515, 14, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(tekst, 46, y + 8);
        doc.setTextColor(0, 0, 0);
        y += 22;
      }
      function regel(label, waarde) {
        if (y > 740) { doc.addPage(); y = 40; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text(label + ':', 46, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        doc.text(String(waarde), 220, y);
        y += 14;
      }
      function telVeld(records, veld) {
        var t = {};
        records.forEach(function(r) {
          (r[veld] || []).forEach(function(w) { if (w) t[w] = (t[w] || 0) + 1; });
        });
        return t;
      }

      sectie('OVERZICHT');
      regel('Totaal geregistreerde personen', per.length);
      regel('Individuele acties (totaal)', ind.length);
      regel('Collectieve acties (totaal)', col.length);
      regel('Unieke vrijwilligers (alle acties)', aantalUniekeVrijw);
      y += 6;

      sectie('INDIVIDUEEL');
      regel('Totaal acties', ind.length);
      regel('Totaal uren', (Math.round(totUren * 10) / 10) + 'u');
      var methT = telVeld(ind, 'methodiek');
      var methLijst = Object.keys(methT).sort(function(a,b) { return methT[b] - methT[a]; });
      if (methLijst.length) {
        y += 4;
        doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.text('Methodiek:', 46, y); y += 13;
        doc.setFont('helvetica', 'normal');
        methLijst.forEach(function(m) {
          if (y > 740) { doc.addPage(); y = 40; }
          doc.text('  ' + m + ': ' + methT[m] + ' keer', 46, y); y += 11;
        });
      }
      var toelT = telVeld(ind, 'toeleiding');
      var toelLijst = Object.keys(toelT).sort(function(a,b) { return toelT[b] - toelT[a]; });
      if (toelLijst.length) {
        y += 4;
        doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.text('Toeleiding:', 46, y); y += 13;
        doc.setFont('helvetica', 'normal');
        toelLijst.forEach(function(m) {
          if (y > 740) { doc.addPage(); y = 40; }
          doc.text('  ' + m + ': ' + toelT[m] + ' keer', 46, y); y += 11;
        });
      }
      y += 6;

      sectie('COLLECTIEF');
      regel('Totaal acties', col.length);
      regel('Totaal bewoners bereikt', totBereik);
      regel('Waarvan nieuwe bewoners', totNieuw);
      regel('Unieke vrijwilligers', aantalUniekeVrijw);
      var themaT = {};
      col.forEach(function(r) {
        (r.thema || []).forEach(function(t) { if (t) themaT[t] = (themaT[t] || 0) + (r.aantalBewoners || 0); });
      });
      var themaLijst = Object.keys(themaT).sort(function(a,b) { return themaT[b] - themaT[a]; });
      if (themaLijst.length) {
        y += 4;
        doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.text('Thema (bewoners bereik):', 46, y); y += 13;
        doc.setFont('helvetica', 'normal');
        themaLijst.forEach(function(t) {
          if (y > 740) { doc.addPage(); y = 40; }
          doc.text('  ' + t + ': ' + themaT[t] + ' bewoners', 46, y); y += 11;
        });
      }

      var metFoto = fotoRefs.filter(function(f) { return f.dataUrl; });
      if (metFoto.length) {
        y += 8;
        sectie('FOTO\'S EN BEWIJZEN (' + metFoto.length + ')');
        metFoto.forEach(function(f) {
          var maxW = 170, maxH = 220;
          var scale = Math.min(maxW / (f.origW || 1), maxH / (f.origH || 1), 1);
          var dispW = Math.round((f.origW || maxW) * scale);
          var dispH = Math.round((f.origH || maxH) * scale);
          if (y + dispH + 20 > 760) { doc.addPage(); y = 40; }
          doc.setFont('helvetica', 'italic'); doc.setFontSize(7);
          var lr = doc.splitTextToSize(f.label || '', 515);
          doc.text(lr, 46, y); y += lr.length * 9 + 2;
          doc.addImage(f.dataUrl, 'JPEG', 40, y, dispW, dispH);
          y += dispH + 12;
        });
      }

      doc.save('buurtwerk_rapport_' + new Date().getFullYear() + '.pdf');
      App.toast('Buurtwerk rapport PDF gedownload.', true);
    });
  },

  /* ══════════════════════════════════════
     IMPORT
  ══════════════════════════════════════ */
  importCSVDialog: function() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        App._verwerkcSV(ev.target.result, file.name);
      };
      reader.readAsText(file, 'UTF-8');
    };
    input.click();
  },

  _verwerkcSV: function(tekst, bestandsnaam) {
    var regels = tekst.split('\n').filter(function(r) { return r.trim(); });
    if (regels.length < 2) { App.toast('Leeg of ongeldig CSV-bestand.'); return; }
    var scheider = tekst.indexOf(';') !== -1 ? ';' : ',';
    var headers  = App._csvRegel(regels[0], scheider);
    var data = regels.slice(1).map(function(r) {
      var velden = App._csvRegel(r, scheider);
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = velden[i] || ''; });
      return obj;
    });

    // Detecteer type op basis van kolomnamen
    var type = 'personen';
    if (headers.indexOf('naamVanDeActie') !== -1 && headers.indexOf('module') !== -1) type = 'collectief';
    else if (headers.indexOf('persoonNummer') !== -1) type = 'individueel';
    else if (headers.indexOf('voornaam') !== -1) type = 'personen';

    var bestaande = type === 'personen' ? DB._personen.slice() : type === 'individueel' ? DB._individueel.slice() : DB._collectief.slice();
    var gemerged = bestaande.slice();
    var nieuwCount = 0;
    var bijgewerktCount = 0;

    // Hulpfunctie: vergelijk twee datumstrings (ISO of leeg)
    function isRecenter(a, b) {
      return a && b && a > b;
    }

    // Hulpfunctie: zoek bestaand record op id of fallback-sleutel
    function zoekBestaand(rec) {
      for (var i = 0; i < gemerged.length; i++) {
        var b = gemerged[i];
        if (rec.id && b.id && rec.id === b.id) return i;
      }
      // Fallback op inhoudssleutel per type
      for (var j = 0; j < gemerged.length; j++) {
        var c = gemerged[j];
        if (type === 'personen') {
          // Eerst op dossiernummer (volgnummer)
          if (rec.volgnummer && c.volgnummer &&
              String(c.volgnummer) === String(rec.volgnummer)) return j;
          // Daarna op naam
          if (rec.voornaam && rec.familienaam &&
              c.voornaam  && c.familienaam &&
              c.voornaam.toLowerCase()  === rec.voornaam.toLowerCase() &&
              c.familienaam.toLowerCase() === rec.familienaam.toLowerCase()) return j;
        } else if (type === 'individueel') {
          if (rec.persoonNummer && c.persoonNummer === rec.persoonNummer &&
              c.maand === rec.maand && c.jaar === rec.jaar && c.datum === rec.datum) return j;
        } else { // collectief
          if (rec.naamVanDeActie && c.naamVanDeActie === rec.naamVanDeActie &&
              c.maand === rec.maand && c.jaar === rec.jaar && c.module === rec.module) return j;
        }
      }
      return -1;
    }

    var overslaanCount = 0;
    data.forEach(function(importRec) {
      var idx = zoekBestaand(importRec);
      if (idx === -1) {
        // Nieuw record: toevoegen
        gemerged.push(importRec);
        nieuwCount++;
      } else if (type === 'personen') {
        // Bestaande persoon op dossiernummer → altijd overslaan
        overslaanCount++;
      } else {
        // Andere types: overschrijf alleen als import een recentere datum heeft
        if (isRecenter(importRec.datum, gemerged[idx].datum)) {
          gemerged[idx] = importRec;
          bijgewerktCount++;
        }
        // Anders: bestaand record behouden
      }
    });

    if (!nieuwCount && !bijgewerktCount) {
      var skipMsg = overslaanCount ? ' (' + overslaanCount + ' bestaande dossiernummers overgeslagen)' : '';
      App.toast('Geen nieuwe of recentere records gevonden.' + skipMsg);
      return;
    }
    var samenvatting = [];
    if (nieuwCount)      samenvatting.push(nieuwCount + ' nieuwe records');
    if (bijgewerktCount) samenvatting.push(bijgewerktCount + ' bijgewerkt');
    if (overslaanCount)  samenvatting.push(overslaanCount + ' bestaand overgeslagen');
    var bericht = samenvatting.join(', ') + ' (' + type + ')';
    if (!confirm(bericht + ' importeren?')) return;

    try {
      if (type === 'personen') DB.slaPerOp(gemerged);
      else if (type === 'individueel') DB.slaIndOp(gemerged);
      else DB.slaColOp(gemerged);
      App.toast(bericht + ' geïmporteerd.', true);
    } catch(e) {
      console.error('CSV import fout:', e);
      App.toast('Fout bij importeren: ' + e.message);
    }
  },

  _csvRegel: function(regel, scheider) {
    var resultaat = [];
    var huidig = '';
    var inQuote = false;
    for (var i = 0; i < regel.length; i++) {
      var c = regel[i];
      if (c === '"') {
        if (inQuote && regel[i+1] === '"') { huidig += '"'; i++; }
        else inQuote = !inQuote;
      } else if (c === scheider && !inQuote) {
        resultaat.push(huidig); huidig = '';
      } else {
        huidig += c;
      }
    }
    resultaat.push(huidig);
    return resultaat;
  },

  /* ══════════════════════════════════════
     ALLE DATA WISSEN
  ══════════════════════════════════════ */
  wisAlles: function() {
    if (!confirm('Weet u zeker dat u alle data wilt wissen?')) return;
    if (!confirm('Dit kan niet ongedaan worden gemaakt. Wilt u echt alles verwijderen?')) return;
    App.toast('Bezig met wissen…');
    var cols = ['personen', 'individueel', 'collectief'];
    Promise.all(cols.map(function(col) {
      return DB._col(col).get().then(function(snap) {
        var batch = _fs.batch();
        snap.docs.forEach(function(d) { batch.delete(d.ref); });
        return batch.commit();
      });
    })).then(function() {
      App.toast('Alle data gewist.', false);
      App.nav('pg-start');
    }).catch(function(e) {
      console.error('wisAlles:', e);
      App.toast('Fout bij wissen: ' + e.message);
    });
  },

  /* ══════════════════════════════════════
     BEKIJK / BEWERK PERSOON
  ══════════════════════════════════════ */
  bekijkPersoon: function(id) {
    var p = DB.personen.find(function(x) { return x.id === id; });
    if (!p) return;
    // Stel edit-ID in vóór nav zodat resetPer de velden niet leegt
    State._bewerktPersoId = id;
    App.nav('pg-persoon-wiz');
    // Vul alle velden in
    document.getElementById('per-voornaam').value   = p.voornaam    || '';
    document.getElementById('per-familienaam').value= p.familienaam || '';
    document.getElementById('per-adres').value      = p.adres       || '';
    document.getElementById('per-postcode').value   = p.postcode    || '';
    document.getElementById('per-gemeente').value   = p.gemeente    || '';
    document.getElementById('per-notitie').value    = p.notitie     || '';
    App._setKeuzes('per-leeftijd',    [p.leeftijd || '']);
    App._setKeuzes('per-inkomen',     p.inkomen      || []);
    App._setKeuzes('per-woon',        p.huisvesting  || []);
    App._setKeuzes('per-woonsituatie',[p.woonsituatie || '']);
    App._setKeuzes('per-eerste',      [p.eersteContact || '']);
    App._setKeuzes('per-type',        Array.isArray(p.type) ? p.type : (p.type ? [p.type] : []));
    App._setKeuzes('per-gekend-bij',  p.gekendBij    || []);
    // Pas header en terug-knop aan
    var wh = document.querySelector('#pg-persoon-wiz .wiz-header h1');
    var wp = document.querySelector('#pg-persoon-wiz .wiz-header p');
    if (wh) wh.textContent = '✏️ Persoon bewerken';
    if (wp) wp.textContent = p.voornaam + ' ' + p.familienaam + ' — nr. ' + p.volgnummer;
    var terugBtn = document.querySelector('#pg-persoon-wiz .terug-link button');
    if (terugBtn) {
      terugBtn.textContent = '← Personen';
      terugBtn.onclick = function() { State._bewerktPersoId = null; App.nav('pg-rapport-personen'); };
    }
  },

  /* ══════════════════════════════════════
     BEWERK INDIVIDUELE ACTIE
  ══════════════════════════════════════ */
  laadIaBewerk: function(id) {
    var a = DB.individueel.find(function(x) { return x.id === id; });
    if (!a) return;
    State._bewerktIaId = id;
    App.nav('pg-ind-actie-wiz');
    // Laad persoon
    var p = DB.personen.find(function(x) { return x.volgnummer === a.persoonNummer; });
    if (p) {
      State.gekozenPersoon = p;
      document.getElementById('ia-zoek').value = p.voornaam + ' ' + p.familienaam;
      var gp = document.getElementById('ia-gekozen-persoon');
      gp.textContent = '\u2713 ' + p.voornaam + ' ' + p.familienaam + ' (nr. ' + p.volgnummer + ')';
      gp.style.display = 'block';
    }
    // Laad keuzes
    App._setKeuzes('ia-maand', [a.maand || '']);
    var jaarEl = document.getElementById('ia-jaar');
    if (jaarEl) jaarEl.value = a.jaar || huidigJaar();
    App._setKeuzes('ia-vindplaats', a.vindplaats || []);
    App._setKeuzes('ia-leven',      a.levensdomein || []);
    App._setKeuzes('ia-methodiek',  a.methodiek || []);
    var extraEl = document.getElementById('ia-extra');
    if (extraEl) extraEl.value = a.extraInfo || '';
    App._setKeuzes('ia-toeleiding', a.toeleiding || []);
    App._setKeuzes('ia-tijd',       [a.tijd || '']);
    // Pas header aan
    var wh = document.querySelector('#pg-ind-actie-wiz .wiz-header h1');
    if (wh) wh.textContent = '\u270F\uFE0F Actie bewerken';
    var terugBtn = document.querySelector('#pg-ind-actie-wiz .terug-link button');
    if (terugBtn) {
      terugBtn.textContent = '\u2190 Rapporten';
      terugBtn.onclick = function() { State._bewerktIaId = null; App.nav('pg-rapport-individueel'); };
    }
  },

  /* ══════════════════════════════════════
     BEWERK COLLECTIEVE ACTIE
  ══════════════════════════════════════ */
  laadCaBewerk: function(id) {
    var c = DB.collectief.find(function(x) { return x.id === id; });
    if (!c) return;
    State._bewerktCaId = id;
    App.nav('pg-col-actie-wiz');
    // Laad basisvelden
    var naamEl = document.getElementById('ca-naam');
    if (naamEl) naamEl.value = c.naamVanDeActie || '';
    App._setKeuzes('ca-maand', [c.maand || '']);
    var jaarEl = document.getElementById('ca-jaar');
    if (jaarEl) jaarEl.value = c.jaar || huidigJaar();
    // Bereik
    document.getElementById('ca-bewoners').value = c.aantalBewoners || 0;
    document.getElementById('ca-nieuw').value    = c.waarvanNieuweBewoners || 0;
    document.getElementById('ca-vrijw').value    = c.aantalVrijwilligers || 0;
    document.getElementById('ca-totaal').value   = c.totaal || 0;
    App.updateVrijwNames();
    var vrijwNamen = c.naamVrijwilligers || [];
    for (var i = 0; i < vrijwNamen.length; i++) {
      var vEl = document.getElementById('ca-vw-' + (i + 1));
      if (vEl) vEl.value = vrijwNamen[i];
    }
    var partnerEl = document.getElementById('ca-partner');
    if (partnerEl) partnerEl.value = c.naamPartner || '';
    // Details
    App._setKeuzes('ca-cluster', c.cluster || []);
    App._setKeuzes('ca-thema',   c.thema || []);
    App._setKeuzes('ca-type',    c.typeActie || []);
    var buurtEl = document.getElementById('ca-buurt');
    if (buurtEl) buurtEl.value = c.buurt || 'centrum 2: venning';
    App._setKeuzes('ca-duur', [c.duur || '']);
    // Pas header aan
    var wh = document.querySelector('#pg-col-actie-wiz .wiz-header h1');
    if (wh) wh.textContent = '\u270F\uFE0F Actie bewerken';
    var terugBtn = document.querySelector('#pg-col-actie-wiz .terug-link button');
    if (terugBtn) {
      terugBtn.textContent = '\u2190 Rapporten';
      terugBtn.onclick = function() { State._bewerktCaId = null; App.nav('pg-rapport-collectief'); };
    }
  },

  laadModuleBewerk: function(id) {
    var c = DB.collectief.find(function(x) { return x.id === id; });
    if (!c || !c.module) return;
    State._bewerktModuleId = id;
    State.huidigActie = c.naamVanDeActie;
    var vandaag = (c.datum || new Date().toISOString().substr(0, 10));
    if (c.module === 'Logistiek') {
      App._resetKeuzes('log-type');
      App._resetKeuzes('log-signalen');
      App._resetKeuzes('log-sig-types');
      document.getElementById('log-datum').value = vandaag;
      document.getElementById('log-notitie').value = c.notitie || '';
      document.getElementById('log-actienaam-lbl').textContent = c.naamVanDeActie;
      State.logUitgaven = (c.uitgaven || []).map(function(u) { return Object.assign({}, u); });
      State.logFotoUrl = c.fotoUrl || null;
      App.renderKostLijst('log-uitgaven-lijst', State.logUitgaven, 'log');
      App._setKeuzes('log-type', c.uitlegType || []);
      if (c.signalen) App._setKeuzes('log-signalen', ['Ja']);
      App._setKeuzes('log-sig-types', c.signaalTypes || []);
      var sigEl = document.getElementById('log-signaal-types');
      if (sigEl) sigEl.style.display = c.signalen ? 'block' : 'none';
      App.nav('pg-mod-logistiek');
    } else if (c.module === 'Overleg') {
      App._resetKeuzes('ov-signalen');
      App._resetKeuzes('ov-sig-types');
      document.getElementById('ov-datum').value = vandaag;
      document.getElementById('ov-notitie').value = c.notitie || '';
      document.getElementById('ov-actienaam-lbl').textContent = c.naamVanDeActie;
      State.ovFotoUrl = c.fotoUrl || null;
      if (c.signalen) App._setKeuzes('ov-signalen', ['Ja']);
      App._setKeuzes('ov-sig-types', c.signaalTypes || []);
      var sigEl2 = document.getElementById('ov-signaal-types');
      if (sigEl2) sigEl2.style.display = c.signalen ? 'block' : 'none';
      App.nav('pg-mod-overleg');
    } else if (c.module === 'Activiteit') {
      App._resetKeuzes('act-locatie');
      App._resetKeuzes('act-type');
      App._resetKeuzes('act-participatie');
      App._resetKeuzes('act-doel');
      App._resetKeuzes('act-signalen');
      App._resetKeuzes('act-sig-types');
      document.getElementById('act-locatie-vrij').value = c.locatie || '';
      document.getElementById('act-notitie').value = c.notitie || '';
      document.getElementById('act-actienaam-lbl').textContent = c.naamVanDeActie;
      State.actUitgaven = (c.uitgaven || []).map(function(u) { return Object.assign({}, u); });
      State.actInkomsten = (c.inkomsten || []).map(function(u) { return Object.assign({}, u); });
      State.actFotoUrl = c.fotoUrl || null;
      App.renderKostLijst('act-uitgaven-lijst', State.actUitgaven, 'act-ug');
      App.renderKostLijst('act-inkomsten-lijst', State.actInkomsten, 'act-ik');
      App._setKeuzes('act-locatie', c.locatie ? [c.locatie] : []);
      App._setKeuzes('act-type', c.type ? [c.type] : []);
      App._setKeuzes('act-participatie', c.participatie || []);
      App._setKeuzes('act-doel', c.doel || []);
      App._setKeuzes('act-impact', c.impact || []);
      if (c.signalen) App._setKeuzes('act-signalen', ['Ja']);
      App._setKeuzes('act-sig-types', c.signaalTypes || []);
      var sigEl3 = document.getElementById('act-signaal-types');
      if (sigEl3) sigEl3.style.display = c.signalen ? 'block' : 'none';
      App.updateFinTotaal();
      App.nav('pg-mod-activiteit');
    }
  },

  /* ══════════════════════════════════════
     JAARPLAN MODULE
  ══════════════════════════════════════ */
  _participatiegraad: function(participaties) {
    var niveauMap = {
      'Kijken': 1, 'Deelnemen': 1,
      'Feedback geven': 2, 'Helpen': 2,
      'Advies geven': 3, 'Meedenken': 3,
      'Mee organiseren': 4,
      'Trekken': 5
    };
    var labelKort = { 1: 'Zeer laag', 2: 'Laag', 3: 'Gemiddeld', 4: 'Hoog', 5: 'Zeer hoog' };
    var labelLang = {
      1: 'Zeer laag (Aanwezig zijn)',
      2: 'Laag (Reageren of hand-en-spandiensten)',
      3: 'Gemiddeld (Input leveren)',
      4: 'Hoog (Samen doen)',
      5: 'Zeer hoog (De kar trekken / Eigenaarschap)'
    };
    var niveaus = participaties.map(function(p) { return niveauMap[p] || 0; }).filter(Boolean);
    if (!niveaus.length) return '—';
    var min = Math.min.apply(null, niveaus);
    var max = Math.max.apply(null, niveaus);
    if (min === max) return labelLang[min];
    return 'Van ' + labelKort[min] + ' tot ' + labelKort[max];
  },

  _fetchImageDataUrl: function(url) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      try {
        var canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), w: img.naturalWidth, h: img.naturalHeight });
      } catch(e) { resolve(null); }
    };
    img.onerror = function() { resolve(null); };
    img.src = url;
  });
},

_collectProjectFotos: function(naam) {
  var col = DB.collectief.filter(function(r) { return r.naamVanDeActie === naam; });
  var fotos = [];
  col.forEach(function(r) {
    if (r.fotoUrl) fotos.push({ url: r.fotoUrl, label: (r.module || 'Actie') + ' \u2014 ' + (r.datum || '').substr(0,10) });
    (r.uitgaven || []).forEach(function(u) {
      if (u.bonUrl) fotos.push({ url: u.bonUrl, label: 'Bewijs: ' + (u.beschrijving || '') + ' \u2014 ' + geldbedrag(u.bedrag) });
    });
  });
  return fotos;
},

  _berekenFiche: function(naam) {
    var col = DB.collectief.filter(function(r) { return r.naamVanDeActie === naam && r.status === 'actief'; });
    var hoofdRecords  = col.filter(function(r) { return !r.module; });
    var logRecords    = col.filter(function(r) { return r.module === 'Logistiek'; });
    var ovRecords     = col.filter(function(r) { return r.module === 'Overleg'; });
    var actRecords    = col.filter(function(r) { return r.module === 'Activiteit'; });

    // Bewoners
    var totBewoners = hoofdRecords.reduce(function(s, r) { return s + (r.aantalBewoners || 0); }, 0);
    var totNieuw    = hoofdRecords.reduce(function(s, r) { return s + (r.waarvanNieuweBewoners || 0); }, 0);

    // Unieke vrijwilligers
    var alleVrijw = [];
    hoofdRecords.forEach(function(r) {
      (r.naamVrijwilligers || []).forEach(function(n) {
        if (n && alleVrijw.indexOf(n) === -1) alleVrijw.push(n);
      });
    });

    // Financiën
    var totUg = 0, totIk = 0;
    var leveranciers = [];
    logRecords.forEach(function(r) {
      (r.uitgaven || []).forEach(function(u) {
        totUg += (u.bedrag || 0);
        if (u.leverancier && leveranciers.indexOf(u.leverancier) === -1) leveranciers.push(u.leverancier);
      });
    });
    actRecords.forEach(function(r) {
      (r.uitgaven || []).forEach(function(u) {
        totUg += (u.bedrag || 0);
        if (u.leverancier && leveranciers.indexOf(u.leverancier) === -1) leveranciers.push(u.leverancier);
      });
      (r.inkomsten || []).forEach(function(ik) { totIk += (ik.bedrag || 0); });
    });

    // Signalen
    var alleSignalen = [];
    col.forEach(function(r) {
      if (r.signalen && r.signaalTypes) {
        r.signaalTypes.forEach(function(s) { if (alleSignalen.indexOf(s) === -1) alleSignalen.push(s); });
      }
    });

    // Rollen / doelen / participatie / impact
    var rollen  = [];
    var doelen  = [];
    var impact  = [];
    var participaties = [];
    hoofdRecords.forEach(function(r) { (r.cluster || []).forEach(function(c) { if (rollen.indexOf(c) === -1) rollen.push(c); }); });
    actRecords.forEach(function(r)   { (r.doel    || []).forEach(function(d) { if (doelen.indexOf(d)  === -1) doelen.push(d);  }); });
    actRecords.forEach(function(r)   { (r.impact  || []).forEach(function(i) { if (impact.indexOf(i)  === -1) impact.push(i);  }); });
    actRecords.forEach(function(r)   { (r.participatie || []).forEach(function(p) { if (participaties.indexOf(p) === -1) participaties.push(p); }); });

    // Notities
    var notities = col.filter(function(r) { return r.notitie; }).map(function(r) {
      return '[' + (r.module || 'Actie') + ' ' + (r.datum || r.aangemaakt || '').substr(0,10) + '] ' + r.notitie;
    });

    // Maanden
    var maanden = hoofdRecords.map(function(r) { return r.maand; }).filter(function(v,i,a) { return a.indexOf(v) === i; });

    return {
      naam:           naam,
      maanden:        maanden,
      aantalOverleg:  ovRecords.length,
      aantalLogistiek:logRecords.length,
      aantalActiviteit:actRecords.length,
      totBewoners:    totBewoners,
      totNieuw:       totNieuw,
      uniekeVrijw:    alleVrijw,
      totUitgaven:    totUg,
      totInkomsten:   totIk,
      netto:          totIk - totUg,
      leveranciers:   leveranciers,
      signalen:       alleSignalen,
      rollen:         rollen,
      doelen:         doelen,
      impact:         impact,
      participaties:  participaties,
      notities:       notities,
      ids:            col.map(function(r) { return r.id; })
    };
  },

  renderJaarplan: function() {
    var namen = DB.actieNamen();
    var div   = document.getElementById('jp-lijst');
    if (!namen.length) {
      div.innerHTML = '<div style="color:var(--zacht)">Nog geen collectieve acties geregistreerd.</div>';
      return;
    }
    var html = '';
    namen.forEach(function(naam) {
      var f = App._berekenFiche(naam);
      var netKleur = f.netto >= 0 ? 'var(--groen)' : 'var(--rood)';
      html += '<div class="jp-kaart">' +
        '<div class="jp-header">' +
          '<div><div class="jp-naam">' + App.esc(naam) + '</div>' +
          '<div class="jp-meta">' + App.esc(f.maanden.join(', ')) + ' | ' + f.totBewoners + ' bewoners | ' + f.uniekeVrijw.length + ' unieke vrijw.</div></div>' +
          '<div style="display:flex;gap:6px;align-items:center">' +
            '<span class="mini-badge badge-groen">' + f.aantalActiviteit + ' activ.</span>' +
            '<span class="mini-badge badge-paars">' + f.aantalLogistiek + ' log.</span>' +
            '<span class="mini-badge badge-blauw">' + f.aantalOverleg + ' overleg</span>' +
          '</div>' +
        '</div>' +
        '<div class="jp-fin">' +
          '<div class="jp-fin-vak"><span class="jp-fin-getal" style="color:var(--rood)">' + geldbedrag(f.totUitgaven) + '</span><span class="jp-fin-lbl">Uitgaven</span></div>' +
          '<div class="jp-fin-vak"><span class="jp-fin-getal" style="color:var(--groen)">' + geldbedrag(f.totInkomsten) + '</span><span class="jp-fin-lbl">Inkomsten</span></div>' +
          '<div class="jp-fin-vak"><span class="jp-fin-getal" style="color:' + netKleur + '">' + geldbedrag(f.netto) + '</span><span class="jp-fin-lbl">Netto</span></div>' +
        '</div>' +
        '<div class="jp-btns">' +
          '<button onclick="App.jaarplanPDF(\'' + App.esc(naam) + '\')" style="background:var(--groen)">📄 PDF Fiche</button>' +
          '<button onclick="App.archiveerProject(\'' + App.esc(naam) + '\')" style="background:var(--oranje)">📦 Archiveer</button>' +
          '<button onclick="App.wisProject(\'' + App.esc(naam) + '\')" style="background:var(--rood)">🗑 Wissen</button>' +
        '</div>' +
      '</div>';
    });
    div.innerHTML = html;
  },

  _drawFiche: function(doc, naam, fotos) {
    var f = App._berekenFiche(naam);
    var mL = 40, breedte = 515;
    var y = 65;

    function kop(tekst, fs) {
      doc.setFont('helvetica','bold'); doc.setFontSize(fs || 14);
      if (y > 720) { doc.addPage(); y = 40; }
      doc.text(tekst, mL, y); y += (fs || 14) * 1.5;
    }
    function veld(label, waarde) {
      if (y > 740) { doc.addPage(); y = 40; }
      doc.setFont('helvetica','bold'); doc.setFontSize(9);
      doc.text(label + ':', mL, y);
      doc.setFont('helvetica','normal'); doc.setFontSize(9);
      var tekst = String(waarde || '—');
      var regels = doc.splitTextToSize(tekst, breedte - 130);
      doc.text(regels, mL + 130, y);
      y += Math.max(14, regels.length * 11);
    }
    function lijn() {
      if (y > 740) { doc.addPage(); y = 40; }
      doc.setDrawColor(200); doc.line(mL, y, mL + breedte, y); y += 10;
    }
    function sectieKop(tekst) {
      if (y > 700) { doc.addPage(); y = 40; }
      doc.setFillColor(64, 145, 108); // lichtgroen (#40916c)
      doc.rect(mL, y - 2, breedte, 13, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(tekst, mL + 6, y + 7);
      doc.setTextColor(0, 0, 0);
      y += 17;
    }

    // Titelblok (donkergroen hoofdbalk)
    doc.setFillColor(45, 106, 79);
    doc.rect(0, 0, 595, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica','bold'); doc.setFontSize(16);
    doc.text('Buurtwerk Venning — Projectfiche', mL, 30);
    doc.setFontSize(10);
    doc.text('Gegenereerd: ' + new Date().toLocaleDateString('nl-BE'), mL, 44);
    doc.setTextColor(0, 0, 0);

    kop(naam, 16); y += 4; lijn();

    sectieKop('OVERZICHT');
    veld('Maanden',      f.maanden.join(', '));
    veld('Type',         'Collectieve actie');
    lijn();

    sectieKop('BEREIK');
    veld('Totaal bewoners',          f.totBewoners);
    veld('Waarvan nieuwe bewoners',  f.totNieuw);
    veld('Unieke vrijwilligers',     f.uniekeVrijw.length);
    veld('Totaal bereikte personen', f.totBewoners + f.uniekeVrijw.length);
    lijn();

    sectieKop('ACTIVITEITEN');
    veld('Aantal x overleg',             f.aantalOverleg);
    veld('Aantal x logistiek/follow-up', f.aantalLogistiek);
    veld('Aantal x activiteit',          f.aantalActiviteit);
    lijn();

    sectieKop('INHOUD');
    veld('Participatiegraad', App._participatiegraad(f.participaties));
    // Doelen met bijbehorende onderdoelen (impact)
    var doelImpactMap = {
      'Sociale doelen':              ['Nieuwe contacten gelegd','Sterkere buurtbanden','Meer vertrouwen tussen bewoners','Verminderd isolement'],
      'Individuele doelen':          ['Verhoogd zelfvertrouwen','Vaker initiatief nemen','Verbeterd mentaal en sociaal welzijn'],
      'Ontwikkelingsgerichte doelen':['Taal','Digitaal','Vaardigheden'],
      'Activerende doelen':          ['Mee organiseren','Stijgende deelname aan activiteiten','Doorstroom opleiding of werk','Vrijwilligersengagement'],
      'Organisatorische doelen':     ['Nieuwe doelgroepen','Verhoogde zichtbaarheid','Vertrouwen bevorderen in werking/organisatie','Signalen','Preventie']
    };
    if (f.doelen.length) {
      f.doelen.forEach(function(d) {
        var sub = (doelImpactMap[d] || []).filter(function(i) { return f.impact.indexOf(i) !== -1; });
        veld(d, sub.length ? sub.join(', ') : '—');
      });
    } else {
      veld('Doelen', '—');
    }
    veld('Signalen',         f.signalen.join(', ')|| '—');
    lijn();

    sectieKop('FINANCIEEL');
    veld('Totaal uitgaven',  geldbedrag(f.totUitgaven));
    veld('Totaal inkomsten', geldbedrag(f.totInkomsten));
    veld('Netto resultaat',  geldbedrag(f.netto));
    veld('Leveranciers',     f.leveranciers.join(', ') || '—');
    lijn();

    if (f.notities.length) {
      sectieKop('NOTITIES');
      f.notities.forEach(function(n) {
        if (y > 730) { doc.addPage(); y = 40; }
        doc.setFont('helvetica','normal'); doc.setFontSize(8);
        var regels = doc.splitTextToSize(n, breedte);
        doc.text(regels, mL, y);
        y += regels.length * 10 + 4;
      });
    }

    var metFoto = (fotos || []).filter(function(f) { return f && f.dataUrl; });
    if (metFoto.length) {
      sectieKop('FOTO\'S EN BEWIJZEN');
      metFoto.forEach(function(f) {
        var maxW = 170, maxH = 220;
        var scale = Math.min(maxW / (f.w || 1), maxH / (f.h || 1), 1);
        var dispW = Math.round((f.w || maxW) * scale);
        var dispH = Math.round((f.h || maxH) * scale);
        if (y + dispH + 20 > 760) { doc.addPage(); y = 40; }
        doc.setFont('helvetica','italic'); doc.setFontSize(7);
        var lr = doc.splitTextToSize(f.label || '', breedte);
        doc.text(lr, mL, y); y += lr.length * 9 + 2;
        doc.addImage(f.dataUrl, 'JPEG', mL, y, dispW, dispH);
        y += dispH + 12;
      });
    }
  },

  jaarplanPDF: function(naam) {
    var jsPDFLib = (window.jspdf && window.jspdf.jsPDF) || (typeof jsPDF !== 'undefined' ? jsPDF : null);
    if (!jsPDFLib) { App.toast('jsPDF niet beschikbaar.'); return; }
    App.toast('PDF genereren\u2026');
    var fotoBronnen = App._collectProjectFotos(naam);
    Promise.all(fotoBronnen.map(function(f) {
      return App._fetchImageDataUrl(f.url).then(function(res) {
        f.dataUrl = res ? res.dataUrl : null;
        f.w = res ? res.w : 0; f.h = res ? res.h : 0;
      });
    })).then(function() {
      var doc = new jsPDFLib({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      App._drawFiche(doc, naam, fotoBronnen);
      doc.save('projectfiche_' + naam.replace(/[^a-z0-9]/gi, '_') + '.pdf');
      App.toast('PDF gedownload: ' + naam, true);
    });
  },

  exporteerJaarplanPDF: function() {
    var jsPDFLib = (window.jspdf && window.jspdf.jsPDF) || (typeof jsPDF !== 'undefined' ? jsPDF : null);
    if (!jsPDFLib) { App.toast('jsPDF niet beschikbaar.'); return; }
    var namen = DB.actieNamen();
    if (!namen.length) { App.toast('Geen projecten om te exporteren.'); return; }
    App.toast('PDF genereren\u2026');
    var alleFotoBronnen = namen.map(function(naam) { return App._collectProjectFotos(naam); });
    var fetchPromises = [];
    alleFotoBronnen.forEach(function(fotos) {
      fotos.forEach(function(f) {
        fetchPromises.push(App._fetchImageDataUrl(f.url).then(function(res) {
          f.dataUrl = res ? res.dataUrl : null;
          f.w = res ? res.w : 0; f.h = res ? res.h : 0;
        }));
      });
    });
    Promise.all(fetchPromises).then(function() {
      var doc = new jsPDFLib({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      namen.forEach(function(naam, idx) {
        if (idx > 0) doc.addPage();
        App._drawFiche(doc, naam, alleFotoBronnen[idx]);
      });
      doc.save('jaarplan_' + new Date().getFullYear() + '.pdf');
      App.toast('Jaarplan PDF gedownload (' + namen.length + ' projecten).', true);
    });
  },

  archiveerProject: function(naam) {
    if (!confirm('Alle records voor "' + naam + '" archiveren?')) return;
    var lijst = DB.collectief.map(function(r) {
      if (r.naamVanDeActie === naam && r.status === 'actief') {
        r.status = 'gearchiveerd'; r.gearchiveerdOp = nu();
      }
      return r;
    });
    DB.slaColOp(lijst);
    App.toast('"' + naam + '" gearchiveerd.', true);
    App.renderJaarplan();
  },

  wisProject: function(naam) {
    if (!confirm('ALLE data voor "' + naam + '" definitief wissen?')) return;
    if (prompt('Typ de projectnaam ter bevestiging:') !== naam) {
      App.toast('Wissen geannuleerd.');
      return;
    }
    var lijst = DB.collectief.filter(function(r) { return r.naamVanDeActie !== naam; });
    DB.slaColOp(lijst);
    App.toast('"' + naam + '" gewist.', false);
    App.renderJaarplan();
  },

  /* ══════════════════════════════════════
     DASHBOARD — HELPERS
  ══════════════════════════════════════ */
  _tijdNaarUren: function(t) {
    if (!t) return 0;
    var map = { '5 min': 0.083, '15 min': 0.25, '30 min': 0.5, '1 uur': 1, '1u30': 1.5, '2 uur': 2 };
    return map[t] || 0;
  },

  _dashData: function() {
    var jaarEl  = document.getElementById('dash-jaar-filter');
    var maandEl = document.getElementById('dash-maand-filter');
    var jaarFilter  = jaarEl  ? jaarEl.value  : '';
    var maandFilter = maandEl ? maandEl.value : '';
    // Inclusief gearchiveerde records — tellen mee voor statistieken
    var per = DB.personen;
    var ind = DB.individueel.filter(function(r) {
      if (jaarFilter  && String(r.jaar) !== jaarFilter)  return false;
      if (maandFilter && r.maand !== maandFilter)         return false;
      return true;
    });
    var col = DB.collectief.filter(function(r) {
      if (r.module) return false;
      if (jaarFilter  && String(r.jaar) !== jaarFilter)  return false;
      if (maandFilter && r.maand !== maandFilter)         return false;
      return true;
    });
    var colNamen = {};
    col.forEach(function(r) { colNamen[r.naamVanDeActie] = true; });
    var colAlle = DB.collectief.filter(function(r) {
      if (false) return false; // alle statussen meenemen
      if (jaarFilter || maandFilter) {
        if (!r.module) {
          if (jaarFilter  && String(r.jaar) !== jaarFilter)  return false;
          if (maandFilter && r.maand !== maandFilter)         return false;
        } else {
          if (!colNamen[r.naamVanDeActie]) return false;
        }
      }
      return true;
    });
    return { per: per, ind: ind, col: col, colAlle: colAlle };
  },

  _telVeld: function(records, veld, extraFn) {
    var teller = {};
    records.forEach(function(r) {
      var waarden = r[veld] || [];
      if (!Array.isArray(waarden)) waarden = [waarden];
      var uren = App._tijdNaarUren(r.tijd);
      var bewoners = r.aantalBewoners || 0;
      waarden.forEach(function(w) {
        if (!w) return;
        if (extraFn) w = extraFn(w);
        if (!teller[w]) teller[w] = { count: 0, uren: 0, bewoners: 0 };
        teller[w].count++;
        teller[w].uren += uren;
        teller[w].bewoners += bewoners;
      });
    });
    return teller;
  },

  _sortTeller: function(obj, sleutel) {
    var arr = [];
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) arr.push({ label: key, data: obj[key] });
    }
    arr.sort(function(a, b) { return (b.data[sleutel] || 0) - (a.data[sleutel] || 0); });
    return arr;
  },

  _renderBars: function(id, items, fillClass, metRank) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!items || !items.length) { el.innerHTML = '<div class="dash-leeg">Nog geen data.</div>'; return; }
    var max = 0;
    items.forEach(function(it) { if (it.value > max) max = it.value; });
    if (max === 0) max = 1;
    var html = '<div class="dash-bar-lijst">';
    items.forEach(function(it, i) {
      var pct = Math.round((it.value / max) * 100);
      var biClass = metRank ? 'dash-bi dash-bi-r' : 'dash-bi';
      html += '<div class="' + biClass + '">';
      if (metRank) html += '<span class="dash-br">' + (i + 1) + '.</span>';
      html += '<span class="dash-bl">' + App.esc(String(it.label)) + '</span>';
      html += '<div class="dash-bt"><div class="dash-bf ' + fillClass + '" style="width:' + pct + '%"></div></div>';
      html += '<span class="dash-bv">' + it.value + (it.suffix || '') + '</span>';
      html += '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  },

  /* ══════════════════════════════════════
     DASHBOARD — RENDER FUNCTIES
  ══════════════════════════════════════ */
  _dashVulJaarFilter: function() {
    var el = document.getElementById('dash-jaar-filter');
    if (!el) return;
    var huidig = el.value;
    var jaren = {};
    DB.individueel.forEach(function(r) { if (r.jaar && r.status === 'actief') jaren[r.jaar] = true; });
    DB.collectief.forEach(function(r) { if (r.jaar && r.status === 'actief' && !r.module) jaren[r.jaar] = true; });
    var lijst = Object.keys(jaren).sort().reverse();
    var html = '<option value="">Alle jaren</option>';
    lijst.forEach(function(j) {
      html += '<option value="' + j + '"' + (String(j) === huidig ? ' selected' : '') + '>' + j + '</option>';
    });
    el.innerHTML = html;
  },

  _dashVulMaandFilter: function() {
    var el = document.getElementById('dash-maand-filter');
    if (!el) return;
    var huidig = el.value;
    var jaarEl = document.getElementById('dash-jaar-filter');
    var jaarFilter = jaarEl ? jaarEl.value : '';
    var volgorde = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
    var aanwezig = {};
    DB.individueel.forEach(function(r) {
      if (r.status !== 'actief') return;
      if (jaarFilter && String(r.jaar) !== jaarFilter) return;
      if (r.maand) aanwezig[r.maand] = true;
    });
    DB.collectief.forEach(function(r) {
      if (r.status !== 'actief' || r.module) return;
      if (jaarFilter && String(r.jaar) !== jaarFilter) return;
      if (r.maand) aanwezig[r.maand] = true;
    });
    var html = '<option value="">Alle maanden</option>';
    volgorde.forEach(function(m) {
      if (aanwezig[m]) {
        html += '<option value="' + m + '"' + (m === huidig ? ' selected' : '') + '>' + m + '</option>';
      }
    });
    el.innerHTML = html;
  },

  _dashResetMaandEnRender: function() {
    var el = document.getElementById('dash-maand-filter');
    if (el) el.value = '';
    App.renderDashboard();
  },

  _dashKPI: function(d) {
    var totUren = 0;
    d.ind.forEach(function(r) { totUren += App._tijdNaarUren(r.tijd); });
    var totBereik = 0;
    d.col.forEach(function(r) { totBereik += (r.aantalBewoners || 0); });
    var totNieuw = 0;
    d.col.forEach(function(r) { totNieuw += (r.waarvanNieuweBewoners || 0); });
    var vrijwNamen = {};
    d.col.forEach(function(r) {
      (r.naamVrijwilligers || []).forEach(function(n) { if (n) vrijwNamen[n] = true; });
    });
    var sigCount = 0;
    d.colAlle.forEach(function(r) { if (r.signalen) sigCount += (r.signaalTypes || []).length; });
    var toelCount = 0;
    d.ind.forEach(function(r) { if ((r.toeleiding || []).length > 0) toelCount++; });
    function stel(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }
    stel('kpi-personen', d.per.length);
    stel('kpi-ind', d.ind.length);
    stel('kpi-uren', (Math.round(totUren * 10) / 10) + 'u');
    stel('kpi-col', d.col.length);
    stel('kpi-bereik', totBereik);
    stel('kpi-nieuw', totNieuw);
    stel('kpi-vrijw', Object.keys(vrijwNamen).length);
    stel('kpi-signalen', sigCount);
    stel('kpi-toeleiding', toelCount);
  },

  _dashTop20: function(d) {
    var el = document.getElementById('dash-top20');
    if (!el) return;
    if (!d.ind.length) { el.innerHTML = '<div class="dash-leeg">Nog geen data.</div>'; return; }
    var perUren = {};
    d.ind.forEach(function(r) {
      var nr = r.persoonNummer;
      if (!perUren[nr]) perUren[nr] = 0;
      perUren[nr] += App._tijdNaarUren(r.tijd);
    });
    var lijst = [];
    for (var nr in perUren) {
      if (perUren.hasOwnProperty(nr)) lijst.push({ nr: parseInt(nr), uren: perUren[nr] });
    }
    lijst.sort(function(a, b) { return b.uren - a.uren; });
    lijst = lijst.slice(0, 20);
    var max = lijst.length ? lijst[0].uren : 1;
    if (max === 0) max = 1;
    var html = '<div class="dash-bar-lijst">';
    lijst.forEach(function(it, i) {
      var p = d.per.find(function(x) { return x.volgnummer === it.nr; });
      var naam = p ? ((p.voornaam || '').charAt(0).toUpperCase() + '.' + (p.familienaam || '').charAt(0).toUpperCase() + '.') : 'P#' + it.nr;
      var pct = Math.round((it.uren / max) * 100);
      var uren = Math.round(it.uren * 10) / 10;
      html += '<div class="dash-bi dash-bi-r">' +
        '<span class="dash-br">' + (i + 1) + '.</span>' +
        '<span class="dash-bl">' + App.esc(naam) + '</span>' +
        '<div class="dash-bt"><div class="dash-bf fill-groen" style="width:' + pct + '%"></div></div>' +
        '<span class="dash-bv">' + uren + 'u</span>' +
        '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  },

  _dashTop20Acties: function(d) {
    var el = document.getElementById('dash-top20-acties');
    if (!el) return;
    if (!d.ind.length) { el.innerHTML = '<div class="dash-leeg">Nog geen data.</div>'; return; }
    var perActies = {};
    d.ind.forEach(function(r) {
      var nr = r.persoonNummer;
      if (!perActies[nr]) perActies[nr] = 0;
      perActies[nr]++;
    });
    var lijst = [];
    for (var nr in perActies) {
      if (perActies.hasOwnProperty(nr)) lijst.push({ nr: parseInt(nr), acties: perActies[nr] });
    }
    lijst.sort(function(a, b) { return b.acties - a.acties; });
    lijst = lijst.slice(0, 20);
    var max = lijst.length ? lijst[0].acties : 1;
    if (max === 0) max = 1;
    var html = '<div class="dash-bar-lijst">';
    lijst.forEach(function(it, i) {
      var p = d.per.find(function(x) { return x.volgnummer === it.nr; });
      var naam = p ? ((p.voornaam || '').charAt(0).toUpperCase() + '.' + (p.familienaam || '').charAt(0).toUpperCase() + '.') : 'P#' + it.nr;
      var pct = Math.round((it.acties / max) * 100);
      html += '<div class="dash-bi dash-bi-r">' +
        '<span class="dash-br">' + (i + 1) + '.</span>' +
        '<span class="dash-bl">' + App.esc(naam) + '</span>' +
        '<div class="dash-bt"><div class="dash-bf fill-blauw" style="width:' + pct + '%"></div></div>' +
        '<span class="dash-bv">' + it.acties + 'x</span>' +
        '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  },

  _dashLevensdomeinen: function(d) {
    var el = document.getElementById('dash-levensdomeinen');
    if (!el) return;
    if (!d.ind.length) { el.innerHTML = '<div class="dash-leeg">Nog geen data.</div>'; return; }
    var teller = App._telVeld(d.ind, 'levensdomein');
    var sorted = App._sortTeller(teller, 'count');
    if (!sorted.length) { el.innerHTML = '<div class="dash-leeg">Nog geen data.</div>'; return; }
    var maxCount = sorted[0].data.count || 1;
    var maxUren = 0;
    sorted.forEach(function(it) { if (it.data.uren > maxUren) maxUren = it.data.uren; });
    if (maxUren === 0) maxUren = 1;
    var html = '<table class="dash-hm"><thead><tr><th>Domein</th><th>Contacten</th><th>Uren</th></tr></thead><tbody>';
    sorted.forEach(function(it) {
      var pc = it.data.count / maxCount;
      var pu = it.data.uren / maxUren;
      var gr = 'rgb(' + Math.round(216 - pc * 171) + ',' + Math.round(243 - pc * 137) + ',' + Math.round(220 - pc * 141) + ')';
      var bl = 'rgb(' + Math.round(219 - pu * 193) + ',' + Math.round(234 - pu * 148) + ',' + Math.round(251 - pu * 91) + ')';
      var uren = Math.round(it.data.uren * 10) / 10;
      html += '<tr>' +
        '<td>' + App.esc(it.label) + '</td>' +
        '<td><span class="dash-hmc" style="background:' + gr + '">' + it.data.count + '</span></td>' +
        '<td><span class="dash-hmc" style="background:' + bl + '">' + uren + 'u</span></td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  },

  _dashVindplaatsen: function(d) {
    var teller = App._telVeld(d.ind, 'vindplaats');
    var sorted = App._sortTeller(teller, 'count');
    var items = sorted.map(function(it) { return { label: it.label, value: it.data.count }; });
    App._renderBars('dash-vp-contacten', items, 'fill-groen', false);
    var sortedU = App._sortTeller(teller, 'uren');
    var itemsU = sortedU.map(function(it) { return { label: it.label, value: Math.round(it.data.uren * 10) / 10, suffix: 'u' }; });
    App._renderBars('dash-vp-uren', itemsU, 'fill-blauw', false);
  },

  _dashToeleiding: function(d) {
    var teller = App._telVeld(d.ind, 'toeleiding');
    var sorted = App._sortTeller(teller, 'count');
    var items = sorted.map(function(it) { return { label: it.label, value: it.data.count }; });
    App._renderBars('dash-toeleiding', items, 'fill-oranje', false);
    var elRatio = document.getElementById('dash-toeleiding-ratio');
    if (elRatio) {
      var metToeleiding = d.ind.filter(function(r) { return (r.toeleiding || []).length > 0; }).length;
      var totInd = d.ind.length;
      var pct = totInd ? Math.round((metToeleiding / totInd) * 100) : 0;
      elRatio.innerHTML = '<strong>' + pct + '%</strong> van de individuele acties leidde tot doorverwijzing (' + metToeleiding + ' van ' + totInd + ')';
    }
  },

  _dashMethodiekInd: function(d) {
    var teller = App._telVeld(d.ind, 'methodiek');
    var sorted = App._sortTeller(teller, 'count');
    var items = sorted.map(function(it) { return { label: it.label, value: it.data.count }; });
    App._renderBars('dash-methodiek-ind', items, 'fill-paars', false);
  },

  /* ── Individueel sectie-filter ── */
  _dashIndVulFilters: function() {
    var jaarEl  = document.getElementById('dash-ind-jaar');
    var maandEl = document.getElementById('dash-ind-maand');
    if (!jaarEl || !maandEl) return;

    // Jaar: huidig jaar en 2 vorige jaren
    var huidigJaar = new Date().getFullYear();
    var huidigVal  = jaarEl.value || String(huidigJaar);
    var jHtml = '';
    for (var j = huidigJaar; j >= huidigJaar - 2; j--) {
      jHtml += '<option value="' + j + '"' + (String(j) === huidigVal ? ' selected' : '') + '>' + j + '</option>';
    }
    jaarEl.innerHTML = jHtml;

    // Maand: alle 12 maanden
    var maanden = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
    var huidigMaand = maandEl.value;
    var mHtml = '<option value="">Alle maanden</option>';
    maanden.forEach(function(m) {
      mHtml += '<option value="' + m + '"' + (m === huidigMaand ? ' selected' : '') + '>' + m + '</option>';
    });
    maandEl.innerHTML = mHtml;
  },

  _dashIndData: function() {
    var jaarEl  = document.getElementById('dash-ind-jaar');
    var maandEl = document.getElementById('dash-ind-maand');
    var jaarFilter  = jaarEl  ? jaarEl.value  : '';
    var maandFilter = maandEl ? maandEl.value : '';
    var ind = DB.individueel.filter(function(r) {
      if (jaarFilter  && String(r.jaar) !== jaarFilter)  return false;
      if (maandFilter && r.maand !== maandFilter)         return false;
      return true;
    });
    return { per: DB.personen, ind: ind };
  },

  _dashIndRender: function() {
    var data = App._dashIndData();
    App._dashIndBlok8(data);
    App._dashIndBlok7(data);
    App._dashIndBlok6(data);
    App._dashIndBlok5(data);
    App._dashIndBlok4(data);
    App._dashIndBlok3(data);
    App._dashIndBlok2(data);
    App._dashIndBlok1(data);
  },

  /* Helper: sorteer een eenvoudig {label: count} object aflopend */
  _sortObjCount: function(obj) {
    var arr = [];
    for (var k in obj) {
      if (obj.hasOwnProperty(k)) arr.push({ label: k, value: obj[k] });
    }
    arr.sort(function(a, b) { return b.value - a.value; });
    return arr;
  },

  /* Helper: tel enkelvoudig veld uit array van records */
  _telEnkel: function(records, veld) {
    var teller = {};
    records.forEach(function(r) {
      var v = r[veld] || 'Onbekend';
      teller[v] = (teller[v] || 0) + 1;
    });
    return teller;
  },

  /* Helper: tel meerwaardig (array) veld uit array van records */
  _telMeervoud: function(records, veld) {
    var teller = {};
    records.forEach(function(r) {
      var vals = r[veld] || [];
      if (!Array.isArray(vals)) vals = [vals];
      if (!vals.length) { teller['Onbekend'] = (teller['Onbekend'] || 0) + 1; return; }
      vals.forEach(function(v) { if (v) teller[v] = (teller[v] || 0) + 1; });
    });
    return teller;
  },

  /* ── Blok 8: Kwetsbaarheid & nood ── */
  _dashIndBlok8: function(data) {
    var kwetsbaarInkomen   = ['Leefloon', 'Geen inkomen', 'Invaliditeit', 'Werkloosheid'];
    var kwetsbaarHuisvest  = ['Dak/Thuisloos', 'Begeleid wonen', 'Housing First'];

    // Filter personen tot diegenen met acties in de periode
    var nummers = {};
    data.ind.forEach(function(r) { nummers[r.persoonNummer] = true; });
    var per = data.per.filter(function(p) { return nummers[p.volgnummer]; });

    if (!per.length) {
      ['dash-ind-kwets-dist','dash-ind-kwets-top10'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = '<div class="dash-leeg">Nog geen data.</div>';
      });
      return;
    }

    // Unieke levensdomeinen per persoon in de gefilterde periode
    var domeinenPerPersoon = {};
    data.ind.forEach(function(r) {
      var ld = r.levensdomein || [];
      if (!Array.isArray(ld)) ld = [ld];
      if (!domeinenPerPersoon[r.persoonNummer]) domeinenPerPersoon[r.persoonNummer] = {};
      ld.forEach(function(d) { if (d) domeinenPerPersoon[r.persoonNummer][d] = true; });
    });

    // Bereken score per persoon
    var scores = [];
    per.forEach(function(p) {
      var score = 0;
      var reden = [];

      // 1. Kwetsbaar inkomen
      var ink = p.inkomen || [];
      if (!Array.isArray(ink)) ink = [ink];
      var heeftKwetsbaarInkomen = ink.some(function(v) { return kwetsbaarInkomen.indexOf(v) !== -1; });
      if (heeftKwetsbaarInkomen) { score++; reden.push('Laag inkomen'); }

      // 2. Precaire huisvesting
      var huis = p.huisvesting || [];
      if (!Array.isArray(huis)) huis = [huis];
      var heeftPrecaireHuisvest = huis.some(function(v) { return kwetsbaarHuisvest.indexOf(v) !== -1; });
      if (heeftPrecaireHuisvest) { score++; reden.push('Precaire huisvesting'); }

      // 3. Acties in 3+ levensdomeinen
      var domeinen = Object.keys(domeinenPerPersoon[p.volgnummer] || {});
      if (domeinen.length >= 3) { score++; reden.push(domeinen.length + ' levensdomeinen'); }

      var initialen = (p.voornaam || '').charAt(0).toUpperCase() + '.' +
                      (p.familienaam || '').charAt(0).toUpperCase() + '.';
      scores.push({ initialen: initialen, score: score, reden: reden, domeinen: domeinen });
    });

    // Verdeling 0-3
    var dist = { '0': 0, '1': 0, '2': 0, '3': 0 };
    scores.forEach(function(s) { dist[String(s.score)]++; });
    var scoreKleuren = { '0': 'fill-groen', '1': 'fill-oranje', '2': 'fill-rood', '3': 'fill-rood' };
    var scoreLbls    = { '0': 'Score 0 — niet kwetsbaar', '1': 'Score 1 — licht kwetsbaar', '2': 'Score 2 — matig kwetsbaar', '3': 'Score 3 — hoog kwetsbaar' };
    var distItems = ['0','1','2','3'].map(function(k) {
      return { label: 'Score ' + k, value: dist[k] };
    }).filter(function(it) { return it.value > 0; });
    App._renderBars('dash-ind-kwets-dist', distItems.map(function(it, i) {
      return { label: it.label, value: it.value };
    }), 'fill-oranje', false);

    // Legenda
    var elLeg = document.getElementById('dash-ind-kwets-legenda');
    if (elLeg) {
      elLeg.innerHTML = Object.keys(scoreLbls).map(function(k) {
        return '<div>' + scoreLbls[k] + ': <strong>' + (dist[k] || 0) + ' personen</strong></div>';
      }).join('') +
      '<div style="margin-top:6px">Criteria: laag inkomen · precaire huisvesting · ≥3 levensdomeinen</div>';
    }

    // Top 10 hoogste score
    var elTop = document.getElementById('dash-ind-kwets-top10');
    if (!elTop) return;
    var top10 = scores.slice().sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return b.domeinen.length - a.domeinen.length;
    }).slice(0, 10);

    if (!top10.length) { elTop.innerHTML = '<div class="dash-leeg">Geen data.</div>'; return; }

    var scoreAchtergrond = ['var(--groen-licht)','var(--oranje-licht)','#fde8e8','#fde8e8'];
    var scoreTekst       = ['var(--groen)','var(--oranje)','var(--rood)','var(--rood)'];
    var html = '<table class="dash-hm"><thead><tr>' +
      '<th>#</th><th>Initialen</th><th>Score</th><th>Actieve domeinen</th><th>Factoren</th>' +
      '</tr></thead><tbody>';
    top10.forEach(function(it, i) {
      var bg  = scoreAchtergrond[it.score] || '#f3f4f6';
      var clr = scoreTekst[it.score]       || 'var(--tekst)';
      html += '<tr>' +
        '<td style="color:var(--zacht);font-size:0.7rem">' + (i+1) + '</td>' +
        '<td style="font-weight:700">' + App.esc(it.initialen) + '</td>' +
        '<td><span class="dash-hmc" style="background:' + bg + ';color:' + clr + ';font-weight:700">' + it.score + '/3</span></td>' +
        '<td style="font-size:0.7rem">' + App.esc(it.domeinen.join(', ') || '—') + '</td>' +
        '<td style="font-size:0.7rem;color:var(--zacht)">' + App.esc(it.reden.join(', ') || '—') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    elTop.innerHTML = html;
  },

  /* ── Blok 7: Samenwerking ── */
  _dashIndBlok7: function(data) {
    var collegas = ['MW', 'SHW', 'Woonzorg', 'Brugfiguur'];

    // Filter personen tot diegenen met acties in de periode
    var nummers = {};
    data.ind.forEach(function(r) { nummers[r.persoonNummer] = true; });
    var per = data.per.filter(function(p) { return nummers[p.volgnummer]; });

    if (!per.length) {
      ['dash-ind-gekend-bar','dash-ind-gekend-spread','dash-ind-overlap'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = '<div class="dash-leeg">Nog geen data.</div>';
      });
      return;
    }

    // ── Gekend bij verdeling (bar) ──
    var gekendTeller = {};
    collegas.forEach(function(c) { gekendTeller[c] = 0; });
    per.forEach(function(p) {
      var vals = p.gekendBij || [];
      if (!Array.isArray(vals)) vals = [vals];
      vals.forEach(function(v) { if (gekendTeller.hasOwnProperty(v)) gekendTeller[v]++; });
    });
    var maxG = 0;
    collegas.forEach(function(c) { if (gekendTeller[c] > maxG) maxG = gekendTeller[c]; });
    if (maxG === 0) maxG = 1;
    var fillKleuren = { 'MW': 'fill-groen', 'SHW': 'fill-blauw', 'Woonzorg': 'fill-oranje', 'Brugfiguur': 'fill-paars' };
    var html = '<div class="dash-bar-lijst">';
    collegas.forEach(function(c) {
      var v = gekendTeller[c];
      var pct = Math.round((v / maxG) * 100);
      html += '<div class="dash-bi">' +
        '<span class="dash-bl">' + c + '</span>' +
        '<div class="dash-bt"><div class="dash-bf ' + (fillKleuren[c] || 'fill-groen') + '" style="width:' + pct + '%"></div></div>' +
        '<span class="dash-bv">' + v + '</span>' +
        '</div>';
    });
    html += '</div>';
    var elBar = document.getElementById('dash-ind-gekend-bar');
    if (elBar) elBar.innerHTML = html;

    // ── Spreiding: aantal collega's per persoon ──
    var spreadTeller = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 };
    per.forEach(function(p) {
      var vals = (p.gekendBij || []).filter(function(v) { return collegas.indexOf(v) !== -1; });
      var n = String(Math.min(vals.length, 4));
      spreadTeller[n]++;
    });
    var spreadItems = [
      { label: '0 collega\'s', value: spreadTeller['0'] },
      { label: '1 collega',    value: spreadTeller['1'] },
      { label: '2 collega\'s', value: spreadTeller['2'] },
      { label: '3 collega\'s', value: spreadTeller['3'] },
      { label: '4 collega\'s', value: spreadTeller['4'] }
    ].filter(function(it) { return it.value > 0; });
    App._renderBars('dash-ind-gekend-spread', spreadItems, 'fill-groen2', false);

    // ── Overlapmatrix ──
    var elOverlap = document.getElementById('dash-ind-overlap');
    if (!elOverlap) return;

    // Diagonaal = totaal per collega; off-diagonaal = pairwise overlap
    var matrix = {};
    collegas.forEach(function(a) {
      matrix[a] = {};
      collegas.forEach(function(b) { matrix[a][b] = 0; });
    });
    per.forEach(function(p) {
      var vals = (p.gekendBij || []).filter(function(v) { return collegas.indexOf(v) !== -1; });
      vals.forEach(function(a) {
        vals.forEach(function(b) { matrix[a][b]++; });
      });
    });

    var maxM = 0;
    collegas.forEach(function(a) {
      collegas.forEach(function(b) { if (matrix[a][b] > maxM) maxM = matrix[a][b]; });
    });
    if (maxM === 0) maxM = 1;

    var html2 = '<table class="dash-hm"><thead><tr><th></th>';
    collegas.forEach(function(c) { html2 += '<th>' + c + '</th>'; });
    html2 += '</tr></thead><tbody>';
    collegas.forEach(function(a) {
      html2 += '<tr><td style="font-weight:600">' + a + '</td>';
      collegas.forEach(function(b) {
        var v = matrix[a][b];
        if (v === 0) {
          html2 += '<td style="text-align:center;color:#ccc">—</td>';
        } else if (a === b) {
          // Diagonaal: totaal
          html2 += '<td><span class="dash-hmc" style="background:var(--groen-licht);color:var(--groen)">' + v + '</span></td>';
        } else {
          var int = Math.round(219 - (v / maxM) * 160);
          html2 += '<td><span class="dash-hmc" style="background:rgb(' + int + ',' + Math.round(int * 0.7) + ',' + Math.round(int * 1.1) + ')">' + v + '</span></td>';
        }
      });
      html2 += '</tr>';
    });
    html2 += '</tbody></table>';
    elOverlap.innerHTML = html2;
  },

  /* ── Blok 6: Evolutie in tijd ── */
  _dashIndBlok6: function(data) {
    var maanden = ['Januari','Februari','Maart','April','Mei','Juni',
                   'Juli','Augustus','September','Oktober','November','December'];
    var jaarEl = document.getElementById('dash-ind-jaar');
    var huidigJaar = jaarEl && jaarEl.value ? parseInt(jaarEl.value) : new Date().getFullYear();
    var vorigJaar  = huidigJaar - 1;

    // ── Nieuwe personen per maand (op basis van aangemaakt-datum) ──
    var elNieuw = document.getElementById('dash-ind-nieuwe-per-maand');
    if (elNieuw) {
      var nieuwPerMaand = {};
      maanden.forEach(function(m) { nieuwPerMaand[m] = 0; });
      DB.personen.forEach(function(p) {
        if (!p.aangemaakt) return;
        var d = new Date(p.aangemaakt);
        if (d.getFullYear() !== huidigJaar) return;
        var mn = maanden[d.getMonth()];
        nieuwPerMaand[mn] = (nieuwPerMaand[mn] || 0) + 1;
      });
      var maxN = 0;
      maanden.forEach(function(m) { if (nieuwPerMaand[m] > maxN) maxN = nieuwPerMaand[m]; });
      if (maxN === 0) maxN = 1;
      var html = '<div class="dash-bar-lijst">';
      maanden.forEach(function(m) {
        var v   = nieuwPerMaand[m];
        var pct = Math.round((v / maxN) * 100);
        var lbl = m.substring(0, 3);
        html += '<div class="dash-bi">' +
          '<span class="dash-bl" style="min-width:32px">' + lbl + '</span>' +
          '<div class="dash-bt"><div class="dash-bf fill-groen" style="width:' + pct + '%"></div></div>' +
          '<span class="dash-bv">' + v + '</span>' +
          '</div>';
      });
      html += '</div>';
      elNieuw.innerHTML = html;
    }

    // ── Acties per maand: huidig jaar (balk) vs vorig jaar (grijze balk eronder) ──
    var elActies = document.getElementById('dash-ind-acties-per-maand');
    if (elActies) {
      var huidigPerMaand = {};
      var vorigPerMaand  = {};
      maanden.forEach(function(m) { huidigPerMaand[m] = 0; vorigPerMaand[m] = 0; });
      DB.individueel.forEach(function(r) {
        if (!r.jaar || !r.maand) return;
        if (r.jaar === huidigJaar && huidigPerMaand.hasOwnProperty(r.maand)) huidigPerMaand[r.maand]++;
        if (r.jaar === vorigJaar  && vorigPerMaand.hasOwnProperty(r.maand))  vorigPerMaand[r.maand]++;
      });
      var maxA = 0;
      maanden.forEach(function(m) {
        if (huidigPerMaand[m] > maxA) maxA = huidigPerMaand[m];
        if (vorigPerMaand[m]  > maxA) maxA = vorigPerMaand[m];
      });
      if (maxA === 0) maxA = 1;
      var html2 = '<div style="font-size:0.65rem;color:var(--zacht);margin-bottom:6px;display:flex;gap:12px">' +
        '<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--blauw);margin-right:3px"></span>' + huidigJaar + '</span>' +
        '<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#c8d0dc;margin-right:3px"></span>' + vorigJaar + '</span>' +
        '</div><div class="dash-bar-lijst">';
      maanden.forEach(function(m) {
        var h   = huidigPerMaand[m];
        var v   = vorigPerMaand[m];
        var ph  = Math.round((h / maxA) * 100);
        var pv  = Math.round((v / maxA) * 100);
        var lbl = m.substring(0, 3);
        html2 += '<div style="margin-bottom:3px">' +
          '<div class="dash-bi">' +
            '<span class="dash-bl" style="min-width:32px">' + lbl + '</span>' +
            '<div class="dash-bt"><div class="dash-bf fill-blauw" style="width:' + ph + '%"></div></div>' +
            '<span class="dash-bv">' + h + '</span>' +
          '</div>' +
          '<div class="dash-bi" style="opacity:0.55">' +
            '<span class="dash-bl" style="min-width:32px"></span>' +
            '<div class="dash-bt"><div class="dash-bf" style="width:' + pv + '%;background:#c8d0dc"></div></div>' +
            '<span class="dash-bv">' + v + '</span>' +
          '</div>' +
        '</div>';
      });
      html2 += '</div>';
      elActies.innerHTML = html2;
    }
  },

  /* ── Blok 5: Intensiteit per persoon ── */
  _maandNaarNummer: function(m) {
    var map = { 'Januari':0,'Februari':1,'Maart':2,'April':3,'Mei':4,'Juni':5,
                'Juli':6,'Augustus':7,'September':8,'Oktober':9,'November':10,'December':11 };
    return map[m] !== undefined ? map[m] : 0;
  },

  _actieDatum: function(r) {
    if (!r.jaar) return null;
    return new Date(r.jaar, App._maandNaarNummer(r.maand || 'Januari'), 1);
  },

  _statusBadge: function(maandenGeleden) {
    if (maandenGeleden < 3)  return '<span style="background:var(--groen-licht);color:var(--groen);font-size:0.6rem;font-weight:700;padding:1px 6px;border-radius:8px;margin-left:4px">actief</span>';
    if (maandenGeleden < 12) return '<span style="background:var(--oranje-licht);color:var(--oranje);font-size:0.6rem;font-weight:700;padding:1px 6px;border-radius:8px;margin-left:4px">sluimerend</span>';
    return '<span style="background:#fde8e8;color:var(--rood);font-size:0.6rem;font-weight:700;padding:1px 6px;border-radius:8px;margin-left:4px">inactief</span>';
  },

  _dashIndBlok5: function(data) {
    var nu = new Date();

    // Laatste actiedatum per persoon (over ALLE data, niet alleen filter)
    var alleActies = DB.individueel;
    var laatstePer = {};
    alleActies.forEach(function(r) {
      var d = App._actieDatum(r);
      if (!d) return;
      var nr = r.persoonNummer;
      if (!laatstePer[nr] || d > laatstePer[nr]) laatstePer[nr] = d;
    });

    function maandenGeleden(d) {
      if (!d) return 999;
      return (nu.getFullYear() - d.getFullYear()) * 12 + (nu.getMonth() - d.getMonth());
    }

    // Top 20 uren met statusbadge
    function renderTop20(elId, teller, sleutel, suffix) {
      var el = document.getElementById(elId);
      if (!el) return;
      if (!data.ind.length) { el.innerHTML = '<div class="dash-leeg">Nog geen data.</div>'; return; }
      var lijst = [];
      for (var nr in teller) {
        if (teller.hasOwnProperty(nr)) lijst.push({ nr: parseInt(nr), val: teller[nr] });
      }
      lijst.sort(function(a, b) { return b.val - a.val; });
      lijst = lijst.slice(0, 20);
      var max = lijst.length ? lijst[0].val : 1;
      if (max === 0) max = 1;
      var html = '<div class="dash-bar-lijst">';
      lijst.forEach(function(it, i) {
        var p    = data.per.find(function(x) { return x.volgnummer === it.nr; });
        var naam = p ? ((p.voornaam||'').charAt(0).toUpperCase() + '.' + (p.familienaam||'').charAt(0).toUpperCase() + '.') : 'P#' + it.nr;
        var mg   = maandenGeleden(laatstePer[it.nr]);
        var badge = App._statusBadge(mg);
        var pct  = Math.round((it.val / max) * 100);
        html += '<div class="dash-bi dash-bi-r">' +
          '<span class="dash-br">' + (i+1) + '.</span>' +
          '<span class="dash-bl">' + App.esc(naam) + badge + '</span>' +
          '<div class="dash-bt"><div class="dash-bf ' + sleutel + '" style="width:' + pct + '%"></div></div>' +
          '<span class="dash-bv">' + it.val + suffix + '</span>' +
          '</div>';
      });
      html += '</div>';
      el.innerHTML = html;
    }

    var urenPer = {};
    data.ind.forEach(function(r) {
      if (!urenPer[r.persoonNummer]) urenPer[r.persoonNummer] = 0;
      urenPer[r.persoonNummer] += App._tijdNaarUren(r.tijd);
    });
    var urenAfgerond = {};
    for (var k in urenPer) { if (urenPer.hasOwnProperty(k)) urenAfgerond[k] = Math.round(urenPer[k] * 10) / 10; }
    renderTop20('dash-ind-top20-status', urenAfgerond, 'fill-groen', 'u');

    var actiesPer = {};
    data.ind.forEach(function(r) {
      actiesPer[r.persoonNummer] = (actiesPer[r.persoonNummer] || 0) + 1;
    });
    renderTop20('dash-ind-top20-acties-status', actiesPer, 'fill-blauw', 'x');

    // Sluimerende contacten: minstens 1 actie ooit, geen actie de laatste 6 maanden
    var elSlui = document.getElementById('dash-ind-sluimerend');
    if (!elSlui) return;
    var sluimerend = [];
    for (var nr in laatstePer) {
      if (!laatstePer.hasOwnProperty(nr)) continue;
      var mg2 = maandenGeleden(laatstePer[nr]);
      if (mg2 >= 6) {
        var p2 = data.per.find(function(x) { return x.volgnummer === parseInt(nr); });
        var initialen = p2
          ? ((p2.voornaam||'').charAt(0).toUpperCase() + '.' + (p2.familienaam||'').charAt(0).toUpperCase() + '.')
          : 'P#' + nr;
        var aantalActies = alleActies.filter(function(r) { return r.persoonNummer === parseInt(nr); }).length;
        sluimerend.push({ nr: parseInt(nr), initialen: initialen, laatste: laatstePer[nr], mg: mg2, acties: aantalActies });
      }
    }
    sluimerend.sort(function(a, b) { return a.mg - b.mg; }); // minst lang sluimerend eerst
    if (!sluimerend.length) {
      elSlui.innerHTML = '<div class="dash-leeg">Geen sluimerende contacten.</div>';
      return;
    }
    var html2 = '<table class="dash-hm"><thead><tr>' +
      '<th>Persoon</th><th>Laatste contact</th><th>Maanden geleden</th><th>Totaal acties</th><th>Status</th>' +
      '</tr></thead><tbody>';
    sluimerend.forEach(function(it) {
      var maand = it.laatste.toLocaleString('nl-BE', { month: 'long', year: 'numeric' });
      html2 += '<tr>' +
        '<td style="font-weight:600">' + App.esc(it.initialen) + '</td>' +
        '<td>' + maand + '</td>' +
        '<td style="text-align:center">' + it.mg + '</td>' +
        '<td style="text-align:center">' + it.acties + '</td>' +
        '<td>' + App._statusBadge(it.mg) + '</td>' +
        '</tr>';
    });
    html2 += '</tbody></table>';
    elSlui.innerHTML = html2;
  },

  /* ── Blok 4: Toeleiding & netwerk ── */
  _dashIndBlok4: function(data) {
    // Prominente metric: % acties met toeleiding
    var elRatio = document.getElementById('dash-ind-toel-ratio');
    if (elRatio) {
      var metToel = data.ind.filter(function(r) { return (r.toeleiding || []).length > 0; }).length;
      var totaal  = data.ind.length;
      var pct     = totaal ? Math.round((metToel / totaal) * 100) : 0;
      elRatio.innerHTML = '<strong>' + pct + '%</strong> van de acties leidde tot een doorverwijzing' +
        ' <span style="color:var(--zacht);font-size:0.85em">(' + metToel + ' van ' + totaal + ' acties)</span>';
    }

    // Toeleiding balkgrafiek
    var teller  = App._telVeld(data.ind, 'toeleiding');
    var sorted  = App._sortTeller(teller, 'count');
    App._renderBars('dash-ind-toeleiding',
      sorted.map(function(it) { return { label: it.label, value: it.data.count }; }),
      'fill-oranje', false);

    // Kruistabel: rijen = levensdomeinen, kolommen = toeleiding-organisaties
    var elKruis = document.getElementById('dash-ind-toel-kruis');
    if (!elKruis) return;
    if (!data.ind.length) { elKruis.innerHTML = '<div class="dash-leeg">Nog geen data.</div>'; return; }

    var domeinen = {}, orgs = {}, matrix = {};
    data.ind.forEach(function(r) {
      var ld = r.levensdomein || [];
      var tl = r.toeleiding   || [];
      if (!Array.isArray(ld)) ld = [ld];
      if (!Array.isArray(tl)) tl = [tl];
      ld.forEach(function(d) {
        if (!d) return;
        domeinen[d] = true;
        tl.forEach(function(o) {
          if (!o) return;
          orgs[o] = true;
          var sleutel = d + '||' + o;
          matrix[sleutel] = (matrix[sleutel] || 0) + 1;
        });
      });
    });

    var domLijst = Object.keys(domeinen).sort();
    var orgLijst = Object.keys(orgs).sort();
    if (!domLijst.length || !orgLijst.length) {
      elKruis.innerHTML = '<div class="dash-leeg">Geen kruisdata beschikbaar.</div>';
      return;
    }

    var maxVal = 0;
    domLijst.forEach(function(d) {
      orgLijst.forEach(function(o) {
        var v = matrix[d + '||' + o] || 0;
        if (v > maxVal) maxVal = v;
      });
    });
    if (maxVal === 0) maxVal = 1;

    var html = '<table class="dash-hm"><thead><tr><th>Domein</th>';
    orgLijst.forEach(function(o) { html += '<th>' + App.esc(o) + '</th>'; });
    html += '</tr></thead><tbody>';
    domLijst.forEach(function(d) {
      html += '<tr><td style="font-weight:600">' + App.esc(d) + '</td>';
      orgLijst.forEach(function(o) {
        var v = matrix[d + '||' + o] || 0;
        if (v === 0) {
          html += '<td style="text-align:center;color:#ccc">—</td>';
        } else {
          var int = Math.round(200 - (v / maxVal) * 155);
          html += '<td><span class="dash-hmc" style="background:rgb(' + int + ',' + Math.round(int * 0.6) + ',50);color:white">' + v + '</span></td>';
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    elKruis.innerHTML = html;
  },

  /* ── Blok 3: Wat doe je? ── */
  _dashIndBlok3: function(data) {
    // Levensdomeinen heatmap met extra kolom: gemiddelde tijdsinvestering
    var elLd = document.getElementById('dash-ind-levensdomeinen');
    if (elLd) {
      if (!data.ind.length) {
        elLd.innerHTML = '<div class="dash-leeg">Nog geen data.</div>';
      } else {
        var teller = App._telVeld(data.ind, 'levensdomein');
        var sorted = App._sortTeller(teller, 'count');
        if (!sorted.length) {
          elLd.innerHTML = '<div class="dash-leeg">Nog geen data.</div>';
        } else {
          var maxC = sorted[0].data.count || 1;
          var maxU = 0;
          sorted.forEach(function(it) { if (it.data.uren > maxU) maxU = it.data.uren; });
          if (maxU === 0) maxU = 1;
          var html = '<table class="dash-hm"><thead><tr>' +
            '<th>Domein</th><th>Contacten</th><th>Uren</th><th>Gem. tijd</th>' +
            '</tr></thead><tbody>';
          sorted.forEach(function(it) {
            var pc = it.data.count / maxC;
            var pu = it.data.uren / maxU;
            var gr = 'rgb(' + Math.round(216 - pc*171) + ',' + Math.round(243 - pc*137) + ',' + Math.round(220 - pc*141) + ')';
            var bl = 'rgb(' + Math.round(219 - pu*193) + ',' + Math.round(234 - pu*148) + ',' + Math.round(251 - pu*91) + ')';
            var uren = Math.round(it.data.uren * 10) / 10;
            var gem  = it.data.count ? Math.round((it.data.uren / it.data.count) * 10) / 10 : 0;
            html += '<tr>' +
              '<td>' + App.esc(it.label) + '</td>' +
              '<td><span class="dash-hmc" style="background:' + gr + '">' + it.data.count + '</span></td>' +
              '<td><span class="dash-hmc" style="background:' + bl + '">' + uren + 'u</span></td>' +
              '<td><span class="dash-hmc" style="background:#f3f4f6">' + gem + 'u</span></td>' +
              '</tr>';
          });
          html += '</tbody></table>';
          elLd.innerHTML = html;
        }
      }
    }

    // Top 10 combinaties levensdomein + methodiek
    var comboTeller = {};
    data.ind.forEach(function(r) {
      var ld = r.levensdomein || [];
      var me = r.methodiek    || [];
      if (!Array.isArray(ld)) ld = [ld];
      if (!Array.isArray(me)) me = [me];
      ld.forEach(function(d) {
        me.forEach(function(m) {
          if (!d || !m) return;
          var sleutel = d + ' + ' + m;
          comboTeller[sleutel] = (comboTeller[sleutel] || 0) + 1;
        });
      });
    });
    var comboItems = App._sortObjCount(comboTeller).slice(0, 10);
    App._renderBars('dash-ind-combo-lm', comboItems, 'fill-groen2', true);
  },

  /* ── Blok 2: Hoe kom je bij mensen? ── */
  _dashIndBlok2: function(data) {
    // Vindplaatsen op basis van gefilterde acties
    var teller = App._telVeld(data.ind, 'vindplaats');
    var sortedFreq = App._sortTeller(teller, 'count');
    var sortedUren = App._sortTeller(teller, 'uren');
    App._renderBars('dash-ind-vp-freq',
      sortedFreq.map(function(it) { return { label: it.label, value: it.data.count }; }),
      'fill-groen', false);
    App._renderBars('dash-ind-vp-uren',
      sortedUren.map(function(it) { return { label: it.label, value: Math.round(it.data.uren * 10) / 10, suffix: 'u' }; }),
      'fill-blauw', false);

    // Eerste contact — op basis van personen met acties in de periode
    var nummers = {};
    data.ind.forEach(function(r) { nummers[r.persoonNummer] = true; });
    var per = data.per.filter(function(p) { return nummers[p.volgnummer]; });
    App._renderBars('dash-ind-eerste',
      App._sortObjCount(App._telEnkel(per, 'eersteContact')),
      'fill-oranje', false);
  },

  /* ── Blok 1: Wie bereik je? ── */
  _dashIndBlok1: function(data) {
    // Filter personen tot enkel diegenen met acties in de geselecteerde periode
    var nummers = {};
    data.ind.forEach(function(r) { nummers[r.persoonNummer] = true; });
    var per = data.per.filter(function(p) { return nummers[p.volgnummer]; });

    var leeftijdVolgorde = ['-18','18-25','26-40','41-60','61-80','80+'];
    var leeftijdTeller = App._telEnkel(per, 'leeftijd');
    var leeftijdItems = leeftijdVolgorde
      .filter(function(k) { return leeftijdTeller[k]; })
      .map(function(k) { return { label: k, value: leeftijdTeller[k] }; });
    for (var k in leeftijdTeller) {
      if (leeftijdVolgorde.indexOf(k) === -1) leeftijdItems.push({ label: k, value: leeftijdTeller[k] });
    }
    App._renderBars('dash-ind-leeftijd', leeftijdItems, 'fill-groen', false);

    App._renderBars('dash-ind-inkomen',
      App._sortObjCount(App._telMeervoud(per, 'inkomen')), 'fill-blauw', false);

    App._renderBars('dash-ind-woonsituatie',
      App._sortObjCount(App._telEnkel(per, 'woonsituatie')), 'fill-oranje', false);

    App._renderBars('dash-ind-huisvesting',
      App._sortObjCount(App._telMeervoud(per, 'huisvesting')), 'fill-paars', false);
  },

  _dashClusterBereik: function(d) {
    var teller = {};
    d.col.forEach(function(r) {
      (r.cluster || []).forEach(function(c) {
        if (!c) return;
        if (!teller[c]) teller[c] = { count: 0, bewoners: 0 };
        teller[c].count++;
        teller[c].bewoners += (r.aantalBewoners || 0);
      });
    });
    var sorted = [];
    for (var k in teller) {
      if (teller.hasOwnProperty(k)) sorted.push({ label: k, value: teller[k].bewoners });
    }
    sorted.sort(function(a, b) { return b.value - a.value; });
    App._renderBars('dash-cluster-bereik', sorted, 'fill-blauw', false);
  },

  _dashClusterRendement: function(d) {
    var teller = {};
    d.col.forEach(function(r) {
      (r.cluster || []).forEach(function(c) {
        if (!c) return;
        if (!teller[c]) teller[c] = { count: 0, bewoners: 0 };
        teller[c].count++;
        teller[c].bewoners += (r.aantalBewoners || 0);
      });
    });
    var sorted = [];
    for (var k in teller) {
      if (teller.hasOwnProperty(k)) {
        var gem = teller[k].count ? Math.round((teller[k].bewoners / teller[k].count) * 10) / 10 : 0;
        sorted.push({ label: k, value: gem });
      }
    }
    sorted.sort(function(a, b) { return b.value - a.value; });
    App._renderBars('dash-cluster-rend', sorted, 'fill-groen2', false);
  },

  _dashThema: function(d) {
    var teller = {};
    d.col.forEach(function(r) {
      (r.thema || []).forEach(function(t) {
        if (!t) return;
        if (!teller[t]) teller[t] = 0;
        teller[t] += (r.aantalBewoners || 0);
      });
    });
    var sorted = [];
    for (var k in teller) {
      if (teller.hasOwnProperty(k)) sorted.push({ label: k, value: teller[k] });
    }
    sorted.sort(function(a, b) { return b.value - a.value; });
    App._renderBars('dash-thema', sorted, 'fill-paars', true);
  },

  _dashVrijwilligers: function(d) {
    var el = document.getElementById('dash-vrijwilligers');
    if (!el) return;
    var vrijwData = {};
    d.col.forEach(function(r) {
      (r.naamVrijwilligers || []).forEach(function(naam) {
        if (!naam || !naam.trim()) return;
        // Eerste letter van elk woord → volledige initialen, case-insensitive groepering
        var init = naam.trim().split(/\s+/).filter(Boolean)
          .map(function(w) { return w.charAt(0).toUpperCase(); }).join('');
        var sleutel = init; // al uppercase
        if (!sleutel) return;
        if (!vrijwData[sleutel]) vrijwData[sleutel] = { initialen: init, acties: 0 };
        vrijwData[sleutel].acties++;
      });
    });
    var lijst = [];
    for (var k in vrijwData) {
      if (vrijwData.hasOwnProperty(k)) lijst.push(vrijwData[k]);
    }
    lijst.sort(function(a, b) { return b.acties - a.acties; });
    if (!lijst.length) { el.innerHTML = '<div class="dash-leeg">Nog geen data.</div>'; return; }
    var maxActies = lijst[0].acties || 1;
    var html = '<table class="dash-vt"><thead><tr><th>Initialen</th><th>Inzet</th><th>Totaal</th></tr></thead><tbody>';
    lijst.forEach(function(v) {
      var pct = Math.round((v.acties / maxActies) * 100);
      html += '<tr>' +
        '<td><span class="dash-vav">' + App.esc(v.initialen) + '</span></td>' +
        '<td style="min-width:80px"><div class="dash-bt" style="height:8px;overflow:hidden"><div class="dash-bf fill-groen" style="width:' + pct + '%"></div></div></td>' +
        '<td>' + v.acties + ' x</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  },

  _dashSignalen: function(d) {
    var teller = {};
    d.colAlle.forEach(function(r) {
      if (r.signalen) {
        (r.signaalTypes || []).forEach(function(s) {
          if (!s) return;
          if (!teller[s]) teller[s] = 0;
          teller[s]++;
        });
      }
    });
    var sorted = [];
    for (var k in teller) {
      if (teller.hasOwnProperty(k)) sorted.push({ label: k, value: teller[k] });
    }
    sorted.sort(function(a, b) { return b.value - a.value; });
    App._renderBars('dash-signalen', sorted, 'fill-rood', false);
  },

  _dashInstroom: function(d) {
    var acties = {};
    d.col.forEach(function(r) {
      var naam = r.naamVanDeActie;
      if (!acties[naam]) acties[naam] = { bewoners: 0, nieuw: 0 };
      acties[naam].bewoners += (r.aantalBewoners || 0);
      acties[naam].nieuw    += (r.waarvanNieuweBewoners || 0);
    });
    var sorted = [];
    for (var k in acties) {
      if (acties.hasOwnProperty(k)) {
        var pct = acties[k].bewoners ? Math.round((acties[k].nieuw / acties[k].bewoners) * 100) : 0;
        sorted.push({ label: k, value: pct, suffix: '%' });
      }
    }
    sorted.sort(function(a, b) { return b.value - a.value; });
    App._renderBars('dash-instroom', sorted, 'fill-oranje', false);
  },

  _dashFinancieel: function(d) {
    var el = document.getElementById('dash-fin');
    if (!el) return;
    var totUg = 0, totIk = 0;
    var perProject = {};
    d.colAlle.forEach(function(r) {
      if (r.module === 'Logistiek' || r.module === 'Activiteit') {
        var naam = r.naamVanDeActie;
        if (!perProject[naam]) perProject[naam] = { ug: 0, ik: 0 };
        (r.uitgaven || []).forEach(function(u) {
          var b = u.bedrag || 0;
          totUg += b;
          perProject[naam].ug += b;
        });
        if (r.module === 'Activiteit') {
          (r.inkomsten || []).forEach(function(ik) {
            var b = ik.bedrag || 0;
            totIk += b;
            perProject[naam].ik += b;
          });
        }
      }
    });
    var netto = totIk - totUg;
    var netKleur = netto >= 0 ? 'var(--groen)' : 'var(--rood)';
    var html = '<div class="dash-fin-totalen">' +
      '<div class="dash-fin-vak"><span class="dash-fin-getal" style="color:var(--rood)">' + geldbedrag(totUg) + '</span><span class="dash-fin-lbl">Uitgaven</span></div>' +
      '<div class="dash-fin-vak"><span class="dash-fin-getal" style="color:var(--groen)">' + geldbedrag(totIk) + '</span><span class="dash-fin-lbl">Inkomsten</span></div>' +
      '<div class="dash-fin-vak"><span class="dash-fin-getal" style="color:' + netKleur + '">' + geldbedrag(netto) + '</span><span class="dash-fin-lbl">Netto</span></div>' +
      '</div>';
    var projecten = [];
    for (var k in perProject) {
      if (perProject.hasOwnProperty(k) && (perProject[k].ug > 0 || perProject[k].ik > 0)) {
        projecten.push({ naam: k, ug: perProject[k].ug, ik: perProject[k].ik, net: perProject[k].ik - perProject[k].ug });
      }
    }
    if (projecten.length) {
      html += '<div class="dash-divider"></div>';
      html += '<table class="dash-vt"><thead><tr><th>Project</th><th>Uitgaven</th><th>Inkomsten</th><th>Netto</th></tr></thead><tbody>';
      projecten.forEach(function(p) {
        var kleur = p.net >= 0 ? 'var(--groen)' : 'var(--rood)';
        html += '<tr>' +
          '<td style="font-size:0.7rem">' + App.esc(p.naam) + '</td>' +
          '<td style="color:var(--rood)">' + geldbedrag(p.ug) + '</td>' +
          '<td style="color:var(--groen)">' + geldbedrag(p.ik) + '</td>' +
          '<td style="color:' + kleur + ';font-weight:700">' + geldbedrag(p.net) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<div class="dash-leeg">Nog geen financiële data.</div>';
    }
    el.innerHTML = html;
  },

  _dashLocaties: function(d) {
    var volgorde = ['Buurthuis','Parking Karting','Gentsesteenweg','Vaart','Loodwitstraat','Stasegemsesteenweg','Juweliersplein','Zandbergstraat','Andere locatie'];
    var teller = {};
    // Gebruik Activiteit-modules voor locatiedata
    d.colAlle.filter(function(r) { return r.module === 'Activiteit'; }).forEach(function(r) {
      var loc = (r.locatie || '').trim();
      var label = volgorde.indexOf(loc) !== -1 ? loc : 'Andere locatie';
      if (!teller[label]) teller[label] = 0;
      teller[label]++;
    });
    var sorted = volgorde.filter(function(l) { return teller[l]; }).map(function(l) { return { label: l, value: teller[l] }; });
    App._renderBars('dash-partners', sorted, 'fill-blauw', false);
  },

  _dashBuurtType: function(d) {
    var el = document.getElementById('dash-buurttype');
    if (!el) return;
    var actMods = d.colAlle.filter(function(r) { return r.module === 'Activiteit'; });
    var teller = { 'Buurtactiviteit': 0, 'Buurtwerk': 0 };
    actMods.forEach(function(r) { if (r.type && teller.hasOwnProperty(r.type)) teller[r.type]++; });
    var totaal = teller['Buurtactiviteit'] + teller['Buurtwerk'];
    if (!totaal) { el.innerHTML = '<div class="dash-leeg">Nog geen data.</div>'; return; }
    var pctAct = Math.round((teller['Buurtactiviteit'] / totaal) * 100);
    var pctBw  = 100 - pctAct;
    el.innerHTML =
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">' +
        '<div style="flex:1"><div style="font-size:0.75rem;font-weight:700;color:var(--groen);margin-bottom:3px">Buurtactiviteit</div>' +
          '<div style="background:var(--groen);height:18px;border-radius:4px;width:' + pctAct + '%;min-width:2px"></div>' +
          '<div style="font-size:0.8rem;margin-top:2px">' + teller['Buurtactiviteit'] + ' (' + pctAct + '%)</div></div>' +
        '<div style="flex:1"><div style="font-size:0.75rem;font-weight:700;color:var(--blauw);margin-bottom:3px">Buurtwerk</div>' +
          '<div style="background:var(--blauw);height:18px;border-radius:4px;width:' + pctBw + '%;min-width:2px"></div>' +
          '<div style="font-size:0.8rem;margin-top:2px">' + teller['Buurtwerk'] + ' (' + pctBw + '%)</div></div>' +
      '</div>' +
      '<div style="font-size:0.75rem;color:var(--zacht)">Totaal ' + totaal + ' activiteiten geregistreerd</div>';
  },

  wisFoto: function(id, uitIdx) {
    if (!confirm('Foto definitief wissen?')) return;
    var lijst = DB.collectief.slice();
    var rec = lijst.find(function(r) { return r.id === id; });
    if (!rec) { App.toast('Record niet gevonden.'); return; }
    if (uitIdx !== null && uitIdx !== undefined) {
      if (rec.uitgaven && rec.uitgaven[uitIdx]) rec.uitgaven[uitIdx].bonUrl = null;
    } else {
      rec.fotoUrl = null;
    }
    DB.slaColOp(lijst);
    App.toast('Foto gewist.', true);
    App.renderFotoOverzicht();
    App._dashMedia();
  },

  renderFotoOverzicht: function() {
    var el = document.getElementById('rap-foto-overzicht');
    if (!el) return;
    var items = [];
    DB.collectief.forEach(function(r) {
      if (r.fotoUrl) {
        items.push({ id: r.id, url: r.fotoUrl, type: 'Sfeerfoto', project: r.naamVanDeActie || '', module: r.module || 'Actie', datum: (r.datum || '').substr(0,10), uitIdx: null });
      }
      (r.uitgaven || []).forEach(function(u, i) {
        if (u.bonUrl) {
          items.push({ id: r.id, url: u.bonUrl, type: 'Bewijs', project: r.naamVanDeActie || '', module: (u.beschrijving || 'Bewijs') + ' — ' + geldbedrag(u.bedrag), datum: (r.datum || '').substr(0,10), uitIdx: i });
        }
      });
    });
    if (!items.length) {
      el.innerHTML = '<div style="color:var(--zacht);font-size:0.9rem">Nog geen foto\'s opgeslagen.</div>';
      return;
    }
    var html = '<div style="font-size:0.82rem;color:var(--zacht);margin-bottom:10px">' + items.length + ' foto\'s gevonden</div>';
    items.forEach(function(f) {
      var badgeCss = f.type === 'Sfeerfoto'
        ? 'background:var(--groen-licht);color:var(--groen)'
        : 'background:var(--oranje-licht);color:var(--oranje)';
      var uitArg = f.uitIdx !== null ? f.uitIdx : 'null';
      html += '<div style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg);border-radius:10px;margin-bottom:8px;border:1px solid var(--rand)">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:700;font-size:0.88rem;word-break:break-word">' + App.esc(f.project) + '</div>' +
          '<div style="font-size:0.75rem;color:var(--zacht);margin:2px 0">' + App.esc(f.module) + (f.datum ? ' — ' + f.datum : '') + '</div>' +
          '<span style="font-size:0.68rem;font-weight:700;padding:2px 8px;border-radius:10px;' + badgeCss + '">' + f.type + '</span>' +
        '</div>' +
        '<div style="display:flex;gap:4px;flex-shrink:0">' +
          '<button onclick="App.openLightbox(\'' + App.esc(f.url) + '\')" style="background:var(--blauw);color:#fff;border:none;border-radius:6px;padding:5px 8px;cursor:pointer;font-size:0.8rem">👁️</button>' +
          '<button onclick="App.wisFoto(\'' + App.esc(f.id) + '\',' + uitArg + ')" style="background:var(--rood);color:#fff;border:none;border-radius:6px;padding:5px 8px;cursor:pointer;font-size:0.8rem">🗑️</button>' +
          '<button onclick="App.archiveerRecord(\'' + App.esc(f.id) + '\',\'collectief\')" style="background:var(--oranje);color:#fff;border:none;border-radius:6px;padding:5px 8px;cursor:pointer;font-size:0.8rem">📁</button>' +
        '</div>' +
      '</div>';
    });
    el.innerHTML = html;
  },

  exportFotoUrls: function() {
    if (typeof XLSX === 'undefined') { App.toast('XLSX niet beschikbaar.'); return; }
    var rijen = [['Type', 'Project/Actie', 'Datum', 'Omschrijving', 'URL']];
    DB.collectief.forEach(function(r) {
      if (r.fotoUrl) {
        rijen.push([r.module || 'Collectieve actie', r.naamVanDeActie || '', (r.datum || '').substr(0,10), (r.module || 'Actie') + ' foto', r.fotoUrl]);
      }
      (r.uitgaven || []).forEach(function(u) {
        if (u.bonUrl) {
          rijen.push(['Uitgave bewijs', r.naamVanDeActie || '', (r.datum || '').substr(0,10), (u.beschrijving || '') + ' \u2014 ' + geldbedrag(u.bedrag), u.bonUrl]);
        }
      });
    });
    if (rijen.length === 1) { App.toast('Geen foto\'s gevonden in de database.'); return; }
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(rijen);
    ws['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 40 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Foto URLs');
    XLSX.writeFile(wb, 'foto_urls_' + new Date().toISOString().substr(0,10) + '.xlsx');
    App.toast((rijen.length - 1) + ' foto-URL\'s geëxporteerd.', true);
  },

  _downloadUrl: function(url, naam) {
    return fetch(url).then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.blob();
    }).then(function(blob) {
      var blobUrl = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = blobUrl; a.download = naam;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 3000);
    }).catch(function() {
      // Fallback: open in nieuw tabblad
      window.open(url, '_blank');
    });
  },

  downloadFotoArchief: function() {
    var items = [];
    DB.collectief.forEach(function(r) {
      if (r.fotoUrl) {
        var project = (r.naamVanDeActie || 'Project').replace(/[/\\?%*:|"<>]/g, '-');
        var module  = (r.module || 'Actie').replace(/[/\\?%*:|"<>]/g, '-');
        items.push({ url: r.fotoUrl, naam: project + ' - ' + module + '.jpg' });
      }
    });
    if (!items.length) { App.toast('Geen sfeerfoto\'s gevonden.'); return; }
    App.toast('Foto\'s worden gedownload (' + items.length + ')…');
    var idx = 0;
    function volgende() {
      if (idx >= items.length) { App.toast('Download klaar.', true); return; }
      var item = items[idx++];
      App._downloadUrl(item.url, item.naam).then(function() {
        setTimeout(volgende, 600);
      });
    }
    volgende();
  },

  downloadBewijsjes: function() {
    var items = [];
    DB.collectief.forEach(function(r) {
      var project = (r.naamVanDeActie || 'Project').replace(/[/\\?%*:|"<>]/g, '-');
      (r.uitgaven || []).forEach(function(u, i) {
        if (u.bonUrl) {
          var omschr = (u.beschrijving || u.leverancier || 'Bewijs').replace(/[/\\?%*:|"<>]/g, '-');
          items.push({ url: u.bonUrl, naam: project + ' - ' + omschr + ' - ' + (i + 1) + '.jpg' });
        }
      });
    });
    if (!items.length) { App.toast('Geen bewijsjes gevonden.'); return; }
    App.toast('Bewijsjes worden gedownload (' + items.length + ')…');
    var idx = 0;
    function volgende() {
      if (idx >= items.length) { App.toast('Download klaar.', true); return; }
      var item = items[idx++];
      App._downloadUrl(item.url, item.naam).then(function() {
        setTimeout(volgende, 600);
      });
    }
    volgende();
  },

  _dashMedia: function() {
    var el = document.getElementById('dash-media');
    if (!el) return;
    // Enkel sfeerfoto's tonen (geen bewijsjes/bonnen)
    var fotos = [];
    DB.collectief.forEach(function(r) {
      if (r.fotoUrl) fotos.push({ type: r.module || 'Actie', naam: r.naamVanDeActie || '', url: r.fotoUrl, label: (r.datum || '').substr(0,10) });
    });
    if (!fotos.length) {
      el.innerHTML = '<div style="color:var(--zacht);font-size:0.9rem">Nog geen sfeerfoto\'s geüpload.</div>';
      return;
    }
    var html = '<div style="font-size:0.85rem;color:var(--zacht);margin-bottom:10px">' + fotos.length + ' sfeerfoto\'s gevonden</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px">';
    fotos.forEach(function(f) {
      html += '<div style="background:var(--bg);border-radius:8px;padding:10px;min-width:110px;max-width:150px;border:1px solid #e5e7eb;display:flex;flex-direction:column;gap:4px">' +
        '<div onclick="App.openLightbox(\'' + App.esc(f.url) + '\')" style="cursor:pointer">' +
          '<div style="font-size:0.68rem;font-weight:700;color:var(--groen);text-transform:uppercase">' + App.esc(f.type) + '</div>' +
          '<div style="font-size:0.72rem;font-weight:600;margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + App.esc(f.naam) + '">' + App.esc(f.naam) + '</div>' +
          '<div style="font-size:0.68rem;color:var(--zacht);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + App.esc(f.label) + '</div>' +
          '<div style="font-size:1.4rem;text-align:center;margin-top:4px">🖼️</div>' +
        '</div>' +
        '<button onclick="App.wisFoto(\'' + App.esc(f.id) + '\',null)" style="background:var(--rood);color:#fff;border:none;border-radius:5px;padding:3px;cursor:pointer;font-size:0.7rem;width:100%">🗑️ Wis</button>' +
        '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  },

  renderDashboard: function() {
    var tsEl = document.getElementById('dash-ts');
    if (tsEl) tsEl.textContent = 'Bijgewerkt: ' + new Date().toLocaleString('nl-BE');
    App._dashVulJaarFilter();
    App._dashVulMaandFilter();
    App._dashIndVulFilters();
    App._dashIndRender();
    var d = App._dashData();
    App._dashKPI(d);
    App._dashTop20(d);
    App._dashTop20Acties(d);
    App._dashLevensdomeinen(d);
    App._dashVindplaatsen(d);
    App._dashToeleiding(d);
    App._dashMethodiekInd(d);
    App._dashClusterBereik(d);
    App._dashClusterRendement(d);
    App._dashThema(d);
    App._dashSignalen(d);
    App._dashInstroom(d);
    App._dashFinancieel(d);
    App._dashLocaties(d);
    App._dashBuurtType(d);
    App._dashMedia();
  },

  exportDashboardPDF: function() {
    var jsPDFLib = (window.jspdf && window.jspdf.jsPDF) || (typeof jsPDF !== 'undefined' ? jsPDF : null);
    if (!jsPDFLib) { App.toast('jsPDF niet beschikbaar.'); return; }
    var d = App._dashData();
    var doc = new jsPDFLib({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    var y = 40;
    var mL = 40;
    var breedte = 515;

    doc.setFillColor(45, 106, 79);
    doc.rect(0, 0, 595, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Buurtwerk Venning \u2014 Beleidsdashboard', mL, 30);
    doc.setFontSize(9);
    var jaarEl  = document.getElementById('dash-jaar-filter');
    var maandEl2 = document.getElementById('dash-maand-filter');
    var jaarLabel  = jaarEl  && jaarEl.value  ? 'Jaar: '  + jaarEl.value  : 'Alle jaren';
    var maandLabel = maandEl2 && maandEl2.value ? ' | Maand: ' + maandEl2.value : '';
    doc.text('Gegenereerd: ' + new Date().toLocaleString('nl-BE') + ' | ' + jaarLabel + maandLabel, mL, 44);
    doc.setTextColor(0, 0, 0);
    y = 70;

    function checkY(nodig) { if (y + (nodig || 20) > 770) { doc.addPage(); y = 40; } }

    function sectie(titel) {
      checkY(30);
      doc.setFillColor(45, 106, 79);
      doc.rect(mL, y - 2, breedte, 14, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(titel, mL + 6, y + 8);
      doc.setTextColor(0, 0, 0);
      y += 20;
    }

    function regel(label, waarde) {
      checkY(14);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text(label + ':', mL, y);
      doc.setFont('helvetica', 'normal');
      var regels = doc.splitTextToSize(String(waarde !== undefined && waarde !== null ? waarde : '\u2014'), breedte - 110);
      doc.text(regels, mL + 110, y);
      y += Math.max(12, regels.length * 10);
    }

    // Kerncijfers
    sectie('KERNCIJFERS');
    var totUren = 0;
    d.ind.forEach(function(r) { totUren += App._tijdNaarUren(r.tijd); });
    var totBereik = 0;
    d.col.forEach(function(r) { totBereik += (r.aantalBewoners || 0); });
    var totNieuw = 0;
    d.col.forEach(function(r) { totNieuw += (r.waarvanNieuweBewoners || 0); });
    var vrijwNamen = {};
    d.col.forEach(function(r) { (r.naamVrijwilligers || []).forEach(function(n) { if (n) vrijwNamen[n] = true; }); });
    regel('Actieve personen', d.per.length);
    regel('Individuele acties', d.ind.length);
    regel('Totale uren (ind.)', (Math.round(totUren * 10) / 10) + ' uur');
    regel('Collectieve acties', d.col.length);
    regel('Totaal bereik (col.)', totBereik + ' bewoners');
    regel('Waarvan nieuw', totNieuw + ' bewoners');
    regel('Unieke vrijwilligers', Object.keys(vrijwNamen).length);
    y += 6;

    // Top 20
    sectie('TOP 20 PERSONEN (UREN INDIVIDUEEL)');
    var perUren = {};
    d.ind.forEach(function(r) {
      if (!perUren[r.persoonNummer]) perUren[r.persoonNummer] = 0;
      perUren[r.persoonNummer] += App._tijdNaarUren(r.tijd);
    });
    var top20 = [];
    for (var nr in perUren) {
      if (perUren.hasOwnProperty(nr)) top20.push({ nr: parseInt(nr), uren: perUren[nr] });
    }
    top20.sort(function(a, b) { return b.uren - a.uren; });
    top20.slice(0, 20).forEach(function(it, i) {
      var p = d.per.find(function(x) { return x.volgnummer === it.nr; });
      var naam = p ? (p.voornaam + ' ' + p.familienaam) : 'Persoon #' + it.nr;
      regel((i + 1) + '. ' + naam, (Math.round(it.uren * 10) / 10) + ' uur');
    });
    y += 6;

    // Top 20 meeste acties
    sectie('TOP 20 PERSONEN (MEESTE ACTIES)');
    var perActies = {};
    d.ind.forEach(function(r) {
      if (!perActies[r.persoonNummer]) perActies[r.persoonNummer] = 0;
      perActies[r.persoonNummer]++;
    });
    var top20Acties = [];
    for (var nr2 in perActies) {
      if (perActies.hasOwnProperty(nr2)) top20Acties.push({ nr: parseInt(nr2), acties: perActies[nr2] });
    }
    top20Acties.sort(function(a, b) { return b.acties - a.acties; });
    top20Acties.slice(0, 20).forEach(function(it, i) {
      var p = d.per.find(function(x) { return x.volgnummer === it.nr; });
      var naam = p ? (p.voornaam + ' ' + p.familienaam) : 'Persoon #' + it.nr;
      regel((i + 1) + '. ' + naam, it.acties + ' acties');
    });
    y += 6;

    // Vindplaatsen
    sectie('VINDPLAATSEN');
    var vpTeller = App._telVeld(d.ind, 'vindplaats');
    var vpSorted = App._sortTeller(vpTeller, 'count');
    vpSorted.forEach(function(it) {
      regel(it.label, it.data.count + ' contacten, ' + (Math.round(it.data.uren * 10) / 10) + ' uur');
    });
    if (!vpSorted.length) regel('Geen data', '');
    y += 6;

    // Levensdomeinen
    sectie('LEVENSDOMEINEN');
    var ldTeller = App._telVeld(d.ind, 'levensdomein');
    var ldSorted = App._sortTeller(ldTeller, 'count');
    ldSorted.forEach(function(it) {
      regel(it.label, it.data.count + ' contacten, ' + (Math.round(it.data.uren * 10) / 10) + ' uur');
    });
    if (!ldSorted.length) regel('Geen data', '');
    y += 6;

    // Toeleiding
    sectie('TOELEIDING');
    var toelTeller = App._telVeld(d.ind, 'toeleiding');
    var toelSorted = App._sortTeller(toelTeller, 'count');
    toelSorted.forEach(function(it) { regel(it.label, it.data.count + ' keer'); });
    if (!toelSorted.length) regel('Geen data', '');
    y += 6;

    // Cluster bereik
    sectie('COLLECTIEF \u2014 BEREIK PER CLUSTER');
    var clTeller = {};
    d.col.forEach(function(r) {
      (r.cluster || []).forEach(function(c) {
        if (!c) return;
        if (!clTeller[c]) clTeller[c] = 0;
        clTeller[c] += (r.aantalBewoners || 0);
      });
    });
    var clLijst = [];
    for (var ck in clTeller) { if (clTeller.hasOwnProperty(ck)) clLijst.push([ck, clTeller[ck]]); }
    clLijst.sort(function(a, b) { return b[1] - a[1]; });
    clLijst.forEach(function(it) { regel(it[0], it[1] + ' bewoners'); });
    if (!clLijst.length) regel('Geen data', '');
    y += 6;

    // Thema
    sectie('THEMA RANKING');
    var thTeller = {};
    d.col.forEach(function(r) {
      (r.thema || []).forEach(function(t) {
        if (!t) return;
        if (!thTeller[t]) thTeller[t] = 0;
        thTeller[t] += (r.aantalBewoners || 0);
      });
    });
    var thLijst = [];
    for (var tk in thTeller) { if (thTeller.hasOwnProperty(tk)) thLijst.push([tk, thTeller[tk]]); }
    thLijst.sort(function(a, b) { return b[1] - a[1]; });
    thLijst.forEach(function(it) { regel(it[0], it[1] + ' bewoners bereik'); });
    if (!thLijst.length) regel('Geen data', '');
    y += 6;

    // Signalen
    sectie('SIGNALEN MONITOR');
    var sigTeller = {};
    d.colAlle.forEach(function(r) {
      if (r.signalen) {
        (r.signaalTypes || []).forEach(function(s) {
          if (!s) return;
          if (!sigTeller[s]) sigTeller[s] = 0;
          sigTeller[s]++;
        });
      }
    });
    var sigLijst = [];
    for (var sk in sigTeller) { if (sigTeller.hasOwnProperty(sk)) sigLijst.push([sk, sigTeller[sk]]); }
    sigLijst.sort(function(a, b) { return b[1] - a[1]; });
    sigLijst.forEach(function(it) { regel(it[0], it[1] + ' keer'); });
    if (!sigLijst.length) regel('Geen data', '');
    y += 6;

    // Financieel
    sectie('FINANCIEEL OVERZICHT');
    var totUg2 = 0, totIk2 = 0;
    var finProj = {};
    d.colAlle.forEach(function(r) {
      if (r.module === 'Logistiek' || r.module === 'Activiteit') {
        var pnm = r.naamVanDeActie;
        if (!finProj[pnm]) finProj[pnm] = { ug: 0, ik: 0 };
        (r.uitgaven || []).forEach(function(u) { totUg2 += (u.bedrag || 0); finProj[pnm].ug += (u.bedrag || 0); });
        if (r.module === 'Activiteit') {
          (r.inkomsten || []).forEach(function(ik) { totIk2 += (ik.bedrag || 0); finProj[pnm].ik += (ik.bedrag || 0); });
        }
      }
    });
    regel('Totale uitgaven', geldbedrag(totUg2));
    regel('Totale inkomsten', geldbedrag(totIk2));
    regel('Netto resultaat', geldbedrag(totIk2 - totUg2));
    y += 4;
    for (var fpk in finProj) {
      if (finProj.hasOwnProperty(fpk) && (finProj[fpk].ug > 0 || finProj[fpk].ik > 0)) {
        regel(fpk, 'UG: ' + geldbedrag(finProj[fpk].ug) + ' / IK: ' + geldbedrag(finProj[fpk].ik) + ' / NET: ' + geldbedrag(finProj[fpk].ik - finProj[fpk].ug));
      }
    }

    doc.save('beleidsdashboard_' + new Date().getFullYear() + '.pdf');
    App.toast('Dashboard PDF gedownload.', true);
  },

  /* ══════════════════════════════════════
     HERLAAD HUIDIGE PAGINA NA DATA-UPDATE
  ══════════════════════════════════════ */
  _herlaadHuidigePagina: function() {
    var p = State.huidigePagina;
    if (p === 'pg-start')              App.renderStart();
    else if (p === 'pg-individueel-start') App.renderIndStart();
    else if (p === 'pg-collectief-start')  App.renderColStart();
    else if (p === 'pg-collectief-module') App.vulActieKeuze();
    else if (p === 'pg-rapport-personen')  App.renderPersonenRap();
    else if (p === 'pg-rapport-individueel') App.renderIndRap();
    else if (p === 'pg-rapport-collectief')  App.renderColRap();
    else if (p === 'pg-archief')           App.renderArchief();
    else if (p === 'pg-jaarplan-mod')      App.renderJaarplan();
    else if (p === 'pg-dashboard')         App.renderDashboard();
  },

  /* ══════════════════════════════════════
     INIT
  ══════════════════════════════════════ */
  /* ── Hulpfuncties voor automatische hoofdletters ── */
  _cap: function(s) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  },

  _capWords: function(s) {
    if (!s) return s;
    return s.replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  },

  _initAutoCapitalize: function() {
    // Voornaam/familienaam: elke beginletter van elk woord
    ['per-voornaam','per-familienaam','pd-voornaam','pd-familienaam'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('blur', function() {
        if (this.value) this.value = App._capWords(this.value);
      });
    });
    // Overige tekstvelden: eerste letter van de volledige invoer
    ['per-adres','per-gemeente','per-notitie',
     'pd-adres','pd-gemeente',
     'ca-naam','ca-partner','ca-buurt','act-locatie-vrij',
     'ia-extra','log-notitie','ov-notitie'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('blur', function() {
        if (this.value) this.value = App._cap(this.value);
      });
    });
    // Dynamisch aangemaakte vrijwilliger-naamvelden via event-delegatie
    document.addEventListener('blur', function(e) {
      var el = e.target;
      if (el && el.tagName === 'INPUT' && el.type === 'text' && el.id && /^ca-vw-\d+$/.test(el.id)) {
        if (el.value) el.value = App._capWords(el.value);
      }
    }, true);
  },

  init: function() {
    // Zet vandaag als standaard datum in datum-velden
    var vandaag = new Date().toISOString().substr(0, 10);
    ['log-datum','ov-datum'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = vandaag;
    });

    App._initAutoCapitalize();

    // Duplikaat-check: waarschuwingsdiv aanmaken onder familienaam-veld
    var vnEl = document.getElementById('per-voornaam');
    var fnEl = document.getElementById('per-familienaam');
    if (vnEl && fnEl) {
      var msg = document.createElement('div');
      msg.id = 'per-dubbel-msg';
      msg.style.cssText = 'display:none;margin-top:8px;padding:9px 12px;' +
        'background:#fde8e8;border:1.5px solid var(--rood);border-radius:8px;' +
        'color:var(--rood);font-size:0.82rem;font-weight:700;line-height:1.4';
      var fnVraag = fnEl.closest('.vraag');
      if (fnVraag) fnVraag.appendChild(msg);
      // blur → controleer dubbel
      vnEl.addEventListener('blur',  function() { App._checkDubbeleNaam(); });
      fnEl.addEventListener('blur',  function() { App._checkDubbeleNaam(); });
      // input → wis verouderde waarschuwing terwijl gebruiker typt
      vnEl.addEventListener('input', function() { App._clearDubbeleNaam(); });
      fnEl.addEventListener('input', function() { App._clearDubbeleNaam(); });
    }

  }
};

/* ══════════════════════════════════════════
   AUTH
══════════════════════════════════════════ */
var Auth = {
  inloggen: function() {
    var email = (document.getElementById('login-email') || {}).value.trim();
    var ww    = (document.getElementById('login-ww')    || {}).value;
    var foutEl = document.getElementById('login-fout');
    if (foutEl) foutEl.textContent = '';
    if (!email || !ww) {
      if (foutEl) foutEl.textContent = 'Vul e-mail en wachtwoord in.';
      return;
    }
    _auth.signInWithEmailAndPassword(email, ww).catch(function() {
      var f = document.getElementById('login-fout');
      if (f) f.textContent = 'Aanmelden mislukt. Controleer uw gegevens.';
    });
  },

  registreren: function() {
    var email  = (document.getElementById('login-email') || {}).value.trim();
    var ww     = (document.getElementById('login-ww')    || {}).value;
    var foutEl = document.getElementById('login-fout');
    if (foutEl) foutEl.textContent = '';
    if (!email || !ww) {
      if (foutEl) foutEl.textContent = 'Vul e-mail en wachtwoord in.';
      return;
    }
    if (ww.length < 6) {
      if (foutEl) foutEl.textContent = 'Wachtwoord moet minstens 6 tekens bevatten.';
      return;
    }
    _auth.createUserWithEmailAndPassword(email, ww).catch(function(err) {
      var f = document.getElementById('login-fout');
      if (!f) return;
      if (err.code === 'auth/email-already-in-use') {
        f.textContent = 'Dit e-mailadres is al in gebruik.';
      } else if (err.code === 'auth/invalid-email') {
        f.textContent = 'Ongeldig e-mailadres.';
      } else {
        f.textContent = 'Registratie mislukt. Probeer opnieuw.';
      }
    });
  },

  uitloggen: function() {
    DB.stopListeners();
    _auth.signOut();
  }
};

// Auth state listener
_auth.onAuthStateChanged(function(user) {
  if (user) {
    // Ingelogd — toon app
    document.getElementById('pg-login').classList.remove('actief');
    document.getElementById('bottom-nav').style.display = '';
    DB._uid = user.uid;
    DB.startListeners();
    App.nav('pg-start');
    // Wis loginformulier
    var e = document.getElementById('login-email');
    var w = document.getElementById('login-ww');
    if (e) e.value = '';
    if (w) w.value = '';
  } else {
    // Uitgelogd — toon loginpagina
    DB.stopListeners();
    document.querySelectorAll('.pagina').forEach(function(p) {
      p.classList.remove('actief');
    });
    document.getElementById('pg-login').classList.add('actief');
    document.getElementById('bottom-nav').style.display = 'none';
    var f = document.getElementById('login-fout');
    if (f) f.textContent = '';
  }
});

/* ── Start ── */
document.addEventListener('DOMContentLoaded', function() {
  App.init();
  if (window.lucide) window.lucide.createIcons();
});
