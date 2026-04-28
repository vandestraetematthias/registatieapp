# Buurtwerk Venning — Volledig contextdocument voor Claude
**Versie**: 3.0.4 | **Datum**: 2026-04-28
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
| PWA | Service Worker (`service-worker.js`, cache `buurtwerk-v3.0.4`) |
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
| `actieRef` | string | ID van de gekoppelde collectieve actie |
| `jaar` | number | Jaar van de rit |
| `maand` | string | `Januari` … `December` |
| `status` | string | `'open'` / `'gekoppeld'` / `'gearchiveerd'` |

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
| `pg-fiets-gps` | Fietsritten: 3 tabs (GPS & Invoer / Logboek / Koppelen) |

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
- Fietsritten-listener start apart (telt NIET mee in `_laadGereed`), refresht `pg-fiets-gps` bij wijziging

### 5.2 Object `Auth` — authenticatie

- `Auth.inloggen()` — Firebase signIn met email/password
- `Auth.registreren()` — Firebase createUser
- `Auth.uitloggen()` — Stops listeners + Firebase signOut
- `onAuthStateChanged` listener → toont app of loginpagina

### 5.3 Object `App` — applicatielogica

#### Startpagina recente acties
- `App.renderStart()` — Rendert `#start-recente`: alle actieve individuele acties + alle collectieve records (hoofdacties én modules), gesorteerd op `aangemaakt || datum` aflopend, **zonder limiet**
- Badge-kleur per type: Individueel = groen, Actie = blauw, Logistiek = blauw, Overleg = paars, Activiteit = oranje
- Meta-tekst per module-type:
  - **Hoofdactie** (`module: null`): `"Maand JJJJ — N bewoners"`
  - **Activiteit**: `"DD/MM/YYYY — locatie"` (veld `locatie`)
  - **Logistiek**: `"DD/MM/YYYY — uitlegType[0]"` (eerste waarde uit array)
  - **Overleg**: `"DD/MM/YYYY — notitie (max 40 tekens…)"`
  - Datum: `datum` ISO-veld geformatteerd als DD/MM/YYYY; fallback op `aangemaakt`

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

#### Fietsritten module (v3.0.0) — Standalone pagina pg-fiets-gps

**Architectuur**: Volledig los van de wizards (ia/ca). Eigen pagina `pg-fiets-gps` met 3 tabs:
1. **Tab 1 — GPS & Invoer**: GPS tracking starten/stoppen, route-adressen invullen, Google Maps afstand berekenen, manueel km + datum invoeren en opslaan
2. **Tab 2 — Logboek**: Gefilterd overzicht van ritten (Datum, km, Status, Reden), print + Excel export
3. **Tab 3 — Koppelen**: Gekoppeld een opgeslagen rit aan een individuele persoon of collectieve actie, Rydoo-opmerking genereren

**State-variabelen**:
- `_gpsLbWatchId` — geolocation watch ID
- `_gpsLbRoute` — array van {lat, lon} punten
- `_gpsLbKm` — opgetelde kilometer teller
- `_gpsLbActief` — boolean GPS loopt
- `_gpsLbWakeLock` — Wake Lock API object
- `_gpsLbBest` — array van adresstrings (Van, Via…, Naar)
- `_gpsLbRit` — meest recent opgeslagen rit-document
- `_gpsLbGekozenPersoon`, `_gpsLbGekozenActie` — geselecteerde koppeling
- `_gpsLbRedenStr` — gegenereerde Rydoo-opmerking
- `_gpsLbRouteKm` — afstand berekend via Google Maps
- `_gpsLbKoppelType` — `'ia'` of `'ca'`

**Functies (nieuw)**:
- `App.renderFietsGps()` — init GPS-pagina (tab 1 actief, datum default vandaag, renderFietsLogboek aanroepen)
- `App.gpsLbTab(n)` — wissel tab 1/2/3
- `App._gpsLbStartGps()` / `_gpsLbStopGps()` — GPS tracking (Wake Lock, Haversine 20m drempel, km naar invoerveld na stop)
- `App._haversine(lat1,lon1,lat2,lon2)` — Haversine formula km
- `App._gpsLbRenderBest()` — renders route-adres inputs met Google Places Autocomplete (BE)
- `App._gpsLbVoegBestemmingToe()` / `_gpsLbVerwijderBest(idx)` / `_gpsLbSyncBest(idx, val)` — route beheer
- `App._gpsLbBerekenRoute()` — Google Maps DistanceMatrixService (BICYCLING), per segment
- `App._gpsLbToonRoute(km)` — toont resultaat, vult km-invoer
- `App._gpsLbManueelSla()` — slaat manuele km + datum op
- `App._gpsLbSlaRitOp(km, type, datumOverride)` — schrijft fietsrit naar Firestore, opent tab 3
- `App._gpsLbKoppelRitInfo()` — toont rit-info in tab 3
- `App._gpsLbToggleKoppelType(type)` — 'ia' / 'ca' wissel
- `App._gpsLbZoekPersonen()` / `_gpsLbKiesPersonen(id)` — zoek + selecteer persoon
- `App._gpsLbLaadActies()` / `_gpsLbKiesActie(id)` — laad + selecteer collectieve actie
- `App._gpsLbGenReden()` — genereert Rydoo-tekst: `"Individueel — V.F. — Van → Naar — X,X km"` of `"Collectief — Actienaam — Van → Naar — X,X km"`
- `App._gpsLbKoppelSlaOp()` — update Firestore: opmerking, actieRef, categorie, status `'gekoppeld'`
- `App._gpsLbKoppel(id)` — laad specifieke rit vanuit logboek naar tab 3
- `App.verwijderCa(id, naam)` — verwijdert collectieve actie definitief (confirm eerst)

