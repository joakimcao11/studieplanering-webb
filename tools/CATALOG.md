# LTH-katalog 2026/2027

Officiell källa: https://kurser.lth.se/lot/programme?ay=26_27

Data hämtas från samma offentliga API som LoT använder. Ingen inloggning, Ladok- eller studentinformation hämtas.

## Uppdatera

Från projektmappen:

```powershell
node --use-system-ca tools/sync-lth-catalog.mjs
```

`--use-system-ca` behövs på denna Windows-installation för att Node ska använda datorns betrodda rotcertifikat. Certifikatverifieringen är aktiv.

- `--year=26_27` väljer läsår; standard är 26_27.
- `--refresh` hämtar också om redan cachelagrade kursplaner.
- `--offline` återskapar katalogen från tidigare hämtade filer i `data/`.
- `--skip-syllabi` hämtar enbart kurs- och programmetadata utan kursplanetext.

Program- och kurslistor hämtas alltid på nytt vid onlinekörning. Kursplaner cachelagras per läsår/kurskod. Hämtning av kursplaner begränsas till tre samtidiga anrop. En rapport med eventuella kursplanefel skrivs till `data/sync-report-26_27.json`.

## Utdata

- `dist/catalog.json`: läsbar JSON-katalog för integrationer.
- `dist/catalog-data.js`: samma katalog som `window.STUDIE_CATALOG`, kan läsas direkt från en lokal HTML-fil.
- `data/`: rådata och kursplanecache. Behöver inte publiceras med webbappen.

Kursinnehåll (`contents`), syfte (`purpose`) och antagningsuppgifter (`admission` och alias `prerequisites`) är text extraherad ur officiell svensk kursplan. Ingen AI-sammanfattning eller egen behörighetsbedömning läggs till. Antagningsuppgifter kan innehålla både förkunskapskrav, rekommenderade förkunskaper och platsbegränsning; de får därför inte presenteras som enbart obligatoriska krav.

`offerings` behåller programmets kod, årskurs, specialiseringskod och namn, obligatorisk/valfri status samt källans ursprungliga läsperioder. Kurser som återkommer i flera program eller specialiseringar lagras en gång per kurskod, med separata kopplingar.

## Begränsningar

- Program-API:t anger inte utbildningstyp; programmets `type` är därför `null`.
- Programlistan innehåller äldre program och kategorin ”Icke-programkopplade kurser”. Alla poster har inte kurser under 2026/2027.
- Kurser med status ”course_on_hold” eller ”exam_only” behålls för att information inte ska försvinna. Kontrollera både kursens `status` och kopplingens `status` innan kursen presenteras som ett aktivt erbjudande.
- Läsperioder är officiell metadata, men inga exakta kalenderdatum skapas från dem. Månad/datum i studieplanen är användarens egen planering.
- En katalogpost eller specialiseringskoppling innebär inte att en viss students behörighet eller examen har kontrollerats.
- Utbudet är en daterad kopia för ett läsår. Aktuella scheman, platsbegränsningar och ändringar kontrolleras via källänkarna.
