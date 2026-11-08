# Jackpool

Version de test de Jackpool : six jeux de hasard en cagnotte commune, joués avec des crédits virtuels sans valeur réelle.

## Ce que contient ce dossier

- `server.js` : le serveur. Il lance une partie par minute à chaque table, enregistre les mises, paie les gagnants et organise les tirages des super cagnottes à 12 h et 21 h (heure de Paris).
- `db.js` : l'accès à la base de données (PostgreSQL en ligne, SQLite en local).
- `public/` : les pages du site (accueil et six jeux).
- `src/` et `build.py` : les morceaux qui servent à fabriquer les pages de `public/`.

## Réglages (variables d'environnement)

- `DATABASE_URL` : l'adresse de la base PostgreSQL (Neon). Sans elle, le serveur utilise un fichier SQLite local.
- `PORT` : fourni automatiquement par l'hébergeur.
- `BOTS_PER_TABLE` : nombre de bots qui jouent à chaque table (par exemple `10`, maximum 20). Sans cette variable, aucun bot ne joue. Les bots portent un prénom en B suivi de « btz » et d'un numéro (ex. « Bruno btz1 »), un badge 🤖 les signale aux joueurs, et ils jouent uniquement avec des crédits virtuels. Ce pseudo est réservé : un vrai joueur ne peut pas le prendre. **À laisser éteint pour toute version avec argent réel.**

## Niveaux, quêtes et collection de dés

Réglés dans `progress.js`. Les bots n'y participent pas.

- **Expérience** : +10 XP par partie jouée (quelle que soit la mise), +5 XP par ticket de super cagnotte, +50 XP par quête terminée. Chaque niveau rapporte 10 cr, et 50 cr tous les 5 niveaux. Titres : Débutant, Amateur (niv. 3), Habitué (5), Confirmé (10), Expert (15), Maître (20), Légende (30).
- **Quêtes du jour** : 3 par joueur et par jour (une générale, une sur un jeu précis, une « défi »), renouvelées à minuit (heure de Paris). Récompenses de 3 à 10 cr.
- **Dés** : Ivoire (offert), Ébène (niveau 3 ou 50 cr), Rubis (niveau 5 ou 150 cr), Émeraude (5 quêtes ou 150 cr), Or (niveau 10 ou 500 cr), Diamant (25 quêtes, ne s'achète pas). Le dé choisi roule à la table du Dé. Les achats apparaissent sur la page Banque (« boutique »).

## Tester les comptes avec des bots

`node test/bots.js` lance une copie privée du site sur une base jetable, y fait jouer 60 bots, tire les super cagnottes et vérifie que chaque crédit est compté, ainsi que l'expérience, les quêtes et les récompenses de niveau.

## Règles importantes

- Le **premier compte créé** devient administrateur : il peut lancer un tirage de super cagnotte à tout moment pour faire une démonstration.
- Chaque nouveau compte reçoit 100 crédits. Sous 1 crédit, un bouton « Recharger » remet le solde à 100.
- Interdit aux moins de 18 ans. Version de test uniquement : aucun argent réel.

## Lancer en local

Il faut Node.js 22.5 ou plus récent.

```
npm install
npm start
```

Puis ouvrir http://localhost:3000.
