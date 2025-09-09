# TODO: Vollständige Bearer Token Entfernung

**Ziel**: Komplette Entfernung aller Bearer Token Funktionalität aus allen Modulen
**Status**: ⏳ In Planung
**Betroffene Dateien**: 14 aktive Dateien, 50+ Code-Referenzen

---

## 🔥 **PHASE 1: CORE CODE REFACTORING**

### 1.1 RemoteServer.mjs - Haupt-Refactoring
- [ ] `#routeAuth` private Variable entfernen (Zeile ~18)
- [ ] `#bearerAuthMiddleware` Methode komplett entfernen (Zeile 283-285)
- [ ] Globales Middleware `this.#app.use(this.#bearerAuthMiddleware.bind(this))` entfernen (Zeile 40)
- [ ] `bearerToken` Parameter aus `prepareRoutesActivationPayloads()` entfernen (Zeile 79, 87)
- [ ] Bearer Token Speicherung entfernen aus `start()` Methode (Zeile 113-114)
- [ ] Auth-Middleware aus `#initRoute()` entfernen (Zeile 160-173)
- [ ] Bearer Token aus Console-Output entfernen (Zeile 128-130)
- [ ] Bearer Token Validation aus `#validationStart()` entfernen (Zeile 318, 338-340)

**Erwartung**: ~8 Änderungen, ~50 Zeilen weniger Code

### 1.2 Deploy/Single.mjs - Route-Strukturen
- [ ] `bearerToken` Parameter aus argvs-Destrukturierung entfernen (Zeile 75)
- [ ] `bearerToken` aus Route-Objekten entfernen (Zeile 93)

**Erwartung**: 2 Änderungen

### 1.3 Deploy/Advanced.mjs - Indirekte Anpassung
- [ ] Testen ob Code nach RemoteServer-Änderungen noch funktioniert
- [ ] Falls nötig: Input-Validierung für `arrayOfRoutes` ohne bearerToken anpassen

**Erwartung**: 0-1 Änderungen

### 1.4 Parameters.mjs - CLI-Parameter
- [ ] `--bearerToken` CLI-Parameter aus Definition entfernen (Zeile 25)

**Erwartung**: 1 Änderung

---

## 🧪 **PHASE 2: TESTS KOMPLETT ÜBERARBEITEN**

### 2.1 RemoteServer.test.mjs - Haupt-Tests (15 Referenzen)
- [ ] "should setup express middleware and bearer auth" Test-Name ändern (Zeile 90)
- [ ] Express middleware Assertions von 2 auf 1 reduzieren (Zeile 93)
- [ ] `bearerToken: 'token123'` aus Mock-Objekten entfernen (Zeile 164, 216, 244, 267, 293)
- [ ] "should setup route authentication for bearer tokens" Test komplett löschen (Zeile 340-348)
- [ ] `bearerToken: null` aus Mock-Objekten entfernen (Zeile 169, 371, 393)
- [ ] `bearerToken: 'sse-token'/'streamable-token'` aus Tests entfernen (Zeile 387, 393)
- [ ] `bearerToken: 'integration-token'` aus Integration-Test entfernen (Zeile 429)

**Erwartung**: ~10 Änderungen, 1 kompletter Test weniger

### 2.2 Deploy.test.mjs - Deploy-Tests (10 Referenzen)
- [ ] `bearerToken: 'token123'` aus Mock-Objekten entfernen (Zeile 192, 220, 239, 258, 341)
- [ ] `bearerToken: 'secret'` aus Tests entfernen (Zeile 220, 239)
- [ ] `bearerToken: 'token'` aus Route-Arrays entfernen (Zeile 273-275)
- [ ] `bearerToken: 'integration-token'` aus Integration-Test entfernen (Zeile 464)

**Erwartung**: 10 Änderungen

### 2.3 DeployAdvanced.test.mjs - Advanced-Tests (8 Referenzen)  
- [ ] `bearerToken: 'token123'` aus Mock-Objekten entfernen (Zeile 104, 146, 242)
- [ ] `bearerToken: null` aus Tests entfernen (Zeile 146)
- [ ] `bearerToken: 'sse-token'/'streamable-token'` entfernen (Zeile 179, 184)
- [ ] `bearerToken: 'custom-token'` aus Tests entfernen (Zeile 242)
- [ ] `bearerToken: 'prod-token'/'dev-token'` aus Multi-Route Tests entfernen (Zeile 274, 279)

