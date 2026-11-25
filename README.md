# LUMEN Marketing

Public promotional assets for LUMEN: https://lumen.nopuna.fr/

## Lumen Video Studio

Le studio capture les écrans et les animations du jeu dans Chromium et produit un MP4 vertical. Il utilise le jeu web `1.11.1+798` au [commit `581cc6d2`](https://github.com/Anuponk/project-menlu/commit/581cc6d298315c281596fb1c72002cfb88d5bf8f). Suivi [#1046](https://github.com/Anuponk/project-menlu/issues/1046).

### Installation et rendu

Installer Git, Node.js 22 ou ultérieur avec npm, Chrome ou Chromium, FFmpeg récent avec `libx264` et FFprobe. Le montage a été validé avec FFmpeg et FFprobe 9.1. Pour l’option musique, FFmpeg doit aussi proposer l’encodeur AAC. `npm ci` installe la version verrouillée de Playwright Core, qui utilise le navigateur local.

Depuis le dépôt marketing :

```sh
git clone https://github.com/Anuponk/project-menlu.git ../lumen-video-game-reference
git -C ../lumen-video-game-reference checkout --detach 581cc6d298315c281596fb1c72002cfb88d5bf8f
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
| `--scenario` | `gameplay` montre trois placements. `last-guardian` laisse un temps de réflexion avant le dernier placement. `rules` enseigne les règles et gestes en français. |
| `--duration`, `--speed` | Durée de 20 à 25 secondes pour les bandes-annonces, 24 par défaut, et de 45 à 60 secondes pour `rules`, 50 par défaut. Vitesse de 0,7 à 1,25 avec un point décimal, 1 par défaut. |
| `--copy` | Fichier JSON facultatif avec les champs `hook`, `constellations`, `free`, `play`, `url`. |
| `--no-finger` | Désactive le doigt animé. |
| `--music` | Piste locale dont vous détenez les droits nécessaires. Encodage AAC avec fondus. |
| `--output` | Chemin du MP4 à produire. |
| `--keep-capture` | Conserve le dossier temporaire avec les images et `capture.json`. |

La sélection couvre les quêtes du catalogue à grille historique, après les deux quêtes d’apprentissage. `--help` liste les options.

### Vidéo pédagogique « Comment jouer à Lumen ? »

Le scénario `rules` montre en français les règles d’une grille facile 6 × 6. Il suit le moteur et le tutoriel du jeu pour expliquer le Gardien, le territoire, les trois contraintes d’unicité et le voisinage diagonal. Dans l’interface, de vrais appuis marquent une case, annulent le dernier geste, placent les Gardiens et déclenchent la victoire. Les surlignages de montage sont alignés sur les cases et commandes capturées.

```sh
git clone https://github.com/Anuponk/project-menlu.git ../lumen-video-rules-reference
git -C ../lumen-video-rules-reference checkout --detach b8cdf08dda798bfb5fdc7e16c0f0a6f84c89fe2b
npm run video:generate -- --lang fr --scenario rules
```

Le résultat est `output/lumen-comment-jouer-fr.mp4`, avec un rapport JSON des appuis et du contrôle FFprobe. La durée par défaut est de 50 secondes, avec une plage de 45 à 60 secondes. La quête standard est `base-q006`. Une autre quête facile 6 × 6 est utilisable si sa topologie permet les démonstrations. Le jeu web de référence est `1.11.1+799`, [commit `b8cdf08`](https://github.com/Anuponk/project-menlu/commit/b8cdf08dda798bfb5fdc7e16c0f0a6f84c89fe2b). Les scénarios promotionnels conservent leur source et leurs propres options de durée.

La séparation par difficulté concerne la taille, la logique de résolution et l’assistance guidée. Les quatre règles de placement sont communes. Sources [règles officielles](https://lumen.nopuna.fr/comment-jouer.html), [spécification de gameplay](https://github.com/Anuponk/project-menlu/blob/b8cdf08dda798bfb5fdc7e16c0f0a6f84c89fe2b/docs/GAMEPLAY.md) et [moteur de validation](https://github.com/Anuponk/project-menlu/blob/b8cdf08dda798bfb5fdc7e16c0f0a6f84c89fe2b/src/game/engine.js).

### De la grille au MP4

1. `studio/game.mjs` sert les fichiers nécessaires sur le réseau de bouclage, sélectionne la quête et compare la solution unique du solveur à celle du catalogue.
2. `studio/capture.mjs` utilise un profil jetable, le mode de test existant et une progression synthétique pour débloquer la quête. Les requêtes externes sont bloquées. De vrais appuis tactiles préparent puis terminent la grille. La capture enregistre leurs positions et horaires, vérifie chaque changement de case et attend la vraie révélation céleste.
3. `studio/scenarios.mjs` définit le rythme, le nombre de placements visibles et les textes. Un scénario nécessitant un autre écran peut ajouter sa propre capture et réutiliser le montage.
4. `studio/montage.mjs` recadre la capture, anime le doigt et compose les textes avec l’icône officielle. FFmpeg encode le MP4. FFprobe vérifie durée, codec, résolution, cadence et audio.

Les fichiers de sortie, les captures brutes et les dépendances restent locaux. Voir [les sources et licences](assets/LICENSES.md).
