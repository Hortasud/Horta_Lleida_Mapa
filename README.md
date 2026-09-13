# Mapa de l'Horta de Lleida

Aplicació web instal·lable (PWA) que integra el mapa de l'Horta i la guia d'ús.

## Publicar-la a GitHub Pages

1. Crea un repositori a GitHub i puja tots els fitxers i carpetes d'aquest directori, mantenint l'estructura.
2. A **Settings > Pages**, selecciona `Deploy from a branch`.
3. Selecciona la branca `main` i la carpeta `/ (root)` i desa.
4. Obre l'adreça que GitHub Pages mostrarà. Amb Chrome o Edge es podrà instal·lar com una aplicació.

## Funcions que conserva

- Cerca d'adreces, partides i camins.
- Geolocalització amb indicació de la precisió aproximada.
- Notes vinculades a punts del mapa, amb text lliure i fotografies de càmera o galeria.
- Capes topogràfica, ortofoto, ortofoto amb noms i OpenStreetMap.
- Consulta de camins i generació d'escrits en PDF o DOCX.
- Preparació de missatges de WhatsApp per a incidències de camins i robatoris en torres.
- Marcatge lliure i formulari d'abocaments amb indicis identificatius, amb alternativa a Appunta.
- Desament local compartit de les dades de l'associació i dels contactes entre formularis.
- Guia d'ús integrada.

## Notes importants

- La guia, les dades i el codi de l'aplicació es poden obrir sense connexió després de la primera visita.
- Les capes de fons ICGC i OpenStreetMap necessiten connexió; les tessel·les no es descarreguen ni es redistribueixen amb aquest projecte.
- La geolocalització necessita que la pàgina publicada s'obri amb HTTPS i que l'usuari concedeixi permís d'ubicació.
- Les notes i les fotografies es desen al navegador del dispositiu mitjançant IndexedDB. No se sincronitzen entre dispositius i s'eliminen si s'esborren les dades del lloc.
- La versió lliurada deixa buits els contactes inicials de WhatsApp. Cada dispositiu o associació els configura una vegada i queden desats localment fins que es modifiquen.
- Els abocaments sense documents o indicis que permetin identificar-ne els autors s'han de comunicar amb l'aplicació municipal Appunta, no amb el formulari de la patrulla.
- Abans de fer públic el repositori, revisa que no hi hagi dades personals o de contacte que no vulguis exposar.
- Quan canviïs fitxers importants, incrementa `CACHE_NAME` a `sw.js` perquè els navegadors renovin la memòria cau.
