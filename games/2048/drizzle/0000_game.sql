CREATE TABLE IF NOT EXISTS users(
  code TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  salt TEXT NOT NULL, secret TEXT NOT NULL, best INTEGER NOT NULL DEFAULT 0,
  largest INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sessions(
  digest TEXT PRIMARY KEY, code TEXT NOT NULL REFERENCES users(code) ON DELETE CASCADE, expires INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS friends(
  a TEXT REFERENCES users(code) ON DELETE CASCADE, b TEXT REFERENCES users(code) ON DELETE CASCADE,
  sender TEXT NOT NULL REFERENCES users(code) ON DELETE CASCADE, accepted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(a,b)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS blocks(
  owner TEXT REFERENCES users(code) ON DELETE CASCADE, peer TEXT REFERENCES users(code) ON DELETE CASCADE,
  PRIMARY KEY(owner,peer)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT NOT NULL REFERENCES users(code) ON DELETE CASCADE,
  recipient TEXT NOT NULL REFERENCES users(code) ON DELETE CASCADE,
  body TEXT NOT NULL, created INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS message_pair ON messages(sender,recipient,id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS reports(
  reporter TEXT NOT NULL, message INTEGER NOT NULL, sender TEXT NOT NULL, body TEXT NOT NULL,
  created INTEGER NOT NULL, UNIQUE(reporter,message)
);
