const Database = require('better-sqlite3');
const { SERVICES, ENVIRONMENT_NAMES, DB_PATH } = require('../config');

// Initialize SQLite database
const db = new Database(DB_PATH);

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    environment TEXT NOT NULL,
    service_name TEXT NOT NULL,
    owner TEXT,
    task TEXT,
    start_time INTEGER,
    channel_id TEXT,
    PRIMARY KEY (environment, service_name)
  );

  CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    environment TEXT NOT NULL,
    service_name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    task TEXT NOT NULL,
    position INTEGER NOT NULL,
    FOREIGN KEY (environment, service_name) REFERENCES services(environment, service_name)
  );
`);

// Migration: Add channel_id column if it doesn't exist (for existing databases)
try {
  db.exec(`ALTER TABLE services ADD COLUMN channel_id TEXT`);
  console.log('✅ Added channel_id column to services table');
} catch (err) {
  // Column already exists or other error - that's okay
  if (!err.message.includes('duplicate column name')) {
    console.error('Migration warning:', err.message);
  }
}

// Prepared statements for database operations
const saveServiceStmt = db.prepare(`
  INSERT OR REPLACE INTO services (environment, service_name, owner, task, start_time, channel_id)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const loadServicesStmt = db.prepare(`
  SELECT * FROM services WHERE environment = ? AND service_name = ?
`);

const saveQueueItemStmt = db.prepare(`
  INSERT INTO queue (environment, service_name, user_id, task, position)
  VALUES (?, ?, ?, ?, ?)
`);

const clearQueueStmt = db.prepare(`
  DELETE FROM queue WHERE environment = ? AND service_name = ?
`);

const loadQueueStmt = db.prepare(`
  SELECT user_id, task FROM queue
  WHERE environment = ? AND service_name = ?
  ORDER BY position ASC
`);

// Helper function to save service state to database
function saveServiceToDB(envName, serviceName, service) {
  saveServiceStmt.run(
    envName,
    serviceName,
    service.owner,
    service.task,
    service.startTime,
    service.channelId || null
  );

  // Update queue
  clearQueueStmt.run(envName, serviceName);
  service.queue.forEach((queueItem, index) => {
    saveQueueItemStmt.run(
      envName,
      serviceName,
      queueItem.userId,
      queueItem.task,
      index
    );
  });
}

// Initialize environments with services (load from database)
function initializeEnvironments() {
  const envs = {};

  ENVIRONMENT_NAMES.forEach(envName => {
    envs[envName] = { services: {} };
    SERVICES.forEach(serviceName => {
      // Try to load from database
      const dbService = loadServicesStmt.get(envName, serviceName);
      const dbQueue = loadQueueStmt.all(envName, serviceName);

      envs[envName].services[serviceName] = {
        owner: dbService?.owner || null,
        task: dbService?.task || null,
        startTime: dbService?.start_time || null,
        channelId: dbService?.channel_id || null,
        lastReminderSent: null, // Not persisted - resets on restart
        queue: dbQueue.map(item => ({
          userId: item.user_id,
          task: item.task
        }))
      };
    });
  });

  console.log('📁 Loaded environment state from database');
  return envs;
}

module.exports = {
  db,
  saveServiceToDB,
  initializeEnvironments
};
