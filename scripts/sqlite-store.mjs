#!/usr/bin/env node

/**
 * VaaniReel — Local SQLite Database Store
 * Uses native Node.js SQLite (node:sqlite) — zero external npm dependencies required!
 * 
 * Tables:
 *   - vaanireel_sessions : Stores Telegram chat session (photo_file_id while waiting for voice)
 *   - vaanireel_posts    : Stores full campaign data (image, video, voice, prompts, costs, base64 blobs)
 */

import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/vaanireel.db");

// Ensure data folder exists
const dataDir = dirname(DB_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

export function getDB() {
  const db = new DatabaseSync(DB_PATH);
  
  // Enable WAL mode for performance & safety
  db.exec("PRAGMA journal_mode = WAL;");
  
  // Initialize Schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS vaanireel_sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id       TEXT NOT NULL UNIQUE,
      photo_file_id TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vaanireel_posts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id         TEXT NOT NULL,
      language        TEXT,
      offer           TEXT,
      caption         TEXT,
      hashtags        TEXT,          -- JSON string of hashtag array
      image_url       TEXT,          -- Wiro Seedream 5.5 generated URL
      audio_url       TEXT,          -- Wiro ElevenLabs voiceover URL
      video_url       TEXT,          -- Wiro Wan 2.6 reel video URL
      image_blob      BLOB,          -- Raw binary / base64 image data stored in SQLite
      audio_blob      BLOB,          -- Raw binary audio stored in SQLite
      image_cost      REAL DEFAULT 0,
      video_cost      REAL DEFAULT 0,
      voice_cost      REAL DEFAULT 0,
      total_cost_usd  REAL DEFAULT 0,
      status          TEXT DEFAULT 'completed',
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_chat ON vaanireel_sessions(chat_id);
    CREATE INDEX IF NOT EXISTS idx_posts_chat ON vaanireel_posts(chat_id);
  `);
  
  return db;
}

/**
 * Save or update Telegram session
 */
export function saveSession(chatId, photoFileId) {
  const db = getDB();
  const stmt = db.prepare(`
    INSERT INTO vaanireel_sessions (chat_id, photo_file_id, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(chat_id) DO UPDATE SET
      photo_file_id = excluded.photo_file_id,
      updated_at = datetime('now')
  `);
  stmt.run(String(chatId), String(photoFileId));
  db.close();
}

/**
 * Get active session for a chat
 */
export function getSession(chatId) {
  const db = getDB();
  const stmt = db.prepare("SELECT * FROM vaanireel_sessions WHERE chat_id = ?");
  const row = stmt.get(String(chatId));
  db.close();
  return row;
}

/**
 * Save complete post to SQLite (optionally downloads and stores image binary blob)
 */
export async function savePost(post) {
  const db = getDB();
  
  let imageBlob = null;
  if (post.image_url && post.saveBlob) {
    try {
      const resp = await fetch(post.image_url);
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        imageBlob = Buffer.from(arrayBuf);
      }
    } catch (e) {
      console.warn("Could not download image blob for local SQLite storage:", e.message);
    }
  }

  const stmt = db.prepare(`
    INSERT INTO vaanireel_posts (
      chat_id, language, offer, caption, hashtags,
      image_url, audio_url, video_url, image_blob,
      image_cost, video_cost, voice_cost, total_cost_usd, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    String(post.chat_id || ""),
    String(post.language || "en"),
    String(post.offer || ""),
    String(post.caption || ""),
    Array.isArray(post.hashtags) ? JSON.stringify(post.hashtags) : String(post.hashtags || "[]"),
    String(post.image_url || ""),
    String(post.audio_url || ""),
    String(post.video_url || ""),
    imageBlob,
    Number(post.image_cost || 0),
    Number(post.video_cost || 0),
    Number(post.voice_cost || 0),
    Number(post.total_cost_usd || 0),
    String(post.status || "completed")
  );

  db.close();
}

/**
 * List all saved posts
 */
export function listPosts() {
  const db = getDB();
  const stmt = db.prepare(`
    SELECT id, chat_id, language, offer, caption, image_url, audio_url, video_url,
           LENGTH(image_blob) AS image_bytes, total_cost_usd, status, created_at
    FROM vaanireel_posts
    ORDER BY id DESC
  `);
  const rows = stmt.all();
  db.close();
  return rows;
}

/**
 * Get summary stats
 */
export function getStats() {
  const db = getDB();
  const stats = db.prepare(`
    SELECT 
      COUNT(*) AS total_posts,
      ROUND(SUM(total_cost_usd), 4) AS total_spend_usd,
      COUNT(image_blob) AS stored_images_count,
      COUNT(DISTINCT chat_id) AS unique_merchants
    FROM vaanireel_posts
  `).get();
  db.close();
  return stats;
}

// CLI handler if invoked directly
if (process.argv[1] && process.argv[1].endsWith("sqlite-store.mjs")) {
  const cmd = process.argv[2] || "list";

  if (cmd === "init") {
    const db = getDB();
    console.log(`✓ SQLite database initialized at: ${DB_PATH}`);
    db.close();
  } else if (cmd === "list") {
    const posts = listPosts();
    console.log(`\n📦 Stored Posts in SQLite (${posts.length} records):`);
    console.table(posts.map(p => ({
      ID: p.id,
      Chat: p.chat_id,
      Lang: p.language,
      Offer: (p.offer || "").substring(0, 25),
      Cost: `$${p.total_cost_usd}`,
      Image: p.image_url ? "✓ " + p.image_url.substring(0, 35) + "..." : "none",
      BlobSize: p.image_bytes ? `${Math.round(p.image_bytes / 1024)} KB` : "0 KB",
      Created: p.created_at
    })));
  } else if (cmd === "stats") {
    const stats = getStats();
    console.log("\n📊 SQLite Database Stats:");
    console.log(`  Total Campaigns Generated : ${stats.total_posts || 0}`);
    console.log(`  Total Spend Billed (USD)  : $${stats.total_spend_usd || 0}`);
    console.log(`  Binary Images in SQLite   : ${stats.stored_images_count || 0}`);
    console.log(`  Active Unique Merchants   : ${stats.unique_merchants || 0}`);
    console.log(`  DB Location               : ${DB_PATH}\n`);
  } else if (cmd === "seed-sample") {
    // Seed with the successful test run from earlier ($0.4777)
    await savePost({
      chat_id: "1435371214",
      language: "ta",
      offer: "Deepavali Kanchipuram Silk Saree Special Flat 20% Off",
      caption: "✨ தீபாவளி சிறப்பு சேலைகள்! பாரம்பரிய காஞ்சிபுரம் பட்டு சேலைகள் இப்போது 20% தள்ளுபடியில். நேரடி கடையில் வந்து பாருங்கள்!",
      hashtags: ["#DiwaliSale", "#KanchipuramSilk", "#ChennaiShopping", "#VaaniReel"],
      image_url: "https://api.wiro.ai/outputs/sample-saree-staged.jpg",
      video_url: "https://api.wiro.ai/outputs/sample-saree-reel.mp4",
      audio_url: "https://api.wiro.ai/outputs/sample-tamil-voice.mp3",
      image_cost: 0.0280,
      video_cost: 0.4397,
      voice_cost: 0.0100,
      total_cost_usd: 0.4777,
      status: "completed",
      saveBlob: false
    });
    console.log("✓ Seeded sample post record from the live $0.4777 campaign run!");
  } else {
    console.log("Usage: node scripts/sqlite-store.mjs [init | list | stats | seed-sample]");
  }
}
