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

## Booking.com affiliate odkazy

Každý spiatočný let ponúka samostatný odkaz na Booking.com s predvolenou
destináciou, dátumom príletu ako check-inom a dátumom spiatočného letu ako
checkoutom. Po prijatí do affiliate programu stačí doplniť pridelené `aid` do
`HTML/booking/booking-com-config.js`. Voliteľný `label` rozlišuje toto
umiestnenie odkazu v affiliate reportoch. Do repozitára sa nevkladá žiadne API
heslo ani secret.

## Automatická aktualizácia verejnej stránky

Workflow `.github/workflows/refresh-dashboard.yml` spúšťa `Main.py` každý deň
o 08:11 a 18:11 v časovom pásme `Europe/Bratislava`. Po úspešnom
skene odošle obsah `HTML/` priamo na GitHub Pages toho istého verejného
repozitára. Stránka je dostupná na adrese
`https://romanduris.github.io/FlightScanner/` a nie je potrebný žiadny osobný
token ani druhý repozitár. Workflow sa dá spustiť aj ručne v záložke Actions,
kde možno zmeniť počet dní.
