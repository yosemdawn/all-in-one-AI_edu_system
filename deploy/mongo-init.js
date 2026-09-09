// Runs only when initializing an empty volume. Existing databases need the documented migration.
const appDatabase = db.getSiblingDB('yosem_ai');
appDatabase.createUser({
  user: 'yosem',
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [{ role: 'readWrite', db: 'yosem_ai' }],
});
