-- ══════════════════════════════════════════════════════════════════
--  Schéma d'une boutique — MySQL / MariaDB (hébergement Hostinger)
--
--  À exécuter UNE FOIS par nouvelle boutique. Remplacer {{prefix}}
--  par la valeur de `PREFIX` dans config/store.config.ts.
--  (Le script scripts/create-store.mjs le fait automatiquement.)
--
--  ⚠️ La base est PARTAGÉE entre les boutiques d'un même hébergement :
--  seul le préfixe les sépare. Jamais de `drop`/`truncate` sans filtre
--  de préfixe — on effacerait le catalogue d'une autre boutique.
--
--  ⚠️ `key` est un MOT RÉSERVÉ de MySQL. Toute requête écrite à la main
--  doit l'entourer d'accents graves (`key`), sinon l'erreur renvoyée
--  parle de syntaxe et ne nomme jamais la colonne fautive.
-- ══════════════════════════════════════════════════════════════════

-- Stockage clé→valeur : catalogue, commandes, clients, passerelles,
-- pixels, brouillons de paiement, verrous d'idempotence.
--
-- ⚠️ `value` est du LONGTEXT, pas du JSON. MariaDB expose bien un type
-- JSON, mais ce n'est qu'un alias de LONGTEXT avec une contrainte de
-- validité : les fonctions JSON diffèrent entre MySQL et MariaDB, et
-- l'application sérialise déjà elle-même. Le texte est le seul terrain
-- commun aux deux moteurs.
create table if not exists `{{prefix}}_kv` (
  `key`        varchar(191) not null primary key,
  `value`      longtext     not null,
  `updated_at` datetime(3)  not null default current_timestamp(3)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- Journal des visites (une ligne par vue ou événement).
create table if not exists `{{prefix}}_visits` (
  `id`       bigint unsigned not null auto_increment primary key,
  `ts`       datetime(3)  not null default current_timestamp(3),
  `path`     varchar(512),
  `referrer` varchar(255),
  `visitor`  varchar(64),
  `type`     varchar(32)  not null default 'view',
  `ip`       varchar(45),
  `city`     varchar(120),
  index `visits_ts_idx` (`ts`),
  index `visits_visitor_idx` (`visitor`),
  index `visits_type_ts_idx` (`type`, `ts`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- Visiteurs uniques (agrégat mis à jour à chaque visite).
create table if not exists `{{prefix}}_visitors` (
  `id`         varchar(64) not null primary key,
  `first_seen` datetime(3) not null default current_timestamp(3),
  `last_seen`  datetime(3) not null default current_timestamp(3),
  `count`      int         not null default 1,
  `last_path`  varchar(512),
  `ip`         varchar(45),
  `city`       varchar(120),
  -- Origine du PREMIER contact (pinterest, snapchat, google, ia, direct…).
  -- Jamais réécrite ensuite : c'est ce qui a fait venir la cliente.
  `source`     varchar(64),
  index `visitors_last_seen_idx` (`last_seen`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- Présence « en direct » du back-office.
--
-- ⚠️ Remplace le temps réel de Supabase, qui n'existe pas ici : le
-- navigateur de la visiteuse écrit un battement toutes les 15 s, le
-- tableau de bord relit cette table toutes les 8 s. Une ligne dont le
-- `since` a plus de 50 s (trois battements manqués) désigne quelqu'un
-- qui est parti — c'est la lecture qui l'écarte, pas une suppression.
create table if not exists `{{prefix}}_presence` (
  `id`     varchar(64) not null primary key,
  `path`   varchar(512),
  `count`  int not null default 1,
  `ip`     varchar(45),
  `city`   varchar(120),
  `source` varchar(64),
  `since`  datetime(3) not null default current_timestamp(3),
  index `presence_since_idx` (`since`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
