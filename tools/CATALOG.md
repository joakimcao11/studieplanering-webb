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

## Källkontroll för etapp 1

Snapshot hämtad 28 oktober 2026. Den har 61 programposter, varav 55 med kurser, 1 253 unika kurser och 4 098 unika kurskopplings-ID:n. Samtliga kursplaner hämtades. 185 kurser saknar TimeEdit-länk, en saknar extraherat syfte och 438 kopplingar saknar LP-markeringar. Appen visar ett tomt källvärde som okänt eller hänvisar till kursplanen.

Den 9 november 2026 jämfördes årskurs, kurskategori, grupp och perioder för D, IDA och A med LTH:s API och de renderade LoT-tabellerna. Antal kurskopplingar var 240, 29 respektive 80. Källkoderna för kategori är `mandatory/O`, `elective_mandatory/A`, `elective/V` och `external_elective/E`. `exjobb` är källans grupp för examensarbete. Specialisering använder källans särskilda specialiseringskod och behåller också ordinarie valkategori. `fromYear` visas som från-årskurs. `timePlans` bevarar varje placering och de perioder där källan har en markering. En koppling kan ha mer än en placering. Fotnoter visas i tabell och detaljer.

Kalender och programundantag finns i `dist/lth-calendar.js`. [LTH:s beslut U 2025/443](https://www.lth.se/fileadmin/lth/anstallda/utbildningsadministration/lasarsindelning/LTH_laesaarsindelning_2026-27_beslut.pdf) styr vilka program som har terminstider utan LP-indelning. För dessa visas katalogplaceringen på terminsnivå och den råa LP-metadatan behålls i snapshoten. [Studentwebben](https://www.student.lth.se/mina-studier/schema-och-lasarsindelning) anger en höstterminsslutdag för nybörjare i Helsingborg som sammanfaller med vårterminens start. Appen visar källuppgiften tillsammans med en uppmaning att kontrollera med programmet. För oklassificerade program visas källans årskurser och kategorier. Andra läsår kräver en separat verifierad kalenderpost.
