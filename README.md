# Robot 3D (Three.js)

Ricostruzione tridimensionale del robot del **disegno a mano** fornito in input.
Il modello è **100% procedurale**: nessuna mesh importata, nessuna texture, nessun file binario
oltre alla libreria Three.js vendorizzata. Ogni elemento del disegno (testa a televisore,
antenne a sfera, pinze a "C", quadrante rosso, pannello a 4 pulsanti, cosce lavanda, tibie
a bande) è ricostruito con primitive Three.js.

## Avvio rapido

```bash
cd C:\Users\albyw\source\Robot3D
python -m http.server 8123
# apri http://127.0.0.1:8123/index.html
```

> È indispensabile servire via HTTP: i moduli ES non si caricano da `file://`.

Alternativa senza server: `npx serve .` oppure `npx http-server -p 8123`.

La libreria è già vendorizzata in `vendor/three/` (three r160 + `OrbitControls` +
`RoundedBoxGeometry`), quindi la pagina funziona **anche offline**. Per aggiornare:

```bash
npm i three@0.160.0
# copiare build/three.module.js e examples/jsm/{controls,geometries} in vendor/three/
```

## Comandi

| Comando | Effetto |
| --- | --- |
| Trascina mouse | orbita camera |
| Rotella | zoom (6–34 unità) |
| `Rotazione` | rotazione automatica on/off |
| `Contorni` | silhouette nera in stile "disegno a mano" |
| `Flat shading` | shading sfaccettato |
| `Vista` | frontale / 3-4 / laterale / posteriore / primo piano |
| `Reimposta` | torna alla vista frontale con rotazione attiva |

Parametri URL: `?view=hero` (front, hero, side, back, closeup) e `?still=1` (blocca la rotazione).

## Mappa disegno → 3D

| Elemento del disegno | Implementazione Three.js |
| --- | --- |
| Testa a televisore | `RoundedBoxGeometry` grigia + maschera frontale scura |
| Occhi neri ovali | `SphereGeometry` scalata su Z + riflesso bianco |
| Bocca sorridente | Rounded box bianca + 4 separatori neri (5 denti) |
| Auricolari | Cilindri su asse X + disco esterno |
| Cupola e antenne | Semisfera + cilindri inclinati con sfera nera in testa |
| Torso a trapezio | `ExtrudeGeometry` su profilo 2D con bevel |
| Quadrante rosso | Cilindro + `TorusGeometry` corona + lancetta |
| Pannello 4 pulsanti | Rounded box grigia + 4 cilindri rossi |
| Braccia a V | Gruppi pivotati alla spalla (52°/128°), bande colorate |
| Pinza "C" | `TorusGeometry` ad arco + disco bianco centrale + blocchetti bianchi |
| Cosce lavanda | Rounded box su gamba con giunto d'anca cilindrico |
| Ginocchia arancioni | Sfera scalata su Y |
| Tibie a bande | 4 Rounded box colorate (blu / giallo / arancione) |
| Piedi | Rounded box azzurra + suola arancione |

## Struttura del progetto

```
Robot3D/
├── index.html          # shell, HUD, importmap verso vendor/three
├── robot.js            # scena, costruzione procedurale, animazione, UI
├── package.json        # type: module, script npm
├── vendor/three/       # three r160 vendorizzato (offline)
├── artifacts/          # screenshot di verifica
└── README.md
```

## Note tecniche

- **Contorni**: seconda passata di mesh con `side: BackSide` scalate di `1 + 0.11 / maxDim`,
  così lo spessore del bordo resta costante (~0.05 unità mondo) su ogni pezzo.
- **Animazione idle**: respiro (scala Y), dondolio della testa, vibrazione delle antenne,
  oscillazione simmetrica delle braccia, rotazione lenta delle pinze.
- **Materiali**: `MeshStandardMaterial` condivisi via cache per colore/roughtness/metallic.
- **Luci**: hemisphere + key direzionale con ombre PCF soft (2048²) + fill + rim.

## Verifica

Render di riferimento in `artifacts/`:

- `robot-front.png` — vista frontale
- `robot-side.png` — vista laterale
- `robot-closeup.png` — primo piano testa

Controllo automatico (Puppeteer + Edge headless): nessun errore JS in console,
canvas `1280x900`, statistiche live mostrate nell'HUD.
