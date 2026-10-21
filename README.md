# Robot 3D · Dal disegno al videogioco

Un disegno a mano diventa un videogioco 3D: il robot del foglio è ricostruito con
**geometria 100% procedurale** (Three.js), poi dotato di controller, animazioni e regia
cinematografica.

- **Live:** https://robot3d.giacomel.info (Cloudflare Pages) — mirror: https://albertogiacomel.github.io/robot3d/ (GitHub Pages)
- **Repository:** https://github.com/albertogiacomel/robot3d
- **Sito:** https://www.giacomel.info/

## Dal foglio al videogioco

| # | Passaggio | Cosa c'è dentro |
| --- | --- | --- |
| 01 | Il disegno | Testa a televisore, antenne a sfera, braccia a V con pinze a “C”, torso blu con quadrante rosso e pannello a 4 pulsanti, cosce lavanda, tibie a bande. Ogni elemento diventa una specifica di costruzione. |
| 02 | La geometria | 66 mesh generate a runtime: `RoundedBoxGeometry` per cranio e arti, cilindri per giunti, sfere per occhi e ginocchi, `TorusGeometry` ad arco per la pinza, `ExtrudeGeometry` per il profilo del torso. Contorni neri con una seconda passata `side: BackSide`. |
| 03 | Il rig | Gerarchia `robot → body → chest → arti`, pivot a busto/gomito/ginocchio, IK analitica a due ossa per le braccia, 10 stati animati. |
| 04 | Il videogioco | Controller unico (tastiera, touch, gamepad), macchina a stati a passo fisso, scatola da trasportare, camera che segue il robot e inquadrature guidate in modalità Cinema. |

## Comandi

| Tasto | Azione |
| --- | --- |
| `W A S D` / frecce | Cammina |
| `Shift` | Corri |
| `L` | Ride (i denti si deformano sullo "schermo" della bocca) |
| `Spazio` | Saluta |
| `G` | Prende o posa la scatola |
| `R` | Reset della scena |

Dettagli in `robot-actions.js`: passo fisso 60 Hz con catch-up limitato, input azzerato su
blur/tab nascosta, confini di gioco e camera verificati insieme, audio sbloccato solo dopo un
gesto utente.

## Avvio rapido

```bash
npm install          # solo puppeteer-core (per i test), il sito non ha dipendenze runtime
python -m http.server 8123
# http://127.0.0.1:8123/index.html
```

> I moduli ES richiedono HTTP: `file://` non funziona.

La libreria è vendorizzata in `vendor/three/` (three r160 + `OrbitControls`,
`RoundedBoxGeometry`, `EffectComposer`, `SSAOPass`, `RoomEnvironment`): **nessuna richiesta
di rete a runtime**, il sito funziona offline.

## Deploy

```bash
npm run build     # assembla dist/
npm run deploy    # wrangler pages deploy (richiede CLOUDFLARE_API_TOKEN)
```

- **Cloudflare Pages** — progetto `robot3d` (account `291702df5c8eef8684918f4f92ca4c4d`),
  dominio `robot3d.giacomel.info` (CNAME creato da Cloudflare).
- **GitHub Pages** — workflow `.github/workflows/pages.yml`, mirror di fallback.
- **CI** — `.github/workflows/ci.yml`: verify → build → deploy Cloudflare (salta se il
  secret `CLOUDFLARE_API_TOKEN` non è impostato nel repository) → smoke test sul dominio.

> Per il deploy in CI serve un token API Cloudflare (Account → Cloudflare Pages → Edit,
> Zone → DNS → Edit su `giacomel.info`) memorizzato come secret del repository.

## Struttura

```
Robot3D/
├── index.html            # shell, hero, sezione "storia", comandi, footer
├── site.css              # design system allineato ai token di giacomel.info
├── site.js               # tema chiaro/scuro + bilingue IT/EN
├── robot.js              # scena, costruzione procedurale, luci, ombre, camera director
├── robot-actions.js      # input, macchina a stati, IK, audio
├── wrangler.toml         # progetto Cloudflare Pages (output dist/)
├── scripts/              # build-site, verify-actions, capture-*
├── assets/               # immagine originale + schermate della storia + font
├── vendor/three/         # three r160 vendorizzato
└── .github/workflows/    # CI (verify + deploy) e GitHub Pages
```

## Resa 3D

- **Ombre:** una sola sorgente (key light) con frustum stretto che segue il robot: ombre
  definite e coerenti in tutta l'area di gioco.
- **Occlusioni:** **N8AO** (`n8ao` 2.0.1 vendorizzato) calcola l'occlusione ambientale in un
  solo passaggio con denoise bilaterale: qualità migliore e **-49% di draw call** rispetto a
  `SSAOPass` (271 draw call / 142k tri vs 535 / 285k).
- **Materiali:** PBR con env map `RoomEnvironment` a intensità controllata per materiale.
- **Temi:** chiaro e scuro, con la scena 3D che segue il tema (fondo, pavimento, luci).

## Verifica

```bash
npm run verify      # test end-to-end headless (Edge): 14 controlli
npm run capture     # rigenera le schermate della sezione "storia"
```

Output in `artifacts/verify/` (report JSON + schermate).

## Licenza

MIT — vedi [LICENSE](LICENSE).
