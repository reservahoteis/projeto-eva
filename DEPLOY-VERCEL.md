# 🚀 Deploy do Frontend na Vercel

Este guia contém todas as configurações necessárias para fazer o deploy do frontend na Vercel.

## 📋 Pré-requisitos

- Conta na Vercel
- Projeto já importado do GitHub
- Backend configurado na VPS (URL da API)

---

## ⚙️ Configurações do Projeto na Vercel

### 1️⃣ **Framework Preset**
```
Next.js
```

### 2️⃣ **Root Directory**
```
apps/frontend
```
⚠️ **IMPORTANTE**: Marque a opção "Include source files outside of the Root Directory in the Build Step"

### 3️⃣ **Build Command**
```bash
pnpm install && pnpm build
```

### 4️⃣ **Output Directory**
```
.next
```
(Deixe como padrão do Next.js)

### 5️⃣ **Install Command**
```bash
pnpm install
```

---

## 🔐 Environment Variables (Variáveis de Ambiente)

Configure as seguintes variáveis na seção "Environment Variables" da Vercel:

### **NEXT_PUBLIC_API_URL**
- **Descrição**: URL do backend (API)
- **Valor para produção**: `https://sua-api.dominio.com`
- **Exemplo**: `https://api.projeto-eva.com.br`
- ⚠️ **Atenção**: Use a URL da sua VPS onde o backend estará rodando

### **NEXT_PUBLIC_WS_URL**
- **Descrição**: URL do WebSocket para mensagens em tempo real
- **Valor para produção**: `https://sua-api.dominio.com`
- **Exemplo**: `https://api.projeto-eva.com.br`
- ⚠️ **Atenção**: Mesma URL do backend

### **NODE_ENV** (Opcional)
- **Valor**: `production`
- ℹ️ A Vercel já configura isso automaticamente

---

## 📝 Resumo das Configurações

| Campo | Valor |
|-------|-------|
| **Framework** | Next.js |
| **Root Directory** | `apps/frontend` |
| **Build Command** | `pnpm install && pnpm build` |
| **Output Directory** | `.next` |
| **Install Command** | `pnpm install` |
| **Node Version** | 20.x (automático) |

---

## 🔄 Passo a Passo no Painel da Vercel

1. **Import Project** → Selecione o repositório `fredcast/projeto-eva`

2. **Configure Project**:
   - Framework Preset: `Next.js`
   - Root Directory: `apps/frontend` ✅ marcar "Include source files..."

3. **Build and Output Settings**:
   - Build Command: `pnpm install && pnpm build`
   - Output Directory: `.next`
   - Install Command: `pnpm install`

4. **Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL = https://sua-api.dominio.com
   NEXT_PUBLIC_WS_URL = https://sua-api.dominio.com
   ```

5. Clique em **Deploy** 🚀

---

## ✅ Verificações Pós-Deploy

Após o deploy, verifique:

1. ✅ Build concluído com sucesso
2. ✅ Frontend acessível na URL da Vercel
3. ✅ Página de login carregando corretamente
4. ✅ Console do navegador sem erros de CORS
5. ⚠️ API ainda não conectará até o backend estar na VPS

---

## 🐛 Troubleshooting

### Erro: "No Output Directory named '.next' found"
- Verifique se o Root Directory está configurado como `apps/frontend`
- Confirme que marcou "Include source files outside of the Root Directory"

### Erro de Build: "Command 'pnpm' not found"
- A Vercel detecta automaticamente o pnpm pelo `pnpm-lock.yaml`
- Verifique se o arquivo está commitado no repositório

### Erro de Build: Dependências não encontradas
- Certifique-se de que o `pnpm-workspace.yaml` está na raiz
- Verifique se todos os `package.json` estão commitados

### CORS Error no frontend
- Normal enquanto o backend não estiver configurado
- Será resolvido quando configurar o backend na VPS com a URL correta

---

## 📦 Estrutura do Monorepo

```
projeto-hoteis-reserva/
├── apps/
│   ├── frontend/          ← Deploy na Vercel
│   │   ├── src/
│   │   ├── package.json
│   │   └── next.config.mjs
│   └── backend/           ← Deploy na VPS (próximo passo)
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
└── vercel.json           ← Configuração criada
```

---

## 🎯 Próximos Passos

Após o deploy do frontend:

1. ✅ Frontend na Vercel
2. ⏭️ Deploy do Backend na VPS
3. ⏭️ Configurar domínio customizado
4. ⏭️ Configurar SSL no backend
5. ⏭️ Atualizar variáveis de ambiente com URL final
6. ⏭️ Testar integração completa

---

## 💡 Dicas

- Use o ambiente de **Preview** da Vercel para testar mudanças
- Configure **Production** e **Preview** environments separadamente
- Mantenha as variáveis sensíveis seguras
- Após configurar o backend, atualize as variáveis de ambiente

---

## 📞 Comandos Úteis

### Testar build localmente:
```bash
cd apps/frontend
pnpm install
pnpm build
pnpm start
```

### Limpar cache e reinstalar:
```bash
pnpm clean
pnpm install
```

---

**✅ Configuração concluída!** O projeto está pronto para deploy na Vercel.
