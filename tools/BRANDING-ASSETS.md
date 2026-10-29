# Exportmallarnas logotyper

## LTH-mall

`dist/assets/branding-lth.png` är hela bildobjektet `Im1.jpg` från sidan 1 i användarens referens-PDF `Studieplanering_JC_2026-10-28.pdf`. Bildobjektet extraherades lokalt med pypdf och sparades i PNG-format utan beskärning eller förändrad grafik. Originalets pixelmått är 203 × 111. Den låga upplösningen kommer från referensfilen.

## LU-mall

`dist/assets/branding-lu.png` är den oförändrade svenska svarta huvudlogotypen `LU-logotyp-tryck-digitalt/PNG_for_digital_anvandning/Svenska/Lunds_universitet_C2r_SVART.png` ur universitetets offentliga logotyppaket:

https://www.medarbetarwebben.lu.se/sites/medarbetarwebben.lu.se/files/lu-logotyp-tryck-digitalt.zip

Källsida: https://www.medarbetarwebben.lu.se/node/110

Hämtad 2026-10-28. Originalets pixelmått är 714 × 860. Bilden har transparent bakgrund. `branding-lu-proof.png` visar samma logotyp mot vit bakgrund enbart för visuell kontroll. Ingen egen logotyp har konstruerats.

## Inbäddning

`dist/branding-assets.js` exponerar `window.STUDIE_BRANDING` med fälten `lth` och `lu`. Varje fält innehåller `dataUrl`, `width`, `height` och `source`. Exportmallar ska behålla bildens proportioner och placera den på vit eller enkel bakgrund.

Logotypernas grafiska element är universitetets material. Källsidan anger bland annat att godkända logotyper inte ska modifieras och att friyta ska lämnas runt dem. Användning i en lokalt anpassad dokumentmall är inte en verifiering av att mallen är universitetets officiella dokumentmall.
