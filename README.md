# Mapa de l'Horta de Lleida

Aplicació web instal·lable (PWA) que integra el mapa de l'Horta i la guia d'ús.

## Publicar-la a GitHub Pages

1. Crea un repositori a GitHub i puja tots els fitxers i carpetes d'aquest directori, mantenint l'estructura.
2. A **Settings > Pages**, selecciona `Deploy from a branch`.
3. Selecciona la branca `main` i la carpeta `/ (root)` i desa.
4. Obre l'adreça que GitHub Pages mostrarà. Amb Chrome o Edge es podrà instal·lar com una aplicació.

## Funcions que conserva

- Cerca d'adreces, partides i camins.
- Capes topogràfica, ortofoto, ortofoto amb noms i OpenStreetMap.
- Consulta de camins i generació d'escrits en PDF o DOCX.
- Preparació de missatges de WhatsApp.
- Desament local de les dades del formulari.
- Guia d'ús integrada.

## Notes importants

- La guia, les dades i el codi de l'aplicació es poden obrir sense connexió després de la primera visita.
- Les capes de fons ICGC i OpenStreetMap necessiten connexió; les tessel·les no es descarreguen ni es redistribueixen amb aquest projecte.
- La versió lliurada deixa buits els contactes inicials de WhatsApp. Cada dispositiu o associació els pot configurar localment des del formulari.
- Abans de fer públic el repositori, revisa que no hi hagi dades personals o de contacte que no vulguis exposar.
- Quan canviïs fitxers importants, incrementa `CACHE_NAME` a `sw.js` perquè els navegadors renovin la memòria cau.
