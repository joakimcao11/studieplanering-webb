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

## En arbetsyta

Startsidan öppnar aktivt ärende direkt eller visar ett inbäddat startformulär. Katalogen använder samma periodordning på dator och i mobilens kursdialog. Ett valt LoT-erbjudande kan sparas med ett valfritt `offeringId` som kontrolleras mot källdatan vid läsning. Lagringsnyckeln och schema 4 behålls och äldre poster utan erbjudande-ID kan öppnas som tidigare.

| Tidigare kontroll | Placering nu |
| --- | --- |
| Ärenden, planering, katalog och hjälp | Flikarna **Mötesanteckning**, **Studieplanering** och **Kalender** delar det aktiva ärendet. Ärenden öppnas via **Öppna sparat**. Kursvalet ligger intill planen och hjälp finns under **Mer**. |
| Terminer och kalender | Höst och vår visas samtidigt i planeringen. **Kalender** har vyer för kalenderår, läsår, höst och vår. **Kurslista och belastning** öppnas från sammanställningen. |
| `data-picker-*`, filter och lägg till | Samma sökfält och kurslista på dator och i mobilens dialog. En periodknapp begränsar kursvalet till den perioden. Kursnamnet visar källdetaljer. |
| `data-edit`, datum, studietakt och periodpoäng | **Ändra** via kurskortet öppnar den befintliga placeringsdialogen. Drag och släpp är kvar som genväg. |
| `data-task-*` | Omtentamina, kompletteringar och uppföljning öppnas under planen. Dubbla knappar för att lägga till omtentamen i olika rutor är borttagna. |
| `data-action`: scenarier och läsår | Nytt alternativ och planval är synliga. Namnbyte, radering, jämförelse och läsårstillägg finns under **Mer för planen**. |
| `data-action`: säkerhetskopia, import, hjälp och rensning | **Mer** och dialogen **Öppna sparat**. Export av Word/PDF finns intill sammanställningen. |

Formgivningen följer personalpilotens marinblå sidhuvud, flikrad, kort och ljusa arbetsyta. Inter levereras lokalt med [SIL Open Font License](dist/vendor/Inter-OFL.txt). Layouten använder det befintliga lokala ärendeformatet och samma beräkningar som dokumentexporten.
