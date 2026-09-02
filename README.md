# FlightScanner

Skener najnižších cien priamych letov z Bratislavy a interaktívny HTML dashboard.

## Spustenie

```bash
# Obnov všetko potrebné pre dashboard a skenuj najbližších 30 dní
python3 Main.py

# Voliteľne zmeň rozsah, napríklad na 45 dní
python3 Main.py --days 45

# Spusti stránku v Codespace
python3 -m http.server 1455 --directory HTML
```

Stránku potom otvor cez adresu portu Codespace, napríklad:

```text
https://obscure-space-dollop-q64r6jg5xqwf96jj-1455.app.github.dev/
```

Dashboard obsahuje mapu trás, filtre podľa krajiny, aerolinky, ceny, dĺžky a dňa
odletu, radenie tabuľky a detail každej ponuky. Pri filtrovaní podľa dňa zobrazí
pri každej trase najlacnejší konkrétny odlet v zvolený deň. Detail zobrazuje aj
dostupné priame návraty do Bratislavy počas 10 dní po najlacnejšom odlete, cenu
cesty späť a celkovú cenu oboch smerov. `Main.py` postupne obnoví zoznam
aerolínií, naskenuje ceny a vygeneruje dáta stránky. Dáta stránky sú v
`HTML/flight-data.js` a vytvárajú sa z najnovšieho `Data/destinations_YYYY_MM.json`.

Mapa a logá potrebujú internetové pripojenie. Tabuľka a filtre fungujú lokálne.

## Automatická aktualizácia verejnej stránky

Workflow `.github/workflows/refresh-dashboard.yml` spúšťa `Main.py` každý deň
o 05:17 a 17:17 UTC. Po úspešnom skene skopíruje obsah `HTML/` do verejného
repozitára `romanduris/FlightScanner-web`; GitHub Pages potom stránku automaticky
nasadí.

Súkromný repozitár `FlightScanner` musí mať Actions secret
`FLIGHTSCANNER_WEB_TOKEN`. Použi fine-grained personal access token s prístupom
iba k repozitáru `FlightScanner-web` a oprávnením **Contents: Read and write**.
Workflow sa dá spustiť aj ručne v záložke Actions, kde možno zmeniť počet dní.
