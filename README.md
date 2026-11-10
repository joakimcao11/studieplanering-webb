# Studieplanering LTH

En lokal arbetsyta för studie- och karriärvägledare och annan LTH-personal. Planera per läsperiod, termin eller läsår, följ upp kvarstående examinationer och skapa en mål- och handlingsplan i samma ärende.

[Öppna webbappen](https://joakimcao11.github.io/studieplanering-webb/) · [Användarguide](ANVANDNING.md) · [Katalog och källkontroll](tools/CATALOG.md)

Ärendena finns i den aktuella webbläsarprofilen. Använd JSON-export och import för att flytta dem. Studentens namn kan anges tillfälligt i arbetsytan och användas i Word eller PDF. Kombinationer av uppgifter och fritext kan identifiera en person. Håll anteckningarna korta och avidentifierade.

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
- LoT:s `catalogYear`, programkoppling, `periods` och `timePlans` hålls skilda från `plannedYear`, `plannedPeriods`, egna datum och manuell poängfördelning. `dist/lth-calendar.js` beskriver de verifierade kalendrarna för 2026/27 och 2027/28 samt deras undantag. Planer för andra läsår kan skapas utan att appen anger officiella datum.
- `dist/planning.js` har samma sammanställning för vyer, jämförelse och export. En kurs räknas en gång i läsårstotalen. En enperiodskurs tilldelas sin planerade period. För flerperiodskurser används bara en uttrycklig manuell fördelning när perioderna delas upp. Terminstotalen tar med fulla kurser inom terminen och kända andelar för kurser över terminsgränsen. Delpoäng visas där de kan hänföras till rätt omfattning. Examinationer lägger aldrig till HP. Studietakt kan anges per kurs och per period. Om endast kursens studie­veckor anges uppskattas takten med 1,5 hp per vecka.
- `dist/planning-export.js` bygger dokumentets innehåll från vald omfattning. PDF, dess förhandsgranskning och Word delar samma avsnitt, tabeller och summeringar. Studentnamn lever i sessionens arbetsminne och kan inkluderas i det dokument som skapas. JSON innehåller ärenden och kurser. Mallval sparas separat från ärendedata och dokumentets fritextfält förblir tillfälliga.

## Gränser

Katalogen visar kursutbudet för 2026/27. Planen behöver följas upp mot utbildningsplan för aktuell antagningskull, Ladok, studiemedel och TimeEdit. Appen utför ingen automatisk kontroll av de uppgifterna. Webbläsarens lokala lagring kan försvinna vid rensning och synkas inte.

## En arbetsyta

**Kurser och studietakt** och **Mål och handlingsplan** arbetar i samma ärende. Kurser, mål, moment och anteckningar sparas per scenario. Nya ärenden använder verifierade undervisningsperioder för att välja tidsram. Vyn sparas i samma schema och lagringsnyckel. Äldre scenarier utan en sparad vy öppnas i sitt tidigare läsår.

Läsperiod, termin och läsår visar 15, 30 respektive 60 hp som neutrala heltidsriktmärken. Kurslista, kalender och alternativ finns under **Visa detaljer**. Dokumentexporten kan innehålla vald tidsram, handlingsplanen eller båda.

Regressionsprovet i Chrome körs efter `npm run pages` med `node tools/test-workspace-browser.mjs`. Det använder en lokal statisk server, fiktiva ärenden och Playwright med Chromium. Sätt `PLAYWRIGHT_MODULE` för en befintlig installation, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` för en Chrome-binär eller `STUDIEPLAN_QA_DIR` för att spara testdokument och skärmbilder.
