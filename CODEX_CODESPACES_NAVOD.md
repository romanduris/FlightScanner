# Codex v GitHub Codespaces – inštalácia a prihlásenie

Tento návod použi, keď chceš spustiť Codex CLI v GitHub Codespace a prihlásenie skončí na adrese `localhost:1455`, ktorá sa v tvojom prehliadači nedá otvoriť.

## 1. Otvor terminál v Codespace

Vo VS Code otvor **Terminal → New Terminal** a prejdi do priečinka projektu.

Najprv skontroluj, či je Codex nainštalovaný:

```bash
codex --version
```

Ak terminál vypíše `codex: command not found`, nainštaluj Codex:

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | sh
```

Potom otvor nový terminál a znovu skús:

```bash
codex --version
```

## 2. Najjednoduchšie prihlásenie – Device Code

V Codespace je toto odporúčaný spôsob, pretože nepotrebuje callback cez `localhost`:

```bash
codex login --device-auth
```

1. Otvor odkaz, ktorý sa zobrazí v termináli.
2. Prihlás sa do ChatGPT/OpenAI účtu.
3. Zadaj jednorazový kód z terminálu.
4. Po úspechu skontroluj prihlásenie:

```bash
codex login status
```

Ak Device Code nie je dostupný, zapni ho v bezpečnostných nastaveniach ChatGPT účtu. Pri pracovnom účte ho možno musí povoliť administrátor workspace. Ak ani potom nefunguje, pokračuj nasledujúcim postupom.

## 3. Prihlásenie cez prehliadač a nahradenie localhostu

### 3.1 Spusti prihlasovanie

V termináli spusti:

```bash
codex login
```

Terminál nechaj otvorený. Codex počas prihlasovania počúva na porte `1455`.

### 3.2 Sprístupni port 1455

1. Vo VS Code otvor kartu **PORTS** vedľa karty **TERMINAL**.
2. Ak tam port `1455` nie je, klikni na **Forward a Port** a zadaj `1455`.
3. Port môže zostať **Private**. V prehliadači musíš byť prihlásený do GitHub účtu, ktorý má prístup k tomuto Codespace.
4. Adresa portu pre tento Codespace je:

```text
https://obscure-space-dollop-q64r6jg5xqwf96jj-1455.app.github.dev/
```

Pozor: po vytvorení nového Codespace sa jeho názov a URL môžu zmeniť. Aktuálnu adresu vždy nájdeš na karte **PORTS** pri porte `1455`.

### 3.3 Dokonči prihlásenie

1. Otvor prihlasovací odkaz, ktorý vypísal príkaz `codex login`.
2. Prihlás sa do ChatGPT/OpenAI.
3. Na konci sa prehliadač pokúsi otvoriť adresu podobnú tejto:

```text
http://localhost:1455/auth/callback?code=ABC&state=XYZ
```

4. Ak táto stránka nefunguje, skopíruj **celú adresu** z adresného riadka prehliadača.
5. Nahraď iba začiatok:

```text
http://localhost:1455
```

za:

```text
https://obscure-space-dollop-q64r6jg5xqwf96jj-1455.app.github.dev
```

Výsledná adresa musí vyzerať napríklad takto:

```text
https://obscure-space-dollop-q64r6jg5xqwf96jj-1455.app.github.dev/auth/callback?code=ABC&state=XYZ
```

Ak pôvodná adresa používa `127.0.0.1:1455` namiesto `localhost:1455`, nahraď ho rovnakým spôsobom.

Dôležité:

- Zachovaj celú časť od `/auth/callback` až po koniec vrátane parametrov `code` a `state`.
- Medzi `.dev` a `auth` musí byť práve jedno lomítko: `.dev/auth/...`.
- Upravenú adresu otvor, kým príkaz `codex login` stále beží v termináli.
- Callback URL obsahuje dočasný prihlasovací kód. Nikomu ju neposielaj a neukladaj ju do projektu.

6. Po otvorení upravenej adresy by prehliadač mal oznámiť úspešné prihlásenie a terminál by mal pokračovať.
7. Over výsledok:

```bash
codex login status
```

8. Spusti Codex v priečinku projektu:

```bash
codex
```

## 4. Keď to stále nefunguje

### Stránka hlási 404 alebo Not Found

Pravdepodobne si otvoril iba základnú Codespaces adresu. Musíš k nej pridať pôvodnú cestu `/auth/callback?...` aj so všetkými parametrami.

### Chyba `state mismatch`, neplatný alebo expirovaný kód

Prihlasovací pokus už vypršal alebo bola použitá staršia callback URL. Ukonči pokus pomocou `Ctrl+C`, znovu spusti `codex login` a použi najnovšiu adresu s novými parametrami `code` a `state`.

### Codespaces URL sa nedá otvoriť

Skontroluj, že:

- `codex login` stále beží,
- port `1455` je na karte **PORTS** presmerovaný,
- používaš aktuálnu URL z karty **PORTS**,
- v prehliadači si prihlásený do správneho GitHub účtu.

### Codex je prihlásený do nesprávneho účtu

Odhlás sa a začni znova:

```bash
codex logout
codex login --device-auth
```

## 5. Bezpečnostná poznámka

Prihlasovacie údaje Codexu sa môžu ukladať do `~/.codex/auth.json`. Tento súbor funguje podobne ako heslo: nikdy ho nepridávaj do Gitu, neposielaj ho iným ľuďom a nevkladaj jeho obsah do issue ani chatu.

## Oficiálna dokumentácia

- [Inštalácia a spustenie Codex CLI](https://learn.chatgpt.com/docs/codex/cli)
- [Prihlasovanie do Codexu vrátane headless prostredí](https://learn.chatgpt.com/docs/auth)
- [Príkazy `codex login`, `status` a `logout`](https://learn.chatgpt.com/docs/developer-commands?surface=cli)