**Google Maps API**: `AIzaSyARXw1vzjH8e0kMsR2zhLpfNh5rkOh1wuc` — geladen als `async defer` script in `<head>` met `&libraries=places`.

**Logboek** (`pg-fiets-gps` Tab 2):
- `App.renderFietsLogboek()` — rendert gefilterde tabel
- Kolommen: Datum, km, Status (`open`/`gekoppeld`), Reden/Opmerking, Verwijder
- Status `open` → toont "🔗 Koppelen" knop → `App._gpsLbKoppel(id)` → tab 3
- Status `gekoppeld` → toont opmerking + copy-knop
- `App.printLogboek()`, `App.exportFietsExcel()`, `App._verwijderRit(id)` — behouden

**Navigatieknop**: `pg-jaarplan` → knop "🚲 Fietsritten" → `App.nav('pg-fiets-gps')`

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

**Fietsritten CSS-klassen (v3.0.0, prefix `gps-lb-`)**:
- `gps-lb-tabs`, `gps-lb-tab-btn` — tab-balk en tab-knoppen (`.actief` = groen gevuld)
- `gps-lb-start-btn` — dashed groene GPS-startknop (hover → gevuld groen)
- `gps-lb-km-display` — live km-display tijdens GPS (groen achtergrond)
- `gps-lb-sam-rij` — flex rij voor km + datum manuele invoer
- `gps-lb-sla-btn`, `gps-lb-koppel-sla-btn` — groene opslaan/koppel knoppen
- `gps-lb-add-btn` — blauw "+ Bestemming toevoegen" knop
- `gps-lb-bereken-btn` — groene "Bereken via Google Maps" knop
- `gps-lb-result-km` — groene resultaat-balk met berekende afstand
- `gps-lb-seg-rij`, `gps-lb-seg-lbl`, `gps-lb-adres-inp`, `gps-lb-seg-del` — route-segment rijen (Van/Via/Naar)
- `gps-lb-tabel` — logboek tabel (5 kolommen: Datum, km, Status, Reden, Acties)
- `gps-lb-status-ok` — groene pill voor "gekoppeld" status
- `gps-lb-status-open` — oranje pill voor "open" status
- `gps-lb-reden-cel` — tabelcel voor opmerking (max-width, word-break)
- `gps-lb-koppel-btn` — blauw "🔗 Koppelen" knop in tabel
- `gps-lb-del-btn` — verwijder knop in tabel
- `fiets-kop-btn` — copy-knop (bewaard uit v2.x)
- `fiets-log-teller` — teller tekst boven logboek (bewaard)
- `gps-lb-persoon-rij`, `gps-lb-actie-rij` — klikbare rijen in koppelen-tab
- `gps-lb-reden-preview` — groen achtergrondvak voor gegenereerde Rydoo-opmerking
- `gps-lb-rit-info-rij` — blauw info-banneertje met rit-details in koppelen-tab
- `@media print` — verbergt alles behalve `pg-fiets-gps` + panel 2 (logboek)

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

### Fietsrit registreren (v3.0.0)
1. `pg-jaarplan` → "🚲 Fietsritten" → `App.nav('pg-fiets-gps')` → tab 1 actief
2. **GPS**: klik "🚲 Start GPS-rit" → tracking start → km loopt live → "⏹ Stop GPS" → km vult invoerveld
3. **Route**: adressen invoeren (Google Places Autocomplete) → "🗺 Bereken via Google Maps" → km ingevuld
4. **Manueel**: km + datum invoeren
5. "💾 Opslaan als rit" → `App._gpsLbManueelSla()` / `_gpsLbSlaRitOp()` → record in Firestore → tab 3

### Fietsrit koppelen (v3.0.0)
1. Tab 3 (of via "🔗 Koppelen" knop in logboek) → rit-info getoond
2. Kies type: Individueel → zoek persoon → selecteer; of Collectief → kies actie
3. Rydoo-opmerking gegenereerd: `"Individueel — V.F. — Van → Naar — X km"`
4. "🔗 Koppeling opslaan" → Firestore update: `opmerking`, `actieRef`, `status: 'gekoppeld'`

### Fietslogboek bekijken (v3.0.0)
1. `pg-fiets-gps` → tab 2 → `App.renderFietsLogboek()` → jaar/maand filteren
2. Kolommen: Datum, km, Status (open/gekoppeld), Reden/Opmerking
3. Open ritten: "🔗 Koppelen" knop; gekoppeld: opmerking + copy-knop
4. Print (A4) of Excel export

### Dashboard refreshen
1. `App.renderDashboard()` → `_dashData()` → alle render-functies
2. Individueel: `_dashIndVulFilters()` → `_dashIndRender()` → blok1-9

---

## 10. VERSIEGESCHIEDENIS (recent)

| Tag | Beschrijving |
|---|---|
| `v3.0.4` | Bugfix `renderColStart`: module-subtitel toont nu datum+locatie/type/notitie i.p.v. herhaalde actienaam |
| `v3.0.3` | Recente acties pg-start: modules zichtbaar, rijke meta per type, geen limiet |
| `v3.0.2` | Bugfix: Google Maps callback-laadvolgorde, GPS maximumAge=0, error-UI reset |
| `v3.0.1` | Chronologische sortering recente acties (aangemaakt + datum), galerij-knop foto-upload uitgebreid naar Logistiek en Overleg modules |
| `v3.0.0` | Fietsritten volledig herschreven: standalone `pg-fiets-gps` (3 tabs), Google Maps API, koppeling aan IA/CA, verwijder-CA knop, galerij + scan knoppen voor foto/bewijs |
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
