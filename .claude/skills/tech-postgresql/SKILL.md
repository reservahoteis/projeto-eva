---
name: tech-postgresql
description: Melhores praticas PostgreSQL - Indices, Queries, JSONB, Performance, Partitioning
version: 1.0.0
---

# PostgreSQL - Melhores Praticas

## Tipos de Dados

```sql
-- Texto
VARCHAR(255)     -- Texto variavel com limite
TEXT             -- Texto sem limite
CHAR(10)         -- Texto fixo

-- Numeros
INTEGER          -- -2B a 2B
BIGINT           -- Numeros grandes
SERIAL           -- Auto-incremento
BIGSERIAL        -- Auto-incremento grande
DECIMAL(10,2)    -- Precisao exata (dinheiro)
REAL             -- Ponto flutuante

-- Data/Hora
TIMESTAMP        -- Data e hora
TIMESTAMPTZ      -- Com timezone (preferir)
DATE             -- Apenas data
TIME             -- Apenas hora
INTERVAL         -- Duracao

-- Outros
BOOLEAN          -- true/false
UUID             -- Identificador unico
JSONB            -- JSON binario (preferir sobre JSON)
ARRAY            -- Arrays tipados
BYTEA            -- Dados binarios
```

---

## Criar Tabelas

```sql
-- Tabela com boas praticas
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'ATTENDANT',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT users_email_tenant_unique UNIQUE (tenant_id, email),
  CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'ATTENDANT', 'SALES'))
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## Indices

```sql
-- Indice simples
CREATE INDEX idx_users_tenant ON users(tenant_id);

-- Indice composto (ordem importa!)
CREATE INDEX idx_conversations_tenant_status
  ON conversations(tenant_id, status);

-- Indice parcial (filtra dados)
CREATE INDEX idx_conversations_open
  ON conversations(tenant_id)
  WHERE status = 'OPEN' AND deleted_at IS NULL;

-- Indice para busca textual
CREATE INDEX idx_messages_content_gin
  ON messages USING gin(to_tsvector('portuguese', content));

-- Indice JSONB
CREATE INDEX idx_users_metadata
  ON users USING gin(metadata);

-- Indice para expressao
CREATE INDEX idx_users_email_lower
  ON users(LOWER(email));

-- Ver indices de uma tabela
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users';
```

---

## JSONB

```sql
-- Inserir
INSERT INTO users (name, metadata)
VALUES ('Ana', '{"phone": "11999999999", "tags": ["vip", "recorrente"]}');

-- Consultar campo
SELECT metadata->>'phone' as phone FROM users;
SELECT metadata->'tags'->0 as first_tag FROM users;

-- Filtrar por campo JSONB
SELECT * FROM users
WHERE metadata->>'phone' = '11999999999';

-- Filtrar array JSONB
SELECT * FROM users
WHERE metadata->'tags' ? 'vip';

-- Contem objeto
SELECT * FROM users
WHERE metadata @> '{"phone": "11999999999"}';

-- Atualizar campo JSONB
UPDATE users
SET metadata = jsonb_set(metadata, '{phone}', '"11888888888"')
WHERE id = 'user-1';

-- Adicionar campo
UPDATE users
SET metadata = metadata || '{"verified": true}'
WHERE id = 'user-1';

-- Remover campo
UPDATE users
SET metadata = metadata - 'phone'
WHERE id = 'user-1';
```

---

## Queries Avancadas

```sql
-- CTE (Common Table Expression)
WITH active_conversations AS (
  SELECT c.*, COUNT(m.id) as message_count
  FROM conversations c
  LEFT JOIN messages m ON m.conversation_id = c.id
  WHERE c.status = 'OPEN'
  GROUP BY c.id
)
SELECT * FROM active_conversations
WHERE message_count > 10;

-- Window Functions
SELECT
  id,
  name,
  created_at,
  ROW_NUMBER() OVER (ORDER BY created_at) as row_num,
  RANK() OVER (PARTITION BY role ORDER BY created_at) as rank_in_role,
  COUNT(*) OVER (PARTITION BY role) as total_in_role
FROM users;

-- Lag/Lead
SELECT
  id,
  created_at,
  LAG(created_at) OVER (ORDER BY created_at) as previous_time,
  created_at - LAG(created_at) OVER (ORDER BY created_at) as time_diff
FROM messages
WHERE conversation_id = 'conv-1';
```

---

## Joins e Subqueries

```sql
-- INNER JOIN
SELECT u.name, c.id as conversation_id
FROM users u
INNER JOIN conversations c ON c.assigned_to_id = u.id;

-- LEFT JOIN
SELECT u.name, COUNT(c.id) as total_conversations
FROM users u
LEFT JOIN conversations c ON c.assigned_to_id = u.id
GROUP BY u.id;

-- Subquery no WHERE
SELECT * FROM conversations
WHERE assigned_to_id IN (
  SELECT id FROM users WHERE role = 'ADMIN'
);

-- Subquery no FROM
SELECT avg_messages.tenant_id, AVG(message_count) as avg_per_conversation
FROM (
  SELECT tenant_id, COUNT(*) as message_count
  FROM messages
  GROUP BY conversation_id, tenant_id
) avg_messages
GROUP BY tenant_id;

