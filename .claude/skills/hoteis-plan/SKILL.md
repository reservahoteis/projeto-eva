# /hoteis-plan - Planejamento Socratico

Skill de planejamento inspirada no **superpowers framework**. Usa dialogo socratico para clarificar requisitos ANTES de implementar.

---

## Quando Usar

- Antes de implementar qualquer feature nova
- Quando o pedido e vago ou ambiguo
- Quando ha multiplas formas de resolver
- Para tasks que levam mais de 30 minutos

---

## Fluxo de Planejamento

### Fase 1: Clarificacao (Socratic Dialogue)

Faca perguntas para entender completamente:

```
1. CONTEXTO
   - Qual problema estamos resolvendo?
   - Quem vai usar essa feature?
   - Como funciona hoje (se existe)?

2. ESCOPO
   - O que DEVE estar incluido? (must-have)
   - O que pode ficar para depois? (nice-to-have)
   - O que NAO deve ser feito? (out of scope)

3. RESTRICOES
   - Tem deadline?
   - Tem dependencias de outras features?
   - Tem restricoes tecnicas?

4. CRITERIOS DE SUCESSO
   - Como sabemos que esta pronto?
   - Quais testes devem passar?
   - Qual o comportamento esperado?
```

### Fase 2: Exploracao de Alternativas

Antes de decidir a abordagem, explore:

```
OPCAO A: [Abordagem 1]
- Pros: ...
- Contras: ...
- Esforco: X horas
- Risco: Baixo/Medio/Alto

OPCAO B: [Abordagem 2]
- Pros: ...
- Contras: ...
- Esforco: X horas
- Risco: Baixo/Medio/Alto

RECOMENDACAO: Opcao [X] porque [justificativa]
```

### Fase 3: Plano de Implementacao

Quebrar em tarefas de 2-5 minutos cada:

```
## Plano: [Nome da Feature]

### Pre-requisitos
- [ ] Consultar MCP docs relevantes
- [ ] Verificar se existe codigo similar no projeto

### Backend
1. [ ] Criar teste: should [acao] when [condicao]
2. [ ] Implementar [service/controller]
3. [ ] Validar com Zod
4. [ ] Adicionar rota

### Frontend (se aplicavel)
5. [ ] Criar teste do componente
6. [ ] Implementar componente
7. [ ] Conectar com API (TanStack Query)

### Validacao
8. [ ] Rodar testes
9. [ ] Verificar tipos (tsc --noEmit)
10. [ ] Testar manualmente

### Estimativa: [X] horas
```

---

## Template de Plano

```markdown
# Plano: [Nome da Feature]

## 1. Contexto
[Descricao do problema e quem vai usar]

## 2. Escopo
### Incluido
- Item 1
- Item 2

### Excluido
- Item fora do escopo

## 3. Abordagem Escolhida
[Descricao da solucao tecnica]

## 4. Tarefas (TDD)

### Backend
- [ ] RED: Escrever teste para [funcionalidade 1]
- [ ] GREEN: Implementar [funcionalidade 1]
- [ ] RED: Escrever teste para [funcionalidade 2]
- [ ] GREEN: Implementar [funcionalidade 2]

### Frontend
- [ ] RED: Escrever teste para [componente]
- [ ] GREEN: Implementar [componente]

## 5. Criterios de Aceite
- [ ] Todos os testes passando
- [ ] TypeScript sem erros
- [ ] Funciona no ambiente de dev

## 6. Riscos
| Risco | Mitigacao |
|-------|-----------|
| [Risco 1] | [Como evitar] |

## 7. Estimativa
- Desenvolvimento: X horas
- Testes: Y horas
- Total: Z horas
```

---

## Integracao com Workflow

### Antes do /hoteis-plan
1. Usuario faz pedido
2. Detectar se e complexo (>30min ou ambiguo)
3. Invocar /hoteis-plan automaticamente

### Durante o /hoteis-plan
1. Fazer perguntas socraticas
2. Explorar alternativas
3. Criar plano detalhado
4. Pedir aprovacao do usuario

### Depois do /hoteis-plan
1. Salvar plano em `.claude/epics/[nome].md`
2. Usar TodoWrite para trackear progresso
3. Seguir TDD rigorosamente
4. Invocar skills especificas (/hoteis-api, etc)

---

## Exemplos

### Exemplo 1: Feature Ambigua

**Usuario:** "Preciso de um sistema de tags"

**Perguntas Socraticas:**
1. Tags para o que? Conversas? Contatos? Ambos?
2. Quem pode criar/editar tags? Todos ou so admins?
3. Tags sao por tenant ou globais?
4. Limite de tags por item?
5. Tags com cores? Icones?

**Plano resultante:** Documento detalhado com escopo claro

### Exemplo 2: Feature Clara

**Usuario:** "Adicionar campo telefone2 no contato"

**Avaliacao:** Simples, <30min, escopo claro
**Acao:** Nao precisa de /hoteis-plan completo, usar skill direta

---

## Regras

1. **NAO IMPLEMENTE SEM PLANO** para features complexas
2. **PERGUNTE** se algo nao esta claro
3. **DOCUMENTE** alternativas consideradas
4. **QUEBRE** em tarefas de 2-5 minutos
5. **TDD PRIMEIRO** - cada tarefa comeca com teste

---

## Checklist Pre-Implementacao

```
[ ] Entendi o problema completamente?
[ ] Sei quem vai usar e como?
[ ] Escopo esta claro (in/out)?
[ ] Explorei alternativas?
[ ] Plano tem tarefas de 2-5 min?
[ ] Cada tarefa comeca com teste?
[ ] Usuario aprovou o plano?
```