**Erwartung**: 8 Änderungen

### 2.4 Parameters.test.mjs - CLI-Tests (3 Referenzen)
- [ ] `--bearerToken=` aus Test-Definitionen entfernen (Zeile 32, 118)
- [ ] `expect(argvs.bearerToken).toBe('test123')` Assertion entfernen (Zeile 130)

**Erwartung**: 3 Änderungen

### 2.5 NamespaceFiltering.test.mjs - Integration-Tests (2 Referenzen)
- [ ] `bearerToken: 'crypto-token'` aus Mock entfernen (Zeile 438)
- [ ] `bearerToken: 'prod-token'` aus Mock entfernen (Zeile 443)

**Erwartung**: 2 Änderungen

### 2.6 Weitere Test-Dateien bereinigen
- [ ] `tests/deploy/deploy-multiple-simple.mjs`: 2x `bearerToken: null` entfernen (Zeile 32, 40)
- [ ] `tests/server/remote-server-events.mjs`: `bearerToken: null` entfernen (Zeile 33)
- [ ] `tests/server/remote-server.mjs`: `bearerToken: null` entfernen (Zeile 33)
- [ ] `tests/others/argv-remote.mjs`: bearerToken-Referenzen entfernen (Zeile 33, 62)

**Erwartung**: 6 Änderungen

---

## 📝 **PHASE 3: BEISPIELE & DOKUMENTATION**

### 3.1 Beispiel-Dateien aktualisieren
- [ ] `example-stateless.mjs`: `bearerToken: null` aus arrayOfRoutes entfernen (Zeile 19)

**Erwartung**: 1 Änderung

### 3.2 README.md - Komplette Auth-Sektion entfernen (8 Referenzen)
- [ ] "Optional Bearer token authentication" aus Features entfernen (Zeile 87)
- [ ] `bearerToken: 'mysecrettoken'` aus RemoteServer-Beispiel entfernen (Zeile 104)
- [ ] `bearerToken: 'crypto-secret'/'admin-secret'` aus DeployAdvanced entfernen (Zeile 196, 201)
- [ ] OLD API Beispiel: `bearerToken: 'token'` entfernen (Zeile 258, 273)
- [ ] "🔐 Authentication (Optional)" komplette Sektion löschen (Zeile 314-317)
- [ ] Table of Contents: "Authentication (Optional)" Link entfernen

**Erwartung**: 6 Änderungen, 1 komplette Sektion weniger

---

## ✅ **PHASE 4: VALIDIERUNG & QUALITÄTSSICHERUNG**

### 4.1 Code-Syntax prüfen
- [ ] `npm run test` ausführen - ALLE 95 Tests müssen bestehen
- [ ] Syntax-Errors beheben falls vorhanden
- [ ] Alle Import/Export-Statements validieren

### 4.2 API-Konsistenz prüfen  
- [ ] `example-stateless.mjs` ausführen - muss ohne Errors starten
- [ ] RemoteServer-Instanziierung ohne bearerToken testen
- [ ] DeployAdvanced.start() mit bereinigten arrayOfRoutes testen

### 4.3 Dokumentation validieren
- [ ] README.md auf gebrochene Links prüfen
- [ ] Alle Code-Beispiele auf Syntax-Korrektheit testen
- [ ] Table of Contents-Links funktional testen

---

## 📊 **FORTSCHRITT-ÜBERSICHT**

**Phase 1 - Core Code**: ⏳ 0/12 Aufgaben
**Phase 2 - Tests**: ⏳ 0/42 Aufgaben  
**Phase 3 - Dokumentation**: ⏳ 0/7 Aufgaben
**Phase 4 - Validierung**: ⏳ 0/6 Aufgaben

**GESAMT**: ⏳ **0/67 Aufgaben abgeschlossen**

---

## 🎯 **ERFOLGSKRITERIEN**

- ✅ **Alle 95 Tests bestehen** nach Refactoring
- ✅ **Keine bearerToken-Referenzen** mehr im aktiven Code
- ✅ **example-stateless.mjs startet ohne Errors**
- ✅ **README.md ohne Auth-Dokumentation**
- ✅ **Saubere, fokussierte APIs** ohne Auth-Komplexität

**Geschätzte Dauer**: 2-3 Stunden systematische Arbeit
**Komplexität**: Hoch (67 Änderungen), aber strukturiert durchführbar
**Risiko**: Niedrig - Tests validieren jeden Schritt