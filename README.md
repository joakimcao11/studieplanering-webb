# Studieplanering LTH

En lokal arbetsyta för studie- och karriärvägledare och annan LTH-personal. Skapa namnfria ärenden, jämför alternativ och använd LTH:s daterade kursutbud som planeringsunderlag.

[Öppna webbappen](https://joakimcao11.github.io/studieplanering-webb/)

Ärendena finns i den aktuella webbläsarprofilen. De kan flyttas med JSON-export och import. Studentens namn kan anges tillfälligt i exportdialogen för Word eller PDF. Kombinationer av uppgifter och fritext kan identifiera en person. Håll därför anteckningar korta och avidentifierade.

[Kort användarguide](ANVANDNING.md) · [Katalog och källkontroll](tools/CATALOG.md)

## Utveckling

`dist/` är arbetskällan och `docs/` är GitHub Pages-kopian. Node 24 används för skripten.

```text
npm start
npm run check
npm test
npm run pages
npm run build
```

`npm run build` skapar en fristående HTML-fil. `npm run pages` kopierar de statiska filerna till `docs/`. GitHub Pages publicerar från `main:/docs`.

## Överlämning från etapp 1

- `dist/cases.js` läser och validerar schema 3. Nyckeln är `studieplan-v3`. En arbetsyta innehåller `cases`, `courses`, `activeCaseId` och mallpreferenser. JSON-backupen innehåller bara version, ärenden och kurser inom vald omfattning.
- Ett ärende har ett lokalt slump-ID, tidsstämplar, programkod, antagningsår, årskurs, planeringsläsår, mål, avidentifierad anteckning och en markering för alternativ. En kurs tillhör ett ärende via `caseId`. En kurs från katalogen har kurskod, källäsår, programkoppling, `periods` och `timePlans` skilda från egna datum.
- Äldre `studieplan-v1` med schema 1/2 lämnas kvar tills användaren väljer. Migrationen väljer planer, skapar nya ID:n och utesluter namn och äldre anteckningar. Egna kurser får en neutral titel för eftergranskning.
- `case-view.js`, `catalog-view.js`, `program-catalog.js`, `lth-calendar.js` och `case-workspace.css` innehåller ärendevy, programkatalog, kalender och layout. Det befintliga planeringsflödet använder fortfarande egna datum och den gamla dokumentmallen via en tillfällig adapter.
- Nästa etapp kan bygga vidare på `officialCalendar` och kursernas källplacering för planering per LP, omtentamen, kompletteringar och uppdaterade dokument.
