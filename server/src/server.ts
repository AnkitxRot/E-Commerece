import { app } from './app.js';
import { env } from './config/env.js';
import { assertServerBootDatabaseIsolation, readDevDatabaseUrl } from './config/dbSafety.js';

assertServerBootDatabaseIsolation(env.NODE_ENV, env.DATABASE_URL, readDevDatabaseUrl());

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
