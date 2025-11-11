# 🤝 Guia de Contribuição

Obrigado por considerar contribuir com o **CRM WhatsApp SaaS Multi-Tenant**! Este documento fornece diretrizes para tornar o processo de contribuição claro e eficaz para todos.

---

## 📋 Índice

1. [Código de Conduta](#código-de-conduta)
2. [Como Posso Contribuir?](#como-posso-contribuir)
3. [Configuração do Ambiente](#configuração-do-ambiente)
4. [Processo de Desenvolvimento](#processo-de-desenvolvimento)
5. [Padrões de Código](#padrões-de-código)
6. [Commits e Pull Requests](#commits-e-pull-requests)
7. [Reportando Bugs](#reportando-bugs)
8. [Sugerindo Melhorias](#sugerindo-melhorias)

---

## 📜 Código de Conduta

Este projeto adere ao [Código de Conduta](CODE_OF_CONDUCT.md). Ao participar, você concorda em manter um ambiente respeitoso e acolhedor.

---

## 🚀 Como Posso Contribuir?

### **Reportar Bugs**
- Verifique se o bug já foi reportado nas [Issues](https://github.com/fredcast/projeto-eva/issues)
- Se não, crie uma nova issue com o template de bug report
- Inclua: passos para reproduzir, comportamento esperado vs atual, screenshots se aplicável

### **Sugerir Funcionalidades**
- Abra uma issue com o template de feature request
- Explique claramente o problema que a funcionalidade resolve
- Descreva a solução proposta e alternativas consideradas

### **Contribuir com Código**
- Corrija bugs existentes
- Implemente novas funcionalidades
- Melhore a documentação
- Adicione ou melhore testes

### **Melhorar Documentação**
- Corrigir erros de digitação
- Adicionar exemplos
- Esclarecer instruções
- Traduzir documentação

---

## 🛠️ Configuração do Ambiente

### **1. Fork e Clone**

```bash
# Fork o repositório no GitHub
# Depois clone seu fork:
git clone https://github.com/SEU-USUARIO/projeto-eva.git
cd projeto-eva

# Adicione o repositório original como upstream
git remote add upstream https://github.com/fredcast/projeto-eva.git
```

### **2. Instalar Dependências**

```bash
# Instalar dependências do backend
cd apps/backend
npm install

# Instalar dependências do frontend (se aplicável)
cd ../frontend
npm install
```

### **3. Configurar Banco de Dados**

```bash
# Copiar .env de exemplo
cp .env.example .env.development

# Editar .env.development com suas credenciais
# Depois rodar migrations:
cd apps/backend
npx prisma migrate dev
npx prisma generate
```

### **4. Rodar Localmente**

```bash
# Terminal 1 - Backend
cd apps/backend
npm run dev

# Terminal 2 - Frontend
cd apps/frontend
npm run dev
```

---

## 💻 Processo de Desenvolvimento

### **1. Criar uma Branch**

Sempre crie uma branch a partir de `master` atualizada:

```bash
# Atualizar master
git checkout master
git pull upstream master

# Criar branch para sua feature/fix
git checkout -b feature/nome-da-feature
# ou
git checkout -b fix/nome-do-bug
```

**Nomenclatura de Branches:**
- `feature/` - Novas funcionalidades
- `fix/` - Correções de bugs
- `docs/` - Alterações na documentação
- `refactor/` - Refatorações
- `test/` - Adição/correção de testes

### **2. Desenvolver**

- Faça commits pequenos e atômicos
- Siga os [padrões de código](#padrões-de-código)
- Adicione testes para novas funcionalidades
- Atualize a documentação quando necessário

### **3. Testar**

```bash
# Rodar testes unitários
npm test

# Rodar testes de integração
npm run test:integration

# Verificar coverage
npm run test:coverage

# Lint
npm run lint

# Type check
npm run type-check
```

### **4. Commit e Push**

```bash
# Adicionar arquivos
git add .

# Commit com mensagem semântica
git commit -m "feat: adiciona autenticação OAuth"

# Push para seu fork
git push origin feature/nome-da-feature
```

### **5. Abrir Pull Request**

1. Vá para o repositório original no GitHub
2. Clique em "New Pull Request"
3. Selecione sua branch
4. Preencha o template de PR
5. Aguarde review

---

## 📝 Padrões de Código

### **TypeScript**

- Use TypeScript sempre que possível
- Evite `any`, prefira tipos específicos
- Use interfaces para objetos públicos
- Use types para unions/intersections

```typescript
// ✅ BOM
interface User {
  id: string;
  email: string;
  name: string;
}

// ❌ EVITAR
const user: any = { ... };
```

### **Estilo de Código**

O projeto usa **ESLint** e **Prettier** para garantir consistência:

```bash
# Formatar código
npm run format

# Verificar lint
npm run lint

# Corrigir lint automaticamente
npm run lint:fix
```

**Regras principais:**
- Indentação: 2 espaços
- Aspas: simples (`'`)
- Ponto e vírgula: sempre
- Trailing comma: sempre
- Max line length: 100 caracteres

### **Naming Conventions**

```typescript
// Variáveis e funções: camelCase
const userName = 'Fred';
function getUserById(id: string) { ... }

// Classes e interfaces: PascalCase
class UserService { ... }
interface UserRepository { ... }

// Constantes: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;

// Arquivos:
// - Components: PascalCase (UserCard.tsx)
// - Utils/services: camelCase (auth.service.ts)
// - Types: camelCase (user.types.ts)
```

### **Estrutura de Arquivos**

```typescript
// 1. Imports externos
import express from 'express';
import { z } from 'zod';

// 2. Imports internos
import { UserService } from './services/user.service';
import { authMiddleware } from './middlewares/auth';

// 3. Types/Interfaces
interface CreateUserDto {
  email: string;
  name: string;
}

// 4. Constantes
const DEFAULT_PAGE_SIZE = 20;

// 5. Código principal
export class UserController {
  // ...
}
```

---

## 📦 Commits e Pull Requests

### **Mensagens de Commit**

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<escopo>): <descrição>

[corpo opcional]

[rodapé opcional]
```

**Tipos:**
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Documentação
- `style`: Formatação (não afeta código)
- `refactor`: Refatoração
- `test`: Adição/correção de testes
- `chore`: Tarefas de manutenção

**Exemplos:**

```bash
feat(auth): adiciona autenticação com Google OAuth
fix(messages): corrige envio de mensagens com mídia
docs(readme): atualiza instruções de instalação
refactor(services): simplifica lógica do WhatsAppService
test(auth): adiciona testes para login JWT
chore(deps): atualiza Prisma para v5.9.1
```

### **Pull Requests**

**Título:**
```
[TIPO] Descrição curta e clara
```

Exemplos:
- `[FEAT] Adiciona suporte para mensagens de áudio`
- `[FIX] Corrige bug no webhook do WhatsApp`
- `[DOCS] Melhora documentação da API`

**Descrição:**

Use o template de PR:

```markdown
## 📋 Descrição
Breve descrição das mudanças.

## 🔗 Issue Relacionada
Closes #123

## 🧪 Como Testar
1. Passo 1
2. Passo 2

## ✅ Checklist
- [ ] Código testado localmente
- [ ] Testes adicionados/atualizados
- [ ] Documentação atualizada
- [ ] Lint passou
- [ ] Type check passou
```

---

## 🐛 Reportando Bugs

### **Antes de Reportar**

1. Verifique se está usando a versão mais recente
2. Procure nas [Issues existentes](https://github.com/fredcast/projeto-eva/issues)
3. Tente reproduzir em um ambiente limpo

### **Template de Bug Report**

```markdown
**Descrição do Bug**
Descrição clara do que aconteceu.

**Passos para Reproduzir**
1. Vá para '...'
2. Clique em '....'
3. Role até '....'
4. Veja o erro

**Comportamento Esperado**
O que deveria acontecer.

**Screenshots**
Se aplicável, adicione screenshots.

**Ambiente:**
- OS: [ex: Ubuntu 22.04]
- Node: [ex: 20.11.0]
- Browser: [ex: Chrome 120]

**Contexto Adicional**
Qualquer informação relevante.
```

---

## 💡 Sugerindo Melhorias

### **Template de Feature Request**

```markdown
**A funcionalidade resolve qual problema?**
Descrição clara do problema.

**Solução Proposta**
Como você gostaria que funcionasse.

**Alternativas Consideradas**
Outras soluções que você considerou.

**Contexto Adicional**
Screenshots, mockups, exemplos, etc.
```

---

## 🧪 Testes

### **Escrever Testes**

Todo código novo deve incluir testes:

```typescript
// user.service.spec.ts
import { UserService } from './user.service';

describe('UserService', () => {
  describe('createUser', () => {
    it('should create a new user', async () => {
      const userService = new UserService();
      const user = await userService.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
    });

    it('should throw error if email already exists', async () => {
      // ...
    });
  });
});
```

### **Rodar Testes**

```bash
# Todos os testes
npm test

# Testes específicos
npm test -- user.service.spec.ts

# Watch mode
npm test -- --watch

# Coverage
npm run test:coverage
```

---

## 📚 Documentação

### **Comentários no Código**

```typescript
/**
 * Cria um novo usuário no sistema
 * @param data - Dados do usuário a ser criado
 * @returns Promise com o usuário criado
 * @throws {AppError} Se o email já estiver em uso
 */
async createUser(data: CreateUserDto): Promise<User> {
  // Implementação
}
```

### **README e Documentação**

- Mantenha os exemplos atualizados
- Adicione screenshots quando útil
- Explique o "porquê", não apenas o "como"
- Use português claro e direto

---

## ❓ Dúvidas?

- 📧 Abra uma [Discussion](https://github.com/fredcast/projeto-eva/discussions)
- 🐛 Crie uma [Issue](https://github.com/fredcast/projeto-eva/issues)
- 📖 Consulte a [Documentação](DOCUMENTACAO-DEFINITIVA.md)

---

## 🙏 Agradecimentos

Muito obrigado por contribuir! Cada contribuição, por menor que seja, faz diferença.

---

**Última atualização:** 11/11/2025
