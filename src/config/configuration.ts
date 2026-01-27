export default () => ({
  // IMPORTANT: Any hard-coded defaults here should be safe for production.
  // Avoid enabling network-heavy optional features by default.
  port: parseInt(process.env.PORT ?? '4000', 10),
  database: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    username: process.env.POSTGRES_USER ?? 'calabi',
    password: process.env.POSTGRES_PASSWORD ?? 'password',
    name: process.env.POSTGRES_DB ?? 'calabi_db',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  neo4j: {
    uri: process.env.APP_NEO4J_URI ?? 'bolt://localhost:7687',
    // auth: process.env.NEO4J_AUTH ?? 'neo4j/password',
    user: process.env.NEO4J_AUTH?.split('/')[0] ?? 'neo4j',
    password: process.env.NEO4J_AUTH?.split('/')[1] ?? 'password',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? '',
  },
  ml: {
    baseUrl: process.env.ML_BASE_URL ?? 'http://localhost:8000',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? undefined,
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'CALABI:',
  },
  ontology: {
    autoClassify: {
      enabled:
        String(
          process.env.ONTOLOGY_AUTO_CLASSIFY_ENABLED ?? 'true',
        ).toLowerCase() === 'true',
      minConfidence: Number(
        process.env.ONTOLOGY_AUTO_CLASSIFY_MIN_CONFIDENCE ?? '0.85',
      ),
    },
  },
  wikidata: {
    // Feature flag: keep Wikidata expansion code, but disable by default.
    // Set WIKIDATA_EXPANSION_ENABLED=true to re-enable.
    expansionEnabled:
      String(process.env.WIKIDATA_EXPANSION_ENABLED ?? 'false').toLowerCase() ===
      'true',
    sparqlEndpoint: process.env.WIKIDATA_SPARQL_ENDPOINT,
    searchEndpoint: process.env.WIKIDATA_SEARCH_ENDPOINT,
    language: process.env.WIKIDATA_LANGUAGE || 'ko,en',
    maxNeighbors: parseInt(process.env.WIKIDATA_MAX_NEIGHBORS ?? '200', 10),
  },
});
