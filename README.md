# Studieplanering

Studieplanering för vägledare med kalenderår, läsår och terminer, LTH:s kurskatalog 2026/2027, studenthantering, dragning av kurser och Word- och PDF-export.

Webbplats: https://joakimcao11.github.io/studieplanering-webb/

## Användning

Studentplaner och exportinställningar sparas i den egna webbläsaren. Inga studentuppgifter skickas till GitHub eller lagras i detta repository. Webbplatsen har ingen inloggning eller gemensam databas.

För att föra över befintliga planer från den lokala HTML-filen: exportera en JSON-säkerhetskopia där och importera den under Studenter på webbplatsen. Olika webbadresser och webbläsare har separata sparutrymmen.

Kurskatalogen är en daterad kopia från LTH. Planeringsdatum är egna datum och är inte ett verifierat schema. Studietakt och poäng är stöd för planering, inte beslut om behörighet, examen eller studiemedel.

## Utveckling och publicering

Applikationens källfiler finns i `dist/`. `docs/` innehåller motsvarande statiska filer för GitHub Pages. Det behövs inga installerade paket för att köra eller testa sidan.

```text
npm start
npm run check
npm test
npm run pages
```

Efter ändringar i `dist/`: kör `npm run pages`, lägg till ändringarna i `dist/` och `docs/` och pusha till `main`. GitHub Pages publicerar från `main`, mappen `/docs`.

`npm run build` skapar en fristående HTML-fil för lokal användning. `npm run sync:catalog` hämtar en ny kopia av LTH-katalogen för det konfigurerade läsåret; kör därefter `npm run pages`.

Mer användardokumentation finns i [ANVANDNING.md](ANVANDNING.md). Bibliotek och licensuppgifter finns under `dist/vendor`, och logotypernas källor i `tools/BRANDING-ASSETS.md`.
