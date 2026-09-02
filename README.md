# FlightScanner

Skener najnižších cien priamych letov z Bratislavy a interaktívny HTML dashboard.

## Spustenie

```bash
# 1. Obnov aerolinky a destinácie z webu letiska
python3 1.ListOfAirlines.py

# 2. Naskenuj ceny a letové časy Ryanair + Wizz Air
python3 2.Destination.py --year 2026 --month 9

# 3. Priprav najnovšie dáta pre dashboard
python3 3.GenerateDashboard.py

# 4. Spusti stránku v Codespace
python3 -m http.server 1455 --directory HTML
```

Stránku potom otvor cez adresu portu Codespace, napríklad:

```text
https://obscure-space-dollop-q64r6jg5xqwf96jj-1455.app.github.dev/
```

Dashboard obsahuje mapu trás, filtre podľa krajiny, aerolinky, ceny, dĺžky a dňa
odletu, radenie tabuľky a detail každej ponuky. Detail zobrazuje aj dostupné
priame návraty do Bratislavy počas 10 dní po najlacnejšom odlete, cenu cesty
späť a celkovú cenu oboch smerov. Dáta stránky sú v
`HTML/flight-data.js` a vytvárajú sa z najnovšieho `Data/destinations_YYYY_MM.json`.

Mapa a logá potrebujú internetové pripojenie. Tabuľka a filtre fungujú lokálne.
