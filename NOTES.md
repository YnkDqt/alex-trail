# Alex — Notes de développement

## Architecture

- **Stack** : React 18 / Vite / Recharts / Zero CSS framework
- **Fichier principal** : `src/App.jsx` (~5100 lignes, single-file intentionnel)
- **Déploiement** : Vercel via GitHub (auto-deploy)

---

## Branches & environnements

| Branche | URL | Usage |
|---------|-----|-------|
| `main` | https://alex-trail.vercel.app | **Production** — stable, partagé aux utilisateurs |
| `dev` | URL preview Vercel (voir Deployments) | **Dev/Test** — toutes les nouvelles features |

### Workflow quotidien

```bash
# Toujours travailler sur dev
git checkout dev

# Développer, commiter
git add . && git commit -m "description" && git push
# → Vercel déploie automatiquement sur l'URL dev

# Quand c'est validé et stable → passer en prod
git checkout main
git merge dev
git push
git checkout dev  # revenir sur dev immédiatement
```

### Règle d'or
**Ne jamais commiter directement sur `main`.** Toujours passer par `dev` + merge.

---

## Sessions de développement avec Claude

### Contexte chargé automatiquement
Les mémoires Claude contiennent le contexte du projet (stack, features, décisions).

### Pattern de travail
1. Claude lit toujours le code existant avant de modifier (`view` tool)
2. Modifications ciblées `str_replace` — jamais de réécriture complète sauf >5 zones
3. Livraison via `present_files` + commande git à copier-coller

### Fichier de travail
Claude travaille sur `/home/claude/App.jsx` (copie locale), livre dans `/mnt/user-data/outputs/App.jsx`.

---

## Priorités roadmap (ordre)

1. **Refactoring multi-fichiers** — App.jsx > 5000 lignes, séparer en composants
2. **Mode Simple / Expert** — double interface, toggle en haut à droite
3. **Auto-complétion nutrition** — algorithme d'optimisation en 4 étapes
4. **Export Garmin FIT Premium** — feature payante (placeholder existant)
5. **Internationalisation FR/EN/ES** — quand le produit est stabilisé

---

## Décisions techniques importantes

### Élévation GPX
- XML namespace sur sous-éléments casse `querySelectorAll` → solution en place
- Smoothing w=5 moving average validé sur 10 courses iconiques — **ne pas toucher**
- APIs cascade : `elevation.racemap.com` (primary) → `open-elevation.com` (fallback)

### Nutrition
- Formule Minetti et al. (2002) — *Journal of Applied Physiology*
- `assistancePresente` sur les ravitos = source de vérité unique (dans modal Profil de course)
- Poids nutrition = seulement ce qui est planifié au **départ** (pas aux ravitos)

### Calculs vitesse
- `garminCoeff` depuis Activities.csv calibre les vitesses auto
- GAP normalisé via Minetti pour comparaison allure dans Analyse

---

## Structure EMPTY_SETTINGS (clés importantes)

```js
{
  weight, kcalPerKm, kcalPerKmUphill,   // nutrition
  raceName, startTime, raceDate,          // course
  tempC, rain, wind, snow,               // météo (heat supprimé → tempC > 25)
  garminCoeff, garminStats, kcalSource,  // calibration
  glucidesTargetGh,                       // nutrition cible
  runnerLevel, effortTarget, paceStrategy, ravitoTimeMin,
  equipment,   // checklist avec { id, cat, label, checked, actif, emporte, poidsG }
  produits,    // bibliothèque nutrition
  prepChecks,  // checklist chronologique { "id": bool }
}
```
