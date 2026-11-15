/**
 * VaaniReel — Turso/SQLite Schema Setup
 * Run once: node --env-file=.env scripts/setup-sqlite.mjs
 *
 * Creates two tables:
 *   vaanireel_sessions  — stores photo_file_id per chat while waiting for voice note
 *   vaanireel_posts     — permanent log of every generated post with image, audio, costs
 */

const DB_URL = "https://voxdesk-yash-bharvada.aws-ap-northeast-1.turso.io";
const DB_TOKEN = process.env.TURSO_DB_TOKEN; // add to .env

if (!DB_TOKEN) {
  console.error("❌ TURSO_DB_TOKEN not set in .env");
  process.exit(1);
}

async function runSQL(sql) {
  const resp = await fetch(`${DB_URL}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [{ type: "execute", stmt: { sql } }, { type: "close" }],
    }),
  });
  const data = await resp.json();
  if (data.results?.[0]?.type === "error") {
    throw new Error(data.results[0].error.message);
  }
  return data;
}

const schemas = [
  // Session table: holds photo file_id between messages
  `CREATE TABLE IF NOT EXISTS vaanireel_sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id     TEXT NOT NULL UNIQUE,
    photo_file_id TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  )`,

  // Posts table: permanent log of every generated post
  `CREATE TABLE IF NOT EXISTS vaanireel_posts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id         TEXT NOT NULL,
    language        TEXT,
    offer           TEXT,
    caption         TEXT,
    hashtags        TEXT,       -- JSON array stored as text
    image_url       TEXT,       -- Wiro generated image URL
    audio_url       TEXT,       -- Wiro ElevenLabs voice URL
    video_url       TEXT,       -- Wiro video URL
    qa_score        REAL,
    image_cost      REAL,
    voice_cost      REAL,
    video_cost      REAL,
    total_cost_usd  REAL,
    instagram_url   TEXT,
    status          TEXT DEFAULT 'pending',   -- pending | approved | rejected | published
    created_at      TEXT DEFAULT (datetime('now'))
  )`,

  // Index for fast session lookup
  `CREATE INDEX IF NOT EXISTS idx_sessions_chat_id ON vaanireel_sessions(chat_id)`,
  `CREATE INDEX IF NOT EXISTS idx_posts_chat_id ON vaanireel_posts(chat_id)`,
];

console.log("🔧 Setting up VaaniReel SQLite schema on Turso...");
for (const sql of schemas) {
  const name = sql.trim().split("\n")[0].substring(0, 60);
  try {
    await runSQL(sql);
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}\n     ${err.message}`);
  }
}
console.log("\n✅ Schema ready! Tables: vaanireel_sessions, vaanireel_posts");
console.log(`   DB: ${DB_URL}`);
