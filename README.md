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

## Tester les comptes avec des bots

`node test/bots.js` lance une copie privée du site sur une base jetable, y fait jouer 60 bots, tire les super cagnottes et vérifie que chaque crédit est compté.

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