-- EXISTS
SELECT * FROM users u
WHERE EXISTS (
  SELECT 1 FROM conversations c
  WHERE c.assigned_to_id = u.id AND c.status = 'OPEN'
);
```

---

## Agregacoes

```sql
-- Basicas
SELECT
  COUNT(*) as total,
  COUNT(DISTINCT tenant_id) as tenants,
  MIN(created_at) as first,
  MAX(created_at) as last,
  AVG(EXTRACT(EPOCH FROM updated_at - created_at)) as avg_duration
FROM conversations;

-- Group by com filtro
SELECT
  status,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_opportunity) as opportunities
FROM conversations
WHERE tenant_id = 'tenant-1'
GROUP BY status
HAVING COUNT(*) > 10
ORDER BY total DESC;

-- Array aggregation
SELECT
  conversation_id,
  ARRAY_AGG(content ORDER BY created_at) as messages
FROM messages
GROUP BY conversation_id;

-- JSON aggregation
SELECT
  c.id,
  JSON_AGG(json_build_object('id', t.id, 'name', t.name)) as tags
FROM conversations c
LEFT JOIN conversation_tags ct ON ct.conversation_id = c.id
LEFT JOIN tags t ON t.id = ct.tag_id
GROUP BY c.id;
```

---

## Full Text Search

```sql
-- Criar coluna tsvector
ALTER TABLE messages ADD COLUMN search_vector tsvector;

-- Popular coluna
UPDATE messages
SET search_vector = to_tsvector('portuguese', content);

-- Trigger para manter atualizado
CREATE TRIGGER messages_search_vector_update
BEFORE INSERT OR UPDATE ON messages
FOR EACH ROW EXECUTE FUNCTION
  tsvector_update_trigger(search_vector, 'pg_catalog.portuguese', content);

-- Indice GIN
CREATE INDEX idx_messages_search ON messages USING gin(search_vector);

-- Busca
SELECT * FROM messages
WHERE search_vector @@ to_tsquery('portuguese', 'reserva & hotel');

-- Com ranking
SELECT
  id,
  content,
  ts_rank(search_vector, query) as rank
FROM messages, to_tsquery('portuguese', 'reserva | hotel') query
WHERE search_vector @@ query
ORDER BY rank DESC;
```

---

## Performance

```sql
-- EXPLAIN ANALYZE
EXPLAIN ANALYZE SELECT * FROM users WHERE tenant_id = 'tenant-1';

-- Ver plano de execucao
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM conversations
WHERE tenant_id = 'tenant-1' AND status = 'OPEN';

-- Estatisticas de tabela
SELECT
  relname as table,
  n_live_tup as rows,
  n_dead_tup as dead_rows,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables;

-- Uso de indices
SELECT
  indexrelname as index,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public';

-- Indices nao usados
SELECT indexrelname FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE '%pkey%';
```

---

## Partitioning

```sql
-- Criar tabela particionada por range
CREATE TABLE messages (
  id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (created_at);

-- Criar particoes
CREATE TABLE messages_2024_01 PARTITION OF messages
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE messages_2024_02 PARTITION OF messages
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Particao por lista
CREATE TABLE conversations (
  id UUID,
  tenant_id UUID,
  status VARCHAR(20)
) PARTITION BY LIST (tenant_id);

CREATE TABLE conversations_tenant1 PARTITION OF conversations
  FOR VALUES IN ('tenant-1-uuid');
```

---

## Transactions e Locks

```sql
-- Transaction explicita
BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = 1;
  UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;

-- Savepoint
BEGIN;
  INSERT INTO users (name) VALUES ('Ana');
  SAVEPOINT sp1;
  INSERT INTO users (name) VALUES ('Bob');
  ROLLBACK TO sp1; -- Desfaz apenas Bob
COMMIT;

-- SELECT FOR UPDATE (lock rows)
BEGIN;
  SELECT * FROM conversations
  WHERE id = 'conv-1'
  FOR UPDATE;
  -- Outras transacoes aguardam
  UPDATE conversations SET status = 'CLOSED' WHERE id = 'conv-1';
COMMIT;

-- SKIP LOCKED (pular linhas bloqueadas)
SELECT * FROM tasks
WHERE status = 'PENDING'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

---

## Backup e Manutencao

```bash
# Backup
pg_dump -U postgres -h localhost dbname > backup.sql
pg_dump -Fc dbname > backup.dump  # Formato customizado

# Restore
psql -U postgres -d dbname < backup.sql
pg_restore -d dbname backup.dump

# Vacuum (libera espaco)
VACUUM ANALYZE users;

# Reindex
REINDEX INDEX idx_users_tenant;
```

---

## Checklist

- [ ] Usar TIMESTAMPTZ para datas (nao TIMESTAMP)
- [ ] Usar UUID para IDs distribuidos
- [ ] Criar indices para colunas de WHERE/JOIN
- [ ] Usar indices parciais para filtros comuns
- [ ] JSONB para dados semi-estruturados
- [ ] Analisar queries com EXPLAIN ANALYZE
- [ ] Particionar tabelas grandes (>10M rows)
- [ ] Configurar autovacuum adequadamente
