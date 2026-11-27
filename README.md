# LUMEN Marketing

Public promotional assets for LUMEN: https://lumen.nopuna.fr/

## Lumen Video Studio

### Source saisonnière native (#1056 / #1057 / #1064)

Le catalogue appartient au dépôt LUMEN : `src/campaign/seasonal-events.js`.
Aucune règle de dates, nom d'événement, hashtag ou campagne n'est recopiée ici.
Utiliser une copie **propre** de la version LUMEN qui contient ce module,
épinglée dans `studio/source.json`, ou `--game CHEMIN --sha SHA_COMPLET`.
Le Studio utilise automatiquement la date native de Paris. L'option
`--date AAAA-MM-JJ` permet de prévisualiser un habillage. Il importe la
présentation à cette date et applique ses textes et couleurs
aux panneaux du montage. Les captures de campagne gardent la mention de
démonstration : elles ne simulent pas une tentative officielle du défi futur.
Une source historique sans configuration native est refusée explicitement,
plutôt que de créer un calendrier de substitution dans ce dépôt.

Pour les publications du vrai défi, déléguer entièrement au générateur natif :

```sh
node studio/export-posts.mjs --game CHEMIN --sha SHA_COMPLET --from 2026-12-01 --to 2026-12-31 --output decembre.csv
node studio/seasonal-tests.mjs CHEMIN
```

Les grilles initiales, aperçus Open Graph, liens datés, hashtags, UTM et CSV
viennent de LUMEN. Ce wrapper ne publie rien et ne touche pas Metricool.
Valider le brouillon et les doublons avant import sur le compte de Rachel,
en préservant les 15 publications éditoriales de 18h30 et celles déjà programmées.

Avec une source LUMEN qui contient l’aperçu natif dans `/studio/`, ajouter
`--seasonal-preview --date 2026-12-01` pour enregistrer de vrais gestes sur
la grille d’initiation et la célébration de l’Avent. L’aperçu de démonstration
ne prend jamais une future grille officielle. Les JPEG officiels datés sont
préparés à part, depuis le calendrier privé de LUMEN, pour un ajout depuis
l’appareil dans Metricool après validation.

Le studio capture les écrans et les animations du jeu dans Chromium et produit un MP4 vertical. Sa source par défaut est le jeu web `1.11.1+811` au [commit `63afd2c6`](https://github.com/Anuponk/project-menlu/commit/63afd2c6b445ab4d5918636c2cf6665b423cc6c8), avec la configuration saisonnière native. Les MP4 du lot initial gardent leur provenance historique `581cc6d2` ; ce changement ne les régénère pas. Suivi [#1046](https://github.com/Anuponk/project-menlu/issues/1046).

### Installation et rendu

Installer Git, Node.js 22 ou ultérieur avec npm, Chrome ou Chromium, FFmpeg récent avec `libx264` et FFprobe. Le montage a été validé avec FFmpeg et FFprobe 9.1. Pour l’option musique, FFmpeg doit aussi proposer l’encodeur AAC. `npm ci` installe la version verrouillée de Playwright Core, qui utilise le navigateur local.

Depuis le dépôt marketing :

```sh
git clone https://github.com/Anuponk/project-menlu.git ../lumen-video-game-reference
git -C ../lumen-video-game-reference checkout --detach 63afd2c6b445ab4d5918636c2cf6665b423cc6c8
npm ci
npm run video:generate -- --lang fr --scenario gameplay --duration 24
npm run video:generate -- --lang en --scenario gameplay --duration 24
npm run video:generate -- --lang es --scenario gameplay --duration 24
```

Chaque commande crée `output/lumen-gameplay-trailer-<lang>.mp4` et son rapport JSON. `--game` ou `LUMEN_GAME_ROOT` indique une autre copie propre, et `--sha` autorise explicitement un autre commit. Les variables `CHROME_PATH`, `FFMPEG` et `FFPROBE`, ou les options correspondantes, acceptent les chemins des exécutables.

| Option | Valeurs et usage |
| --- | --- |
| `--lang` | `fr`, `en` ou `es`. Langue de l’interface et du montage. |
| `--quest` | Identifiant stable ou numéro, p. ex. `base-q006` ou `6`. |
| `--size`, `--constellation`, `--difficulty` | Taille, identifiant de constellation et difficulté. `easy`, `medium`, `hard` et `expert` sont aussi reconnus. |
| `--scenario` | `gameplay` montre trois placements. `last-guardian` laisse un temps de réflexion avant le dernier placement. |
| `--duration`, `--speed` | Durée de 20 à 25 secondes entières, 24 par défaut. Vitesse de 0,7 à 1,25 avec un point décimal, 1 par défaut. |
| `--copy` | Fichier JSON facultatif avec les champs `hook`, `constellations`, `free`, `play`, `url`. |
| `--no-finger` | Désactive le doigt animé. |
| `--seasonal-preview` | Capture le véritable écran saisonnier en mode démonstration. |
| `--music` | Piste locale dont vous détenez les droits nécessaires. Encodage AAC avec fondus. |
| `--output` | Chemin du MP4 à produire. |
| `--keep-capture` | Conserve le dossier temporaire avec les images et `capture.json`. |

La sélection couvre les quêtes du catalogue à grille historique, après les deux quêtes d’apprentissage. `--help` liste les options.

### De la grille au MP4

1. `studio/game.mjs` sert les fichiers nécessaires sur le réseau de bouclage, sélectionne la quête et compare la solution unique du solveur à celle du catalogue.
2. `studio/capture.mjs` utilise un profil jetable, le mode de test existant et une progression synthétique pour débloquer la quête. Les requêtes externes sont bloquées. De vrais appuis tactiles préparent puis terminent la grille. La capture enregistre leurs positions et horaires, vérifie chaque changement de case et attend la vraie révélation céleste.
3. `studio/scenarios.mjs` définit le rythme, le nombre de placements visibles et les textes. Un scénario nécessitant un autre écran peut ajouter sa propre capture et réutiliser le montage.
4. `studio/montage.mjs` recadre la capture, anime le doigt et compose les textes avec l’icône officielle. FFmpeg encode le MP4. FFprobe vérifie durée, codec, résolution, cadence et audio.

Les fichiers de sortie, les captures brutes et les dépendances restent locaux. Voir [les sources et licences](assets/LICENSES.md).
