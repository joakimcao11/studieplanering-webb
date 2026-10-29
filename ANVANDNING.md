# Studieplanering

Uppdaterad 28 oktober 2026. Lokal vägledarvy för studieplanering med officiell LTH-katalog för 2026/2027.

Öppna `Studieplanering.html` i webbläsaren. Kurskatalog, dokumentbibliotek och PDF-typsnitt finns i samma fil. Internet behövs bara för externa länkar och valfria webbtypsnitt. Projektet kan också startas med `npm start` på http://127.0.0.1:4185.

## Planering

- Kalenderår januari–december, läsår augusti–juli, höst augusti–december och vår januari–juni. Juni och juli markeras som sommar. Detta är månadsvyer, inte officiella terminsdatum.
- Dra en kurs till önskad månad. Start och slut flyttas lika många månader, med datum anpassade till kortare månader. Flytten kan ångras.
- Klicka på kursen för att redigera, välja ny startmånad, ändra status eller ta bort den ur planen. Klickflytt fungerar även utan dragning.
- Tidslinje och kurslista visar samma kurser. På smal skärm blir kurslistan kort för att undvika horisontell rullning.
- Skapa alternativ kopierar studentens plan. Originalet finns kvar och kurser kan ändras oberoende i de två planerna.

## LTH-katalog

61 programposter, varav 55 har kursutbud 2026/2027. 1 253 unika kurser, 1 220 med källstatus active, och 4 098 program- och specialiseringskopplingar. Officiell kursinformation, syfte, innehåll, antagningsuppgifter, nivå, poäng och källänkar finns lokalt.

Sök på kurskod, namn, ämne eller ord i kursens syfte. Filtrera efter program, specialisering och nivå. Vilande och inaktiva erbjudanden döljs som standard. Programlistan behåller äldre program och kategorin Icke-programkopplade kurser.

Källa: https://kurser.lth.se/lot/programme?ay=26_27. Katalogen hämtades 2026-10-28. Den är en daterad kopia. Uppdateringsskript och källdokumentation finns i `tools/CATALOG.md`. Kör `npm run sync:catalog`, följt av `npm run build`, för att hämta och bygga om.

LTH:s läsperioder sparas som metadata men omvandlas inte till exakta datum. Datum i en studentplan är användarens planeringsdatum. Antagningsavsnittet kan innehålla både krav och rekommendationer; sidan bedömer inte behörighet. Länkar till officiell kursplan och, där underlaget har en sådan, TimeEdit finns i kursinformationen.

## Dokumentexport

Exportera öppnar val för Word `.docx`, PDF `.pdf` och JSON-säkerhetskopia. Word och PDF gäller vald student, för hela planen eller vald period. De innehåller kurser, poäng, status, planeringsdatum, anteckningar och källor. Dokumenten skapas lokalt i webbläsaren och hämtas som riktiga filer.

JSON innehåller alla studentplaner och kan importeras under Studenter. Importen lägger till planer med nya interna identiteter. Befintliga planer ersätts inte. Word och PDF kan inte återimporteras.

## Poäng och sparning

Varje kurs som överlappar vald period räknas en gång med hela kursens poäng. De proportioneras inte mellan månader och visar inte studietakt. Avklarad är en manuell markering. A-poäng räknas endast för kurser med känd A-nivå. Eget mål ändras i studentuppgifterna och är inte ett automatiskt examenskrav.

Planer sparas i webbläsarens localStorage. Den tidigare lagringsnyckeln behålls för befintliga planer. Den officiella katalogen lagras separat i projektfilerna och kopieras inte till localStorage. Lokala HTML-filer och webbserveradressen kan ha separata sparutrymmen. Exportera JSON för att föra över planer.

Ingen Ladokkoppling, inloggning eller gemensam databas finns. Sidan fattar inga beslut om behörighet, examenskrav eller specialisering.

## Verifiering

`npm run check` kontrollerar syntax. `npm test` kontrollerar kalendergränser, flytt över årsskifte, skottår, poäng, import och katalogens integritet. `npm run build` skapar den fristående HTML-filen.

Webbläsartest har genomförts för sökning, kursinformation, tillägg, kursflytt med dragning, ångra, klickflytt, kurslista, sparning och dokumenthämtning. Wordfiler har lästs med en DOCX-läsare och innehållet har verifierats. PDF har renderats och visuellt granskats. Den automatiska DOCX-renderaren saknar LibreOffice på denna dator; visuell granskning i Microsoft Word kunde inte slutföras när appåtkomsten löpte ut.

`dist/app-v2.js` är aktuell applikation. `dist/app.js` är bevarad källkod från version 1. Bibliotek och licensuppgifter finns under `dist/vendor`.

## Uppdatering 29 oktober 2026

Studenter kan nu redigeras och tas bort från studentlistan. Borttagna studenter kan återställas med kurser och anteckningar, eller raderas permanent efter en tydlig bekräftelse i sidan. Tom studentlista stöds och bevaras vid omladdning. JSON-säkerhetskopior innehåller aktiva planer och exportinställningar, inte borttagna planer.

Exportdialogen har LTH-, LU- och anpassad mall, uppladdning av egen PNG/JPG-logotyp, dokumentnamn, datum, rubrik, handläggare, organisation och kontaktuppgifter. Man kan välja omfattning, stående/liggande A4, innehåll och tabellkolumner. Förhandsgranskning och PDF skapas med samma sidlayout; Word använder motsvarande dokumentformat och kan radbryta annorlunda. Exportinställningar sparas lokalt. Förinställda kontaktuppgifter kommer från användarens underlag.

Studietakt kan anges manuellt eller uppskattas från HP och planeringsdatum. Formeln bygger på LU:s information om 1,5 hp per heltidsvecka: https://www.lu.se/node/35041. Deltid ändrar inte kursens högskolepoäng. Delvis avklarade poäng och återstående veckor visas under Studietakt och återstående poäng. Ingen bedömning av CSN, behörighet eller examen görs.

Referenssidan studieplanering.lovable.app/svl krävde fortfarande inloggning i den tillgängliga webbläsaren. Bilder, referens-PDF och publikt tillgänglig klientkod har granskats. Ingen privat studentinformation eller autentiserad serverdata har hämtats. Källforskningen finns under qa/reference-research; logotypkällor dokumenteras i tools/BRANDING-ASSETS.md.

Verifiering: 18 automatiska tester samt webbläsartest av redigering, borttagning, återställning, tom lista, delpoäng och dokumentexport. Alla tre PDF-mallar har renderats och granskats. Wordfiler har skapats och lästs strukturellt; visuell Wordgranskning återstår eftersom den tillgängliga automatiska renderaren saknar LibreOffice. Ett niodsidigt test verifierar sidbrytning och upprepade tabellrubriker.

