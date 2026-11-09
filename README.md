# Studieplanering LTH

En lokal arbetsyta för studie- och karriärvägledare och annan LTH-personal. Planera per läsår och läsperiod, följ upp kvarstående examinationer och jämför alternativa upplägg inom samma ärende.

[Öppna webbappen](https://joakimcao11.github.io/studieplanering-webb/) · [Användarguide](ANVANDNING.md) · [Katalog och källkontroll](tools/CATALOG.md)

Ärendena finns i den aktuella webbläsarprofilen. Använd JSON-export och import för att flytta dem. Studentens namn kan anges tillfälligt i exportdialogen för Word eller PDF. Kombinationer av uppgifter och fritext kan identifiera en person. Håll anteckningarna korta och avidentifierade.

## Utveckling och publicering

`dist/` är arbetskällan. `docs/` är GitHub Pages-kopian. Node 24 används för skripten.

```text
npm start
npm run check
npm test
npm run build
npm run pages
```

`npm run build` skapar en fristående HTML-fil. GitHub Pages publicerar `docs/` från `main`. Uppdatera kurskatalogen enligt [källdokumentationen](tools/CATALOG.md).

## Datamodell och beräkning

- `dist/cases.js` validerar arbetsytan och JSON-backuper. Schema 4 ligger kvar i lagringsnyckeln `studieplan-v3` så att rensning och uppgradering använder samma sparplats. Vid läsning av schema 3 skapas ett scenario per ärende. Datumkurser får egen placering, kurs- och källdata behålls och den äldre ärendeanteckningen blir en planeringsöverenskommelse. Äldre alternativ som sparades som separata ärenden behålls som separata ärenden eftersom deras ursprung inte kan fastställas säkert.
- Ett ärende har scenarier med egna läsår, omtentamina, kompletteringar, periodanteckningar, agenda, överenskommelser och uppföljning. Kursraderna har `caseId` och `scenarioId`. Referenser valideras vid sparning och import. Kopiering och import ger nya ID:n och flyttar om referenser inom samma scenario.
- LoT:s `catalogYear`, programkoppling, `periods` och `timePlans` hålls skilda från `plannedYear`, `plannedPeriods`, egna datum och manuell poängfördelning. `dist/lth-calendar.js` beskriver kalendern 2026/27 och undantagen. Planer för andra läsår kan skapas utan att appen anger officiella datum.
- `dist/planning.js` har samma sammanställning för vyer, jämförelse och export. En kurs räknas en gång i läsårstotalen. En enperiodskurs tilldelas sin planerade period. För flerperiodskurser används bara en uttrycklig manuell fördelning när perioderna delas upp. Terminstotalen tar med fulla kurser inom terminen och kända andelar för kurser över terminsgränsen. Delpoäng visas där de kan hänföras till rätt omfattning. Examinationer lägger aldrig till HP. Studietakt kan anges per kurs och per period. Om endast kursens studie­veckor anges uppskattas takten med 1,5 hp per vecka.
- `dist/planning-export.js` bygger dokumentets innehåll från vald omfattning. PDF, dess förhandsgranskning och Word delar samma avsnitt, tabeller och summeringar. Studentnamn lever i exportdialogens minne och inkluderas bara i det dokument som skapas. JSON innehåller ärenden och kurser. Mallval sparas separat från ärendedata och dokumentets fritextfält förblir tillfälliga.

## Gränser

Katalogen visar kursutbudet för 2026/27. Planen behöver följas upp mot utbildningsplan för aktuell antagningskull, Ladok, studiemedel och TimeEdit. Appen utför ingen automatisk kontroll av de uppgifterna. Webbläsarens lokala lagring kan försvinna vid rensning och synkas inte.
