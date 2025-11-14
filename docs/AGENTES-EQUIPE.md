# 🤖 Equipe de Agentes Especializados Claude Code

> **Documento de Referência Rápida**
> Última atualização: 2025-11-14
> Consulte este documento no início de cada sessão para saber quais agentes utilizar

---

## 📋 Índice

1. [Segurança (6 agentes)](#segurança)
2. [Testes & Qualidade (4 agentes)](#testes--qualidade)
3. [Desenvolvimento (3 agentes)](#desenvolvimento)
4. [Performance & Dados (2 agentes)](#performance--dados)
5. [Comandos Especializados (3)](#comandos-especializados)
6. [Quando Usar Cada Agente](#quando-usar-cada-agente)

---

## 🔒 Segurança

### 1. **compliance-specialist**
**Model:** Opus (mais poderoso)
**Especialidade:** Conformidade regulatória e frameworks de governança

**Skills:**
- ✅ GDPR, LGPD, HIPAA, PCI-DSS, SOC 2, SOX
- ✅ Gap analysis e mapeamento de frameworks
- ✅ Assessment de riscos e gestão
- ✅ Desenvolvimento de políticas de segurança
- ✅ Preparação para auditorias e coleta de evidências
- ✅ Business continuity e disaster recovery

**Quando usar:**
- Implementar compliance LGPD/GDPR
- Preparar para auditorias SOC 2 ou ISO 27001
- Desenvolver políticas de segurança
- Fazer gap analysis de compliance
- Documentar controles e evidências

**Entrega:**
- Relatórios de compliance assessment
- Políticas e procedimentos documentados
- Risk registers e estratégias de mitigação
- Pacotes de evidências para auditoria
- Mapeamento de requisitos regulatórios

---

### 2. **security-auditor**
**Model:** Opus
**Especialidade:** Auditoria de código e práticas de segurança

**Skills:**
- ✅ Authentication/Authorization (JWT, OAuth2, SAML)
- ✅ OWASP Top 10 vulnerability detection
- ✅ API security e configuração CORS
- ✅ Input validation e SQL injection prevention
- ✅ Encryption (at rest e in transit)
- ✅ Security headers e CSP policies

**Quando usar:**
- Review de segurança de código
- Implementar fluxos de autenticação
- Corrigir vulnerabilidades
- Configurar security headers
- Validar implementações de criptografia

**Entrega:**
- Security audit report com severity levels
- Código seguro com comentários
- Diagramas de authentication flow
- Security checklist para feature
- Configuração de security headers
- Test cases para cenários de segurança

**Princípios:**
- Defense in depth (múltiplas camadas)
- Principle of least privilege
- Never trust user input
- Fail securely (sem information leakage)

---

### 3. **api-security-audit**
**Model:** Sonnet
**Especialidade:** Segurança de APIs REST

**Skills:**
- ✅ JWT vulnerabilities e token management
- ✅ RBAC issues e privilege escalation
- ✅ SQL/NoSQL/Command injection prevention
- ✅ Sensitive data exposure
- ✅ OWASP API Top 10
- ✅ Rate limiting e security standards

**Quando usar:**
- Auditoria completa de API security
- Review de authentication/authorization
- Vulnerability assessment de APIs
- Validação de compliance de APIs
- Incident response em APIs

**Entrega:**
- Código seguro (JWT, bcrypt, validation)
- Input validation e sanitization
- Security recommendations acionáveis
- Exemplos de código com correções

---

### 4. **penetration-tester**
**Model:** Opus
**Especialidade:** Ethical hacking e testes de invasão

**Skills:**
- ✅ Network penetration testing
- ✅ Web application security (OWASP Top 10)
- ✅ Social engineering assessment
- ✅ Wireless network security
- ✅ Mobile app security testing
- ✅ Red team operations

**Quando usar:**
- Security assessment completo
- Testar defesas de segurança
- Simular ataques reais
- Avaliar postura de segurança
- Identificar vulnerabilidades exploráveis

**Entrega:**
- Penetration test reports completos
- Vulnerability assessment com CVSS scoring
- Proof-of-concepts de exploits
- Network diagrams e attack vectors
- Remediation roadmaps priorizados
- Executive summary para stakeholders

**Approach:**
1. Reconnaissance e information gathering
2. Vulnerability identification
3. Exploitation (minimal impact)
4. Privilege escalation
5. Documentation e evidence
6. Remediation recommendations

---

### 5. **incident-responder**
**Model:** Opus
**Especialidade:** Resposta a incidentes de produção

**Skills:**
- ✅ Incident assessment e severity classification
- ✅ Quick mitigation e stabilization
- ✅ Log analysis e root cause investigation
- ✅ Rollback strategies
- ✅ Post-mortem documentation
- ✅ Communication protocols

**Quando usar:**
- 🚨 **IMEDIATAMENTE quando produção cair**
- Degradação de performance crítica
- Security incident em produção
- Data loss ou corruption
- Qualquer P0/P1 incident

**Severity Levels:**
- **P0**: Outage completo (resposta imediata)
- **P1**: Funcionalidade major quebrada (<1h)
- **P2**: Issues significantes (<4h)
- **P3**: Issues menores (next business day)

**Protocol (primeiros 5 min):**
1. Assess severity (user/business impact)
2. Stabilize (quick mitigation)
3. Gather data (logs, recent changes)

**Entrega:**
- Timeline do incidente
- Root cause analysis
- Action items
- Runbook updates
- Post-mortem documentation

---

### 6. **security-engineer**
**Model:** Sonnet
**Especialidade:** Infraestrutura de segurança

**Skills:**
- ✅ Network security architecture
- ✅ Cloud security (AWS/Azure/GCP)
- ✅ Container security (Docker/K8s)
- ✅ Secrets management (Vault, KMS)
- ✅ IDS/IPS configuration
- ✅ Zero-trust architecture

**Quando usar:**
- Setup de infraestrutura segura
- Cloud security hardening
- Container security policies
- Secrets management implementation
- Network segmentation

---

## ✅ Testes & Qualidade

### 7. **test-engineer**
**Model:** Sonnet
**Especialidade:** Estratégia de testes e quality assurance

**Skills:**
- ✅ Test strategy e test pyramid
- ✅ Unit/Integration/E2E testing
- ✅ Test automation frameworks (Jest, Playwright, Cypress)
- ✅ Coverage analysis e reporting
- ✅ CI/CD test pipeline integration
- ✅ Performance testing

**Quando usar:**
- Criar estratégia de testes
- Setup de test automation
- Medir code coverage
- Configurar CI/CD para testes
- Implementar test pyramid

**Test Pyramid:**
- 70% Unit tests
- 20% Integration tests
- 10% E2E tests

**Entrega:**
- Test suite completa
- Test framework setup (Jest, Playwright)
- Coverage reports e thresholds
- CI/CD pipeline configuration
- Test patterns e utilities
- Performance test framework

**Frameworks:**
- Unit: Jest, Mocha, Vitest, pytest, JUnit
- Integration: API testing, DB testing
- E2E: Playwright, Cypress, Selenium
- Performance: k6, JMeter, Locust

---

### 8. **test-automator**
**Model:** Sonnet
**Especialidade:** Automação de testes

**Skills:**
- ✅ Unit test design com mocking
- ✅ Integration tests com test containers
- ✅ E2E tests (Playwright/Cypress)
- ✅ CI/CD test pipeline
- ✅ Test data factories
- ✅ Coverage analysis

**Quando usar:**
- Criar test suites completas
- Implementar mocking strategies
- Setup de test data management
- Configurar CI pipeline para testes
- Melhorar coverage de testes

**Approach:**
- Test pyramid (many unit, fewer integration, minimal E2E)
- Arrange-Act-Assert pattern
- Test behavior, not implementation
- Deterministic tests (no flakiness)
- Fast feedback (parallelize)

**Entrega:**
- Test suite com nomes claros
- Mock/stub implementations
- Test data factories/fixtures
- CI pipeline configuration
- Coverage report setup
- E2E test scenarios

---

### 9. **mcp-testing-engineer**
**Model:** Sonnet
**Especialidade:** Testes de MCP servers (Model Context Protocol)

**Skills:**
- ✅ Schema & protocol validation (MCP Inspector)
- ✅ JSON-RPC compliance testing
- ✅ Annotation & safety testing
- ✅ Security & session testing (confused deputy, injection)
- ✅ Performance & load testing
- ✅ Automated testing patterns

**Quando usar:**
- Testar MCP servers customizados
- Validar protocol compliance
- Security audit de MCP implementations
- Performance testing de MCP endpoints
- Debugging de MCP integrations

**Quality Standards:**
- 100% schema compliance
- Zero critical vulnerabilities
- <100ms response time
- Complete error handling
- Full endpoint coverage

**Entrega:**
- Executive summary
- Detailed test results
- Security vulnerability assessment (CVSS)
- Performance metrics
- Code examples de issues
- Prioritized recommendations
- Automated test code para CI/CD

---

### 10. **test-quality-analyzer** (Comando)
**Especialidade:** Análise de qualidade de testes

**Quando usar:**
- Avaliar qualidade dos testes existentes
- Identificar testes frágeis (flaky)
- Analisar mutation testing results
- Recomendar melhorias de teste

---

## 💻 Desenvolvimento

### 11. **backend-architect**
**Model:** Sonnet
**Especialidade:** Arquitetura de backend e APIs

**Skills:**
- ✅ RESTful API design (versioning, error handling)
- ✅ Service boundaries e microservices
- ✅ Database schema design (indexes, sharding)
- ✅ Caching strategies
- ✅ Scalability planning
- ✅ Auth e rate limiting

**Quando usar:**
- Desenhar APIs RESTful
- Definir microservice boundaries
- Modelar database schemas
- Planejar escalabilidade
- Otimizar performance de backend

**Approach:**
1. Start with clear service boundaries
2. Design APIs contract-first
3. Consider data consistency
4. Plan for horizontal scaling
5. Keep it simple (avoid premature optimization)

**Entrega:**
- API endpoint definitions
- Service architecture diagram (mermaid/ASCII)
- Database schema com relationships
- Tech stack recommendations
- Bottleneck analysis

---

### 12. **typescript-pro**
**Model:** Sonnet
**Especialidade:** TypeScript avançado

**Skills:**
- ✅ Advanced type system (conditional, mapped, template literal)
- ✅ Generic constraints e type inference
- ✅ Utility types customizados
- ✅ Strict TypeScript configuration
- ✅ Declaration files
- ✅ Performance optimization

**Quando usar:**
- Eliminar `as any` do código
- Implementar tipos complexos
- Migrar de JavaScript para TypeScript
- Otimizar type inference
- Criar utility types customizados

**Approach:**
1. Leverage type system para compile-time safety
2. Use strict config
3. Prefer type inference when clear
4. Design APIs com generic constraints
5. Optimize build performance

**Entrega:**
- Strongly typed TypeScript
- Advanced generic types
- Custom utility types
- Strict tsconfig.json
- Type-safe APIs
- Build optimization
- Migration strategies JS→TS

---

### 13. **error-detective**
**Model:** Sonnet
**Especialidade:** Análise de logs e debugging

**Skills:**
- ✅ Log parsing e error extraction (regex)
- ✅ Stack trace analysis
- ✅ Error correlation em sistemas distribuídos
- ✅ Log aggregation (Elasticsearch, Splunk)
- ✅ Anomaly detection
- ✅ Pattern recognition

**Quando usar:**
- Debug de issues complexos
- Análise de logs de produção
- Investigação de erros
- Correlação de erros entre serviços
- Detecção de anomalias

**Approach:**
1. Start com symptoms, work backward
2. Look for patterns
3. Correlate com deployments
4. Check cascading failures
5. Identify error rate spikes

**Entrega:**
- Regex patterns para extraction
- Timeline de erros
- Correlation analysis
- Root cause hypothesis
- Monitoring queries
- Code locations do problema

---

## 🚀 Performance & Dados

### 14. **performance-engineer**
**Model:** Opus
**Especialidade:** Otimização de performance

**Skills:**
- ✅ Application profiling (CPU, memory, I/O)
- ✅ Load testing (k6, JMeter, Locust)
- ✅ Caching strategies (Redis, CDN)
- ✅ Database query optimization
- ✅ Frontend performance (Core Web Vitals)
- ✅ API response time optimization

**Quando usar:**
- Performance issues
- Load testing
- Cache implementation
- Query optimization
- Frontend optimization
- Scalability planning

**Approach:**
1. Measure before optimizing
2. Focus on biggest bottlenecks
3. Set performance budgets
4. Cache at appropriate layers
5. Load test realistic scenarios

**Entrega:**
- Profiling results com flamegraphs
- Load test scripts e results
- Caching implementation
- Optimization recommendations (ranked)
- Before/after metrics
- Monitoring dashboard setup

---

### 15. **data-engineer**
**Model:** Sonnet
**Especialidade:** Data pipelines e analytics

**Skills:**
- ✅ ETL/ELT pipeline design (Airflow)
- ✅ Spark optimization
- ✅ Streaming data (Kafka/Kinesis)
- ✅ Data warehouse modeling
- ✅ Data quality monitoring
- ✅ Cost optimization

**Quando usar:**
- Setup de data pipelines
- ETL/ELT implementation
- Data warehouse design
- Streaming architecture
- Data quality monitoring

**Approach:**
1. Schema-on-read vs schema-on-write
2. Incremental processing
3. Idempotent operations
4. Data lineage documentation
5. Monitor data quality

**Entrega:**
- Airflow DAG com error handling
- Spark jobs otimizados
- Data warehouse schema
- Data quality checks
- Monitoring configuration
- Cost estimation

---

## ⚙️ Comandos Especializados

### 16. **/test-coverage**
**Análise completa de code coverage**

**Features:**
- Configure coverage tools (Jest, NYC, Istanbul)
- Generate coverage reports (line, branch, function, statement)
- Gap analysis (uncovered paths)
- Threshold management
- Coverage dashboards
- Trend monitoring

**Quando usar:**
- Medir coverage atual
- Identificar gaps críticos
- Setup de coverage thresholds
- Gerar relatórios de coverage

---

### 17. **/test-automation-orchestrator**
**Orquestração de suíte de testes**

**Features:**
- Coordenar execução de testes (unit, integration, E2E)
- Paralelização de testes
- Test result aggregation
- Failure analysis
- CI/CD integration

**Quando usar:**
- Executar full test suite
- CI/CD pipeline setup
- Coordenar multiple test types
- Aggregate test results

---

### 18. **/test-quality-analyzer**
**Análise de qualidade dos testes**

**Features:**
- Test code quality assessment
- Flaky test detection
- Test maintenance recommendations
- Mutation testing integration
- Test effectiveness analysis

**Quando usar:**
- Avaliar qualidade de testes
- Identificar testes problemáticos
- Mutation testing
- Test refactoring

---

## 🎯 Quando Usar Cada Agente

### Segurança & Compliance
```
Implementar LGPD/GDPR          → compliance-specialist
Review de segurança            → security-auditor
Auditoria de API               → api-security-audit
Testar invasão                 → penetration-tester
Incidente em produção 🚨       → incident-responder
Infraestrutura segura          → security-engineer
```

### Testes
```
Estratégia de testes           → test-engineer
Criar test automation          → test-automator
Testar MCP server              → mcp-testing-engineer
Medir coverage                 → /test-coverage
Orquestrar testes              → /test-automation-orchestrator
Analisar qualidade de testes   → /test-quality-analyzer
```

### Desenvolvimento
```
Desenhar API/arquitetura       → backend-architect
TypeScript avançado            → typescript-pro
Debug de erros                 → error-detective
```

### Performance
```
Otimizar performance           → performance-engineer
Data pipelines                 → data-engineer
```

---

## 📊 Padrões de Qualidade

### Coverage Targets
- **Google/Meta standard:** 80-95%
- **Nosso target:** 85%+
- **Current threshold:** 50% (jest.config.js)

### Severity Levels
- **P0**: Critical - Immediate response
- **P1**: High - <1 hour
- **P2**: Medium - <4 hours
- **P3**: Low - Next business day

### Test Pyramid
- **70%** Unit tests
- **20%** Integration tests
- **10%** E2E tests

---

## 🔧 Setup e Hooks

### Test Runner Hook
Configurado em `.claude/settings.local.json`:
- Auto-executa testes após edições em arquivos `.js`/`.ts`/`.py`
- Integra com npm/yarn/pytest/rspec

### Model Configuration
- **Default:** Claude Sonnet 4.5
- **Fast model:** Claude Haiku (para tasks rápidas)

---

## 📝 Como Usar Este Documento

1. **Início de sessão:** Consulte este documento para escolher agentes
2. **Durante desenvolvimento:** Use como referência rápida
3. **Antes de commits:** Verifique se usou agentes de segurança/testes
4. **Em incidentes:** 🚨 Use **incident-responder** imediatamente

---

## 🎓 Princípios da Equipe

1. **Qualidade World-Class:** Padrão FAANG (Google, Meta, Amazon)
2. **Security First:** Defense in depth, least privilege
3. **Test Pyramid:** Many unit, fewer integration, minimal E2E
4. **Compliance:** LGPD, GDPR, SOC 2 ready
5. **Performance:** Measure, optimize, monitor
6. **Documentation:** Clear, actionable, maintainable

---

**Última atualização:** 2025-11-14
**Localização:** `.claude/agents/` e `.claude/commands/`
**Repositório:** projeto-hoteis-reserva
