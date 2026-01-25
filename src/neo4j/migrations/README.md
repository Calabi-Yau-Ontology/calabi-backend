# Neo4j one-time migrations

This folder contains manual, one-time Cypher scripts intended to be run in Neo4j Browser or `cypher-shell`.

## Run

1. Open Neo4j Browser (e.g. `http://localhost:7474`) or use `cypher-shell`.
2. Copy/paste the `.cypher` file contents and execute top-to-bottom.
3. If the script includes a "pre-check" query, review results before applying writes.

