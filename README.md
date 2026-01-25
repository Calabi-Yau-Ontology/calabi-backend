# Calabi Backend

Main API Server for a Calabi project that turns user events into structured knowledge. It manages users, categories, and events, then enriches event text through an ML NER service to drive consistency suggestions and a Neo4j-based ontology graph. The system also uses Redis caching and emits event stream messages for downstream processing.

## Project Structure

```
calabi-backend/
├── src
│   ├── app.module.ts
│   ├── main.ts
│   ├── auth
│   ├── categories
│   ├── common
│   ├── config
│   ├── database
│   ├── events
│   ├── health
│   ├── neo4j
│   ├── ontology
│   ├── redis
│   ├── suggestions
│   ├── users
│   └── wikidata
├── test
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
├── package.json
└── tsconfig.json
```

## Key Responsibilities

- User authentication and profile handling
- Category and event CRUD for calendar data
- NER-powered consistency suggestions with Redis cache
- Ontology graph modeling in Neo4j with Wikidata expansion
- Event stream publishing for real-time consumers
