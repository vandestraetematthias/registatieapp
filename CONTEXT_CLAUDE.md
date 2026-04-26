# Buurtwerk Venning — Volledig contextdocument voor Claude
**Versie**: 2.9.7 | **Datum**: 2026-04-26
**GitHub**: `vandestraetematthias/registatieapp` (branch: `main`)
**Firebase project**: `buurtwerk-1b254`
**Lokaal pad**: `C:/Users/matth/registatieapp/`

---

## 1. WAT IS DEZE APP?

Een Progressive Web App (PWA) voor **Buurtwerk Venning** — een buurtwerking in Leuven. Medewerkers registreren contacten met buurtbewoners en collectieve activiteiten. De app heeft geen backend-server: alle logica zit in `app.js` (vanilla JS), data in Firebase Firestore.

**Doel**: registratie → opvolging → rapportage/dashboard voor analyse.

---

## 2. TECHNISCHE STACK

| Onderdeel | Detail |
|---|---|
| Frontend | Vanilla HTML/CSS/JS (geen framework) |
| Auth | Firebase Auth (email+password) |
| Database | Firebase Firestore (compat SDK v9.22.2) realtime |
| Storage | Firebase Storage (foto's/bonnen) |
| PWA | Service Worker (`service-worker.js`, cache `buurtwerk-v2.9.7`) |
| Fonts | Poppins (Google Fonts) |
| Icons | Lucide (CDN) |
| PDF export | jsPDF + html2canvas |
| Excel export | SheetJS (XLSX) |
| Bestanden | `index.html`, `app.js`, `style.css`, `service-worker.js`, `manifest.json`, `icon.svg` |

---

## 3. FIRESTORE DATAMODEL

Alle data zit onder `users/{uid}/` — elke gebruiker heeft zijn eigen geïsoleerde data.

### 3.1 Collectie `personen`

Eén document per persoon.

| Veld | Type | Waarden / Opmerking |
|---|---|---|
| `id` | string | UUID |
| `volgnummer` | number | Oplopend, uniek — sleutel voor koppelingen |
| `voornaam` | string | |
| `familienaam` | string | |
| `adres` | string | |
| `postcode` | string | |
| `gemeente` | string | |
| `leeftijd` | string | `-18` / `18-25` / `26-40` / `41-60` / `61-80` / `80+` |
| `inkomen` | array | `Niet gekend` / `Leefloon` / `Geen inkomen` / `Invaliditeit` / `Werkloosheid` / `Pensioen` / `Arbeid` / `Budgetbegeleiding` |
| `huisvesting` | array | `Dak/Thuisloos` / `Woont bij ouders` / `Huurt woning` / `Huurt sociale woning` / `Heeft woning` / `Begeleid wonen` / `Housing First` / `Kracht.Wonen` / `RCK` / `Niet gekend` |
| `woonsituatie` | string | `Alleenstaand` / `Alleenstaand met kinderen` / `Samen` / `Gezin` |
| `eersteContact` | string | `Vindplaatsgericht` / `Via netwerk gast` / `Via collega's` / `Zelfaanmelding` / `Via externe organisatie` / `Geen idee meer` |
| `type` | array | Vrije categorieën |
| `gekendBij` | array | `MW` / `SHW` / `Woonzorg` / `Brugfiguur` |
| `notitie` | string | Vrije tekst |
| `aangemaakt` | string | ISO timestamp |
| `gewijzigd` | string | ISO timestamp (optioneel) |
| `status` | string | `actief` / `gearchiveerd` |

### 3.2 Collectie `individueel`

Eén document per individuele actie (contact met een persoon).

| Veld | Type | Waarden / Opmerking |
|---|---|---|
| `id` | string | UUID |
| `persoonNummer` | number | Koppeling naar `personen.volgnummer` |
| `maand` | string | `Januari` … `December` |
| `jaar` | number | Jaartal |
| `levensdomein` | array | Multi-select levensdomeinen |
| `vindplaats` | array | Waar het contact plaatsvond (multi-select) |
| `methodiek` | array | Gebruikte werkwijzen (multi-select) |
| `extraInfo` | string | Vrije tekst |
| `toeleiding` | array | Doorverwijzingen (multi-select) |
| `tijd` | string | `5 min` / `15 min` / `30 min` / `1 uur` / `1u30` / `2 uur` / `3 uur` / `4 uur` |
| `datum` | string | ISO timestamp (aanmaakmoment) |
| `status` | string | `actief` / `gearchiveerd` |

**`_tijdNaarUren()` conversie**: 5 min=0.083, 15 min=0.25, 30 min=0.5, 1 uur=1, 1u30=1.5, 2 uur=2, 3 uur=3, 4 uur=4

### 3.3 Collectie `collectief`

Bevat twee soorten records in dezelfde collectie, onderscheiden via het veld `module`.

**Hoofdactie** (`module: null`):

| Veld | Type | Opmerking |
|---|---|---|
| `id` | string | UUID |
| `module` | null | Geeft aan dat dit een hoofdactie is |
| `naamVanDeActie` | string | Naam van de collectieve actie |
| `maand` | string | `Januari` … `December` |
| `jaar` | number | |
| `cluster` | array | Cluster-categorieën |
| `thema` | array | Thema's |
| `buurt` | string | Standaard: `centrum 2: venning` |
| `aantalBewoners` | number | Aantal deelnemende bewoners |
| `waarvanNieuweBewoners` | number | Waarvan nieuwe bewoners |
| `aantalVrijwilligers` | number | |
| `totaal` | number | bewoners + vrijwilligers |
| `naamVrijwilligers` | array | Naam van vrijwilligers |
| `naamPartner` | string | Partnernaam |
| `datum` | string | ISO timestamp |
| `status` | string | `actief` / `gearchiveerd` |

**Module-records** (`module: 'Logistiek'` / `'Overleg'` / `'Activiteit'`):

Gemeenschappelijk: `id`, `module`, `naamVanDeActie` (koppeling naar hoofdactie), `signalen` (bool), `signaalTypes` (array), `notitie`, `fotoUrl`, `aangemaakt`, `status`.

Extra velden per type:
- **Logistiek**: `datum`, `uitlegType` (array), `uitgaven` (array: `[{bedrag, beschrijving, bewijs:{url,id}}]`)
- **Overleg**: `datum`
- **Activiteit**: `locatie`, `type`, `uitgaven`, `inkomsten`, `participatie` (array), `doel` (array), `impact` (array — conditioneel)

### 3.4 Collectie `fietsritten`

Eén document per fietsrit (vergoeding). Pad: `users/{uid}/fietsritten`.

| Veld | Type | Waarden / Opmerking |
|---|---|---|
| `id` | string | UUID |
| `datum` | string | ISO timestamp (aanmaakmoment) |
| `datumRit` | string | `DD/MM/YYYY` (display) |
| `van` | string | Vertrekadres |
| `naar` | string | Bestemmingsadres |
| `via` | string | Optioneel tussenadres |
| `afstand` | number | Kilometers (OSRM of GPS of manueel) |
| `tarief` | number | Standaard `0.2287` (€/km) |
| `totaal` | number | `afstand × tarief` |
| `opmerking` | string | Rydoo-tekst, bv. "Individueel — V.F." |
| `type` | string | `'gps'` / `'route'` / `'manueel'` |
| `categorie` | string | `'individueel'` / `'collectief'` |
| `actieRef` | string | Naam van de gekoppelde actie (vrij) |
| `jaar` | number | Jaar van de rit |
| `maand` | string | `Januari` … `December` |
| `status` | string | `'actief'` / `'gearchiveerd'` |

---

## 4. HTML PAGINASTRUCTUUR

Alle pagina's zijn `<div class="pagina" id="pg-*">`. Actieve pagina krijgt klasse `actief`. Navigatie via `App.nav(id)`.

| Page ID | Omschrijving |
|---|---|
| `pg-login` | Inlogpagina (Firebase Auth) |
| `pg-start` | Startpagina met 4 kaarten + recente acties |
| `pg-individueel-start` | Startpunt individueel (nieuwe persoon / actie) |
| `pg-persoon-wiz` | Wizard persoon aanmaken (3 stappen) |
| `pg-ind-actie-wiz` | Wizard individuele actie (3 stappen) |
| `pg-collectief-start` | Startpunt collectief |
| `pg-col-actie-wiz` | Wizard collectieve actie (3 stappen) |
| `pg-collectief-module` | Module selectiepagina (kies actie + module-type) |
| `pg-mod-logistiek` | Logistiek module invulformulier |
| `pg-mod-overleg` | Overleg module invulformulier |
| `pg-mod-activiteit` | Activiteit module invulformulier |
| `pg-jaarplan` | Jaarplan / exports overzicht |
| `pg-rapport-personen` | Personenlijst rapport |
| `pg-rapport-individueel` | Individuele acties rapport |
| `pg-rapport-collectief` | Collectieve acties rapport |
| `pg-archief` | Gearchiveerde records |
| `pg-succes` | Succesmelding na opslaan |
| `pg-jaarplan-mod` | Jaarplan module details |
| `pg-persoon-detail` | Persoon bewerken / detail |
| `pg-dashboard` | Dashboard (KPI + analyses) |
| `pg-fiets-logboek` | Fietslogboek overzicht (filters, tabel, print, Excel) |

**Bottom navigation** (`#bottom-nav`): knoppen met `data-page` naar pg-start, pg-individueel-start, pg-collectief-start, pg-jaarplan, pg-dashboard.

---

## 5. APP.JS STRUCTUUR

`app.js` is één groot bestand met drie objecten op globaal niveau.

### 5.1 Object `DB` — datalaag

**Realtime Firestore listeners** (via `onSnapshot`) op alle 3 collecties. Data gecached in `_personen`, `_individueel`, `_collectief`. Bij elke wijziging wordt `App._herlaadHuidigePagina()` aangeroepen.

Sleutelmethoden:
- `DB.startListeners()` — Start listeners na login
- `DB.stopListeners()` — Stop bij logout
- `DB.volgNummer()` — Geeft volgend persoonsnummer
- `DB.actieNamen()` — Unieke namen van actieve collectieve acties
- `DB.slaPerOp(lijst)` / `slaIndOp(lijst)` / `slaColOp(lijst)` — Schrijft gewijzigde records naar Firestore
- `DB.slaFietsOp(lijst)` — Schrijft fietsritten naar Firestore
- `DB.fietsritten` — getter voor gecachte `_fietsritten` array
- Fietsritten-listener start apart (telt NIET mee in `_laadGereed`), refresht `pg-fiets-logboek` bij wijziging

### 5.2 Object `Auth` — authenticatie

- `Auth.inloggen()` — Firebase signIn met email/password
- `Auth.registreren()` — Firebase createUser
- `Auth.uitloggen()` — Stops listeners + Firebase signOut
- `onAuthStateChanged` listener → toont app of loginpagina

### 5.3 Object `App` — applicatielogica

#### Navigatie
- `App.nav(pagina)` — Wisselt actieve pagina, scrollt naar top, triggert renders

#### UI helpers
- `App.toggle(el)` — Toggle klasse 'geselecteerd'
- `App.enkeleKeuze(el, groepId)` — Single-select in keuzegroep
- `App.getKeuzes(id)` — Geeft array van geselecteerde keuzes
- `App.getEnkele(id)` — Geeft eerste geselecteerde keuze
- `App.toast(msg, ok, permanent)` — Toast notificatie
- `App.succes(icon, titel, tekst, ...)` — Succespagina
- `App.esc(s)` — HTML-escape

#### Persoon wizard
- `App.resetPer()`, `App.perStap(n)`, `App.slaPerOp()`
- Bewerkingsmodus: `App.bekijkPersoon(id)` / `App.laadPerBewerk(id)`

#### Individuele actie wizard
- `App.resetIa()`, `App.iaStap(n)`, `App.slaIaOp()`
- `App.zoekPersoon()` — Zoekt op naam
- `App.kiesPersoon(volgnummer)` — Selecteert persoon
- `App.laadIaBewerk(id)` — Bewerkingsmodus

#### Collectieve actie wizard
- `App.resetCa()`, `App.caStap(n)`, `App.slaCaOp()`
- `App.renderCaNaamSuggesties()` — Naamsuggesties
- `App.laadCaBewerk(id)` — Bewerkingsmodus

#### Modules (Logistiek / Overleg / Activiteit)
- `App.vulActieKeuze()` — Dropdown met actienamen
- `App.startModule(type)` — Initialiseert module-formulier
- `App.slaLogOp()` / `App.slaOvOp()` / `App.slaActOp()` — Opslaan
- `App.renderKostLijst(containerId, lijst, prefix)` — Uitgavenlijst renderen
- `App._uploadModuleFoto(prefix, input)` — Foto uploaden (Firebase Storage, geresized)
- `App._uploadBon(prefix, idx, input)` — Bon/bewijs uploaden

#### Rapporten
- `App.renderPersonenRap()`, `App.renderIndRap()`, `App.renderColRap()`
- `App.exportCSV(type, van, tot)` — CSV export
- `App.exportBackup()` — Volledige backup CSV
- `App.exportBuurtwerkPDF()` — Jaarrapport PDF
- `App.importCSVDialog()` — CSV import

#### Fietsritten module (v2.9.5)

**GPS en afstandsbepaling** (geen API-sleutel vereist):
- `App.toggleGps(prefix)` / `startGps(prefix)` / `stopGps(prefix)` — Browser `navigator.geolocation.watchPosition()`, Haversine formula, km-badge update
- `App.berekenAfstand(prefix)` — Nominatim geocoding → OSRM routeberekening; bij Nominatim-fout: duidelijke foutmelding + km-veld blijft leeg; bij OSRM-fout: Haversine × 1.2 met ⚠️ waarschuwing-toast
- `App._nominatim(adres, cb)` — Nominatim API (`countrycodes=be`, vereiste `User-Agent` header)
- `App._haversine(lat1,lon1,lat2,lon2)` — Afstand in km

**GPS start in wizardstap 1** (v2.9.6+):
- `ia-s1` en `ca-s1` hebben elk een `<div class="fiets-gps-start">` met:
  - `{prefix}-gps-start-btn` — knop "🚲 Start fietsrit", wordt groen en toont "Rit klaar: X km" na stop
  - `{prefix}-gps-km-teller` — live km-display in de wizard (verborgen totdat GPS loopt)
- `startGps(prefix)` update ook de wizard-teller; `stopGps(prefix)` reset de widget

**GPS floating badge**: `#gps-badge` — zichtbaar tijdens live tracking, toont lopende km.

**Adressen en favorieten** (localStorage):
- `App._slaAdresOp(adres)` / `_getAdresSuggesties()` — cache in `bwv_adressen`
- `App._getFietsFavs()` — standaard: Buurthuis Venning + Stadhuis Leuven; opgeslagen in `bwv_fiets_favs`
- `App._fietsInput(prefix, veld)` / `_kiesSuggestie(prefix, veld, adres)` — live dropdown

**Fietsvergoeding sectie in wizards** (stap 3):
- Zowel `ia-s3` als `ca-s3` hebben `<div class="fiets-sectie">` met toggle-knop
- **Multi-stop route** (v2.9.6): `{prefix}-fiets-stops` container gevuld door `_fietsRenderStops(prefix)`
  - Stops opgeslagen in `App._fietsStops = { ia: ['',''], ca: ['',''] }`
  - `_fietsVoegStopToe(prefix)` voegt tussenstop in voor Naar
  - `_fietsVerwijderStop(prefix, idx)` verwijdert tussenstop
  - `_fietsInput2(prefix, idx)` / `_kiesSuggestie2(prefix, idx, adres)` — suggesties per stop
- **Auto-invulling** (v2.9.6): `_fietsAutoVulbestemming(prefix)`:
  - IA: vult Naar met `State.gekozenPersoon.adres`; Van met eerste favoriet
  - CA: vult Naar met actienaam (`ca-naam` veld)
- `_vulFietsSamenvatting(prefix)` — aangeroepen vanuit `iaStap(3)` / `caStap(3)`:
  - Rendert stops, vult favorieten, auto-vult bestemming
  - Als GPS actief was: vult km in, toont GPS-samenvatting, opent sectie automatisch
- Tarief: `0.2287` €/km
- `berekenAfstand(prefix)` leest Van/Naar uit `_fietsStops` (niet meer uit vaste inputs)
- `_fietsAutoOpmerking(prefix)` (v2.9.7) — bouwt context-rijke Rydoo-opmerking:
  - IA: `Individuele actie — V.F. — [extra info] — [levensdomeinen] — [vindplaatsen] — [naar-adres]`
  - CA: `Collectieve actie — [naam actie] — [cluster] — [thema]`
  - Vult alleen in als het opmerkingsveld nog leeg is
- `App.slaFietsRitOp(prefix)` — leest stops uit DOM, bouwt `via` uit tussenstops, slaat rit op
- **Stop rit & Verwerk knop** (v2.9.7): `{prefix}-fiets-stop-rit` — rode pulserende knop in stap 3, zichtbaar zolang GPS loopt; stopt GPS definitief en verwerkt km
- **GPS batterij-instellingen** (v2.9.7): `maximumAge: 15000`, minimale verplaatsing `0.02 km` (20m) vóór km-update

**Logboek** (`pg-fiets-logboek`):
- `App.renderFietsLogboek()` — rendert gefilterde tabel
- Jaar/maand filters: `fiets-log-jaar`, `fiets-log-maand`
- Kolommen: Datum, Van → Naar, km, Tarief, Totaal, Opmerking, Verwijder
- Elke cel heeft copy-knop (`App.kopieerTekst(tekst)`)
- `App.printLogboek()` — `window.print()` (A4 CSS verbergt alles behalve logboek)
- `App.exportFietsExcel()` — XLSX export via SheetJS
- `App._verwijderRit(id)` — verwijdert rit uit Firestore

#### Dashboard (hoofdfuncties)
- `App.renderDashboard()` — Triggert alle dashboard-renders
- `App._dashData()` — Filtert data op jaar+maand (hoofdfilters)
- `App._dashKPI(d)` — 9 KPI-kaarten
- `App._dashTop20(d)` — Top 20 meeste uren
- `App._dashTop20Acties(d)` — Top 20 meeste acties
- `App._dashLevensdomeinen(d)`, `_dashVindplaatsen(d)`, `_dashToeleiding(d)`, `_dashMethodiekInd(d)` — Analysebalken
- `App._dashClusterBereik(d)`, `_dashClusterRendement(d)` — Collectief clusters
- `App._dashThema(d)`, `_dashSignalen(d)`, `_dashInstroom(d)`, `_dashFinancieel(d)` — Collectief analyses
- `App._dashLocaties(d)`, `_dashBuurtType(d)`, `_dashMedia()` — Overig

---

## 6. INDIVIDUEEL DASHBOARD — v2.9.4 DRILL-DOWN SYSTEEM

Het individueel gedeelte van het dashboard heeft een **eigen jaar+maand filter** (`dash-ind-jaar`, `dash-ind-maand`) los van de hoofdfilters.

### 6.1 Negen analyseblokken

| Blok | ID's | Inhoud | Klik-actie |
|---|---|---|---|
| 1 — Totaal bereik | `dash-blok1-metrics`, `dash-blok1-n1` | 3 metric-kaarten: personen/acties/uren (jaarbasis) | → N1 persoonslijst |
| 2 — Profiel | `dash-blok2-leeftijd`, `dash-blok2-gezin`, `dash-blok2-n1` | Leeftijdsbalkjes (groen ≤40, blauw >40) + gezinssituatie | → N1 |
| 3 — Eerste contact | `dash-blok3-content`, `dash-blok3-n1` | Oranje balkgrafiek eersteContact | → N1 |
| 4 — Kwetsbaarheid | `dash-blok4-content`, `dash-blok4-legenda`, `dash-blok4-n1` | Score 0–3 balkgrafiek | → N1 |
| 5 — Status contact | `dash-blok5-metrics`, `dash-blok5-n1` | 3 metric-kaarten: actief/uit beeld/eenmalig | → N1 |
| 6 — Intensiteit | `dash-blok6-content`, `dash-blok6-n2` | Top 20 op acties (gradient opacity), direct naar N2 | → N2 dossier direct |
| 7 — Levensdomeinen | `dash-blok7-content`, `dash-blok7-n1` | Heatmap-tabel: acties, uren, gem u/per, personen | → N1 |
| 8 — Methodiek | `dash-blok8-content`, `dash-blok8-n1` | Paarse ramp balkgrafiek | → N1 |
| 9 — Vindplaats | `dash-blok9-freq`, `dash-blok9-uren`, `dash-blok9-n1` | Dubbele balkgrafiek: freq + uren | → N1 |

Drill-panels zijn `<div class="dash-ind-drill-panel" style="display:none">`.

### 6.2 Drill-down architectuur

**State-object**: `App._dashIndState = { n1PanelId, n1Key, n2Nr }`

**Click-map**: `App._dashIndClickMap` — object met sleutels `"panelId::key"` → `{ personen: [...], msgs: {volgnummer: msg} }`. Wordt bij elke render opnieuw opgebouwd.

**Personen-map**: `App._dashIndPM` — `{volgnummer: persoonObject}` voor snelle lookup.

**Laatste data**: `App._dashIndLastData` — gecachte gefilterde data voor drill-down gebruik.

**Niveau 1 (N1)** — Persoonslijst:
- Render: `App._dashIndN1HTML(personen, msgs, indActies)` → genereert rijen via `_dashIndPersonRij`
- Elke rij: avatar (gekleurde cirkel), initialen (bv. "V.F."), levensdomeinen-tags (max 3), statuspil
- Klik op rij → `App._dashIndToggleN2(nr)` — toont N2 inline

**Niveau 2 (N2)** — Volledig dossier:
- Render: `App._dashIndN2HTML(p, acties)`
- Bevat: avatar lg, profiel-velden in grid (adres, leeftijd, woonsituatie, huisvesting, inkomen, eersteContact, gekendBij), notitie, gesorteerde actielijst

**Helper functies**:

| Functie | Wat doet het |
|---|---|
| `_dashIndAvatarKleur(s)` | Hash van initialen-string → 1 van 8 vaste kleuren |
| `_dashIndInit(p)` | Geeft `"V.F."` formaat (privacy) |
| `_dashIndStatus(nr)` | Contactstatus op basis van ALLE acties in `DB.individueel`: eenmalig (1 actie ooit) / actief (<6 maanden geleden) / uitBeeld (≥6 maanden) |
| `_dashIndCloseAll()` | Sluit alle drill-panels, reset state |
| `_dashIndOpenN1(panelId, key)` | Lookup in `_dashIndClickMap`, toggle: tweede klik sluit |
| `_dashIndToggleN2(nr)` | Toggle N2 dossier in N1-panel |
| `_dashIndOpenN2Direct(panelId, nr)` | Direct N2 (voor Blok 6) |
| `_dashIndPersonRij(p, indActies, msg)` | HTML voor 1 persoonrij + inline N2-wrapper |
| `_dashIndClickMetric1(key)` | Opent N1 voor Blok 1 metric-kaart |
| `_dashIndClickMetric5(key)` | Opent N1 voor Blok 5 status-kaart |

### 6.3 Kwetsbaarheidscore (Blok 4)

Score 0–3 per persoon, 1 punt per criterium:
1. **Kwetsbaar inkomen**: `Leefloon`, `Geen inkomen`, `Invaliditeit`, `Werkloosheid`
2. **Precaire huisvesting**: `Dak/Thuisloos`, `Begeleid wonen`, `Housing First`, `RCK`
3. **≥3 levensdomeinen** in de gefilterde periode

---

## 7. CSS DESIGN SYSTEEM

**CSS-variabelen** (`:root` in style.css):
```
--groen, --groen-licht
--blauw, --blauw-licht
--oranje, --oranje-licht
--rood
--paars
--tekst, --zacht, --rand, --achtergrond
--glas, --blur (glass morphism)
```

**Dashboard-klassen**:
- Layout: `dash-wrap`, `dash-g2`, `dash-g3`, `dash-kaart`, `dash-kaart-full`
- Tekst: `dash-kt` (koptitel), `dash-ks` (subtitel), `dash-sec-kop`, `dash-badge`
- Balken: `dash-bar-lijst`, `dash-bi`, `dash-bl` (label), `dash-bt` (balk track), `dash-bf` (balk fill)
- Kleuren: `fill-groen`, `fill-blauw`, `fill-oranje`, `fill-paars`, `fill-rood`
- Tabel: `dash-hm` (heatmap table), `dash-hmc` (heatmap cell)
- KPI: `dash-kpi-rij`, `dash-kpi`
- Divider: `dash-divider`
- Leeg: `dash-leeg`

**Fietsritten CSS-klassen (v2.9.5–v2.9.7)**:
- `gps-badge` — fixed positie (rechtsonder), groen, pulserende animatie tijdens GPS
- `fiets-gps-start`, `fiets-gps-start-btn` — GPS widget in stap 1 (dashed groen, actief = gevuld groen)
- `fiets-gps-km-teller`, `fiets-gps-stop-mini` — live km-teller in wizard + stop-knopje
- `fiets-gps-sam` — GPS samenvatting blok in stap 3 (groen, toont bijgehouden km)
- `fiets-sectie`, `fiets-toggle`, `fiets-inhoud` — inklapbare fietsvergoeding sectie
- `fiets-stop-rit-btn` — rode pulserende "Stop rit & Verwerk" knop in stap 3 (`pulse-red` animatie)
- `fiets-stop-rij`, `fiets-stop-label`, `fiets-stop-del-btn` — multi-stop route rijen
- `fiets-extra-stop-btn` — blauw "+ Extra stop" knop
- `fiets-auto-btn` — oranje "🔄 Vul bestemming in" knop
- `fiets-input`, `fiets-sug`, `fiets-sug-item` — adresinvoer met dropdown suggesties
- `fiets-favs`, `fiets-fav-btn` — favoriete adressen knoppen
- `fiets-btn-route` — bereken route knop
- `fiets-result`, `fiets-km-input`, `fiets-totaal` — resultaatbalk km × tarief
- `fiets-sla-btn` — opslaan knop (verborgen tot km ingevuld)
- `fiets-log-tabel`, `fiets-kop-btn`, `fiets-del-btn` — logboek tabel + knoppen
- `@media print` — verbergt ALLES behalve `pg-fiets-logboek` (A4 afdruk)

**Drill-down klassen (v2.9.4)**:
- `dash-ind-drill-panel` — container voor N1/N2
- `dash-ind-n1-header`, `dash-ind-n1-list`
- `dash-ind-person-row` — klikbare persoonrij
- `dash-ind-avatar`, `dash-ind-avatar-lg` — ronde avatar (32px / 48px)
- `dash-ind-tag` — levensdomein-tag op persoonrij
- `dash-ind-pill`, `-actief`, `-uitbeeld`, `-eenmalig`, `-geen` — statuspillen
- `dash-ind-n2-wrapper`, `dash-ind-n2`, `dash-ind-n2-header` — N2 dossier
- `dash-ind-n2-blok`, `dash-ind-n2-blok-titel` — N2 veld-blokken
- `dash-ind-actie-rij`, `-datum`, `-info` — acties in N2
- `dash-ind-metric`, `-groen`, `-blauw`, `-oranje`, `-rood` — metric-kaarten
- `dash-ind-metric-getal`, `-label`, `-sub` — metric-kaart inhoud

---

## 8. DASHBOARD HTML-STRUCTUUR (pg-dashboard)

```
pg-dashboard
├── dash-wrap
│   ├── KPI-filters: dash-jaar-filter, dash-maand-filter
│   ├── KPI-rij (dash-kpi-rij): kpi-personen, kpi-ind, kpi-uren, kpi-col, kpi-bereik, kpi-nieuw, kpi-vrijw, kpi-signalen, kpi-toeleiding
│   │
│   ├── 👤 Individueel (dash-badge groen-badge)
│   │   ├── filter-balk: dash-ind-jaar, dash-ind-maand
│   │   ├── Blok 1: dash-blok1-metrics, dash-blok1-n1
│   │   ├── Blok 2: dash-blok2-leeftijd, dash-blok2-gezin, dash-blok2-n1
│   │   ├── Blok 3: dash-blok3-content, dash-blok3-n1
│   │   ├── Blok 4: dash-blok4-content, dash-blok4-legenda, dash-blok4-n1
│   │   ├── Blok 5: dash-blok5-metrics, dash-blok5-n1
│   │   ├── Blok 6: dash-blok6-content, dash-blok6-n2
│   │   ├── Blok 7: dash-blok7-content, dash-blok7-n1
│   │   ├── Blok 8: dash-blok8-content, dash-blok8-n1
│   │   └── Blok 9: dash-blok9-freq, dash-blok9-uren, dash-blok9-n1
│   │
│   ├── 🏘 Collectief (dash-badge blauw-badge)
│   │   ├── dash-cluster-bereik, dash-cluster-rend
│   │   ├── dash-thema, dash-signalen, dash-instroom
│   │   └── dash-fin, dash-partners, dash-buurttype
│   │
│   └── 📷 Media
│       └── dash-media
```

---

## 9. WERKSTROMEN

### Persoon aanmaken
1. `pg-persoon-wiz` → 3 stappen → `App.slaPerOp()`
2. Record opgeslagen in `DB.personen` → Firestore

### Individuele actie aanmaken
1. `pg-ind-actie-wiz` → persoon zoeken → maand/jaar → domeinen etc. → `App.slaIaOp()`
2. Record opgeslagen met `persoonNummer` koppeling

### Collectieve actie + modules
1. `pg-col-actie-wiz` → `App.slaCaOp()` → hoofdactie (`module: null`)
2. `pg-collectief-module` → `App.startModule(type)` → module-formulier → sub-record (`module: 'Logistiek'` etc.)

### Fietsrit registreren
1. Wizard stap 3 (IA of CA) → klik "🚲 Fietsvergoeding toevoegen" → sectie opent
2. Van/Naar invullen (met adressuggesties of favorieten) → "Bereken route" (Nominatim + OSRM) of GPS-tracking
3. Km wordt ingevuld → tarief × km = totaal automatisch → opmerking gegenereerd
4. "Sla rit op" → `App.slaFietsRitOp(prefix)` → record in `users/{uid}/fietsritten`
5. Sectie reset automatisch

### Fietslogboek bekijken
1. `pg-jaarplan` → "🚲 Fietslogboek" knop → `App.nav('pg-fiets-logboek')`
2. `App.renderFietsLogboek()` → jaar/maand filteren → tabel met alle ritten
3. Per cel: copy-knop; volledig logboek: print (A4) of Excel export

### Dashboard refreshen
1. `App.renderDashboard()` → `_dashData()` → alle render-functies
2. Individueel: `_dashIndVulFilters()` → `_dashIndRender()` → blok1-9

---

## 10. VERSIEGESCHIEDENIS (recent)

| Tag | Beschrijving |
|---|---|
| `v2.9.7` | Stop rit & Verwerk knop, batterij-optimalisatie GPS, geavanceerde Rydoo-opmerking, foutafhandeling |
| `v2.9.6` | GPS in wizardstap 1 met live km-teller, multi-stop route (+Extra stop), auto-invulling bestemming |
| `v2.9.5` | Fietsritten module: GPS tracking, Nominatim/OSRM routeberekening, logboek, Rydoo-export |
| `v2.9.4` | Individueel dashboard volledig vernieuwd: 9 blokken + drill-down N1/N2 |
| `v2.9.3` | 8 nieuwe analyseblokken individueel dashboard + filterbar (backup-tag: `v2.9.3-backup`) |
| `v2.9.2` | Navigatiefix, fotobeheer, download, kostlijn layout |
| `v2.9.0` | Strakke mobiele layout |
| `v2.8.0` | Mediabeheer, foto/bewijs downloads, XLSX export, SW update |

---

## 11. CODERINGSCONVENTIES

- **Taal**: NL (variabelen, commentaar, UI-teksten)
- **JS-stijl**: ES5 (`var`, `function`, geen arrow functions, geen classes)
- **Geen externe libraries** voor UI (geen React, Vue, jQuery)
- **Balkengrafieken**: puur HTML/CSS (`dash-bar-lijst` structuur), geen Chart.js
- **Heatmaps**: `<table class="dash-hm">` met inline `background:rgb(...)` kleurcodering
- **HTML in JS**: template strings gebouwd via string concatenatie, altijd `App.esc()` voor user data
- **Onclick in gegenereerde HTML**: `onclick="App.methodNaam(arg)"` direct in de string
- **Firebase writes**: altijd via `DB.sla*Op()` methoden die `_syncLijst()` gebruiken
- **Versie bumpen**: in `app.js` (regel 9: `APP_VERSION`), `index.html` (css/js query strings + footer + `CURRENT_VERSION`), `service-worker.js` (`CACHE_NAAM`)
