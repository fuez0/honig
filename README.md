# Honig ab Hof – Imkerei Josef Filz

Website mit Online-Vorreservierung (nur Selbstabholung). Statische Seiten auf GitHub Pages, Daten in Supabase (Projekt „Honig Filz“, Frankfurt).

- Website: https://fuez0.github.io/honig/
- Verwaltung: https://fuez0.github.io/honig/admin.html
- honig.x10.mx leitet weiter (Datei `x10-weiterleitung.html` als index.html einmalig dort in `public_html` hochladen)

## Aufbau
- `index.html`, `status.html`, `impressum.html`, `datenschutz.html` – öffentliche Seiten
- `admin.html` + `admin.js` – Verwaltung (Reservierungen, Abholliste, Produkte, Einstellungen, Benutzer)
- `config.js` – Supabase-URL + öffentlicher Schlüssel (Schutz über Row Level Security)
- `nachtrag-loeschen.sql` – SQL-Nachtrag

Jeder Push auf `main` wird von GitHub Pages automatisch veröffentlicht.
