CREATE TABLE `auth_tokens` (
  `signature` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `value` varchar(1024) COLLATE utf8mb4_general_ci NOT NULL,
  `user_id` bigint DEFAULT NULL,
  `expiring_ts` bigint NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`signature`),
  KEY `auth_tokens_ibfk_1` (`user_id`),
  CONSTRAINT `auth_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `operators` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `firstname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `lastname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `email` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `username` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `password` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `deleted_at` datetime DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `operators_auth_tokens` (
  `signature` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `value` varchar(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `operator_id` bigint DEFAULT NULL,
  `expiring_ts` bigint NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`signature`),
  KEY `operators_auth_tokens_ibfk_1` (`operator_id`),
  CONSTRAINT `operators_auth_tokens_ibfk_1` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `steamleaks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `priority` tinyint DEFAULT '0',
  `tag` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `unit` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '',
  `business_team` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `location` varchar(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `component_equipment` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `size` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `operator` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `inspection_date` datetime NOT NULL,
  `pressure` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `plume_length` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '',
  `plume_spec` varchar(255) COLLATE utf8mb4_general_ci DEFAULT '0',
  `scaffolding` varchar(128) COLLATE utf8mb4_general_ci DEFAULT '""',
  `interception_possibility` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `interception_valve_status` tinyint DEFAULT NULL,
  `competence` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT '',
  `need_for_insulation` int DEFAULT NULL,
  `asbestos` tinyint DEFAULT NULL,
  `notification` int DEFAULT NULL,
  `img_url` varchar(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `status` tinyint DEFAULT NULL,
  `closure_notification` varchar(1024) COLLATE utf8mb4_general_ci DEFAULT '0',
  `after_img_url` varchar(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `repair_date` datetime DEFAULT NULL,
  `intervention_type` int DEFAULT '0',
  `intervention_description` varchar(2048) COLLATE utf8mb4_general_ci DEFAULT '',
  `post_date` varchar(2048) COLLATE utf8mb4_general_ci DEFAULT '',
  `reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT '',
  `steam_flow_kg` double DEFAULT '0',
  `steam_flow_tonne` double DEFAULT '0',
  `trait_length` varchar(255) COLLATE utf8mb4_general_ci DEFAULT '',
  `metal_sheet` varchar(255) COLLATE utf8mb4_general_ci DEFAULT '',
  `metal_sheet_temperature` varchar(255) COLLATE utf8mb4_general_ci DEFAULT '0',
  `insulation_material` varchar(255) COLLATE utf8mb4_general_ci DEFAULT '',
  `pipe_temperature` varchar(255) COLLATE utf8mb4_general_ci DEFAULT '0',
  `nominal_flow` varchar(255) COLLATE utf8mb4_general_ci DEFAULT '',
  `dn_discharger` varchar(255) COLLATE utf8mb4_general_ci DEFAULT '',
  `malfunctioning_type` varchar(255) COLLATE utf8mb4_general_ci DEFAULT '',
  `discharger_type` varchar(255) COLLATE utf8mb4_general_ci DEFAULT '',
  `service` varchar(1024) COLLATE utf8mb4_general_ci DEFAULT '',
  `steam_discharge_to_closed_system` int DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_deleted` tinyint DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1054 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `email` varchar(128) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `password` varchar(128) COLLATE utf8mb4_general_ci NOT NULL DEFAULT '',
  `role` varchar(32) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'viewer',
  `lang` varchar(3) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'eng',
  `deleted_at` datetime DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;