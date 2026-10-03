# Repos — Plateforme de réservation day-use au Gabon

Réservation d'hôtels en journée : motels, hôtels, maisons meublées et auberges,
avec géolocalisation « Autour de moi » et espaces Client / Tenancier / Admin.

## Structure

- `index.html` — site complet (export de la démo)
- `supabase/schema.sql` — schéma PostgreSQL à exécuter dans l'éditeur SQL Supabase

## Base de données (Supabase)

1. Créer un projet sur [supabase.com](https://supabase.com) (offre gratuite)
2. Dans le dashboard : **SQL Editor** → coller le contenu de `supabase/schema.sql` → exécuter
3. Récupérer **Project URL** et **anon public key** (Settings → API)
4. Les renseigner dans le fichier de config du site (`js/config.js`)

## Déploiement (Vercel)

Le projet est un site statique : déploiement direct depuis le dépôt GitHub,
sans étape de build.
