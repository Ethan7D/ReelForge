-- ===========================================================================
-- ReelForge — MySQL 生产环境 Schema
-- 用法:
--   mysql -u root -p reelforge < sql/mysql_schema.sql
-- 说明: 本演示站默认使用内置 SQLite（node:sqlite）。如需在生产环境使用
--       MySQL，请创建此库，并将 server.js 中的数据库层切换为 mysql2 驱动，
--       连接串通过环境变量 REELFORGE_MYSQL 注入（见 README）。
-- ===========================================================================

CREATE DATABASE IF NOT EXISTS reelforge
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE reelforge;

CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(191) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'member',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_email (email)
) ENGINE=InnoDB;

CREATE TABLE sessions (
  token      VARCHAR(64) PRIMARY KEY,
  user_id    INT NOT NULL,
  expires_at DATETIME NOT NULL,
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE projects (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  title       VARCHAR(200) NOT NULL,
  type        VARCHAR(20)  NOT NULL DEFAULT 'short_video',
  status      VARCHAR(20)  NOT NULL DEFAULT 'draft',
  prompt      TEXT,
  description TEXT,
  meta        JSON,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_projects_user (user_id),
  CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE contacts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  email      VARCHAR(191) NOT NULL,
  company    VARCHAR(191),
  message    TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE subscribers (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sub_email (email)
) ENGINE=InnoDB;

CREATE TABLE features (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(200) NOT NULL,
  summary    TEXT NOT NULL,
  icon       VARCHAR(40) NOT NULL DEFAULT 'spark',
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE use_cases (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE metrics (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  label      VARCHAR(120) NOT NULL,
  value      VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE docs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  category    VARCHAR(40) NOT NULL DEFAULT 'guide',
  body        MEDIUMTEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;
