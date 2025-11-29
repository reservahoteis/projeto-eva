# Guia de Configuracao da Chave SSH para GitHub Actions

## Problema Identificado

O erro `Load key "/home/runner/.ssh/deploy_key": error in libcrypto` ocorre quando a chave SSH no GitHub Secret esta corrompida ou mal formatada devido a:
- Espacos extras ao copiar/colar
- Line breaks incorretos (CRLF vs LF)
- Caracteres especiais corrompidos
- Chave incompleta

## Solucao Implementada

O workflow foi atualizado para aceitar **DUAS opcoes** de formato de chave:

### OPCAO 1: Chave em Formato Base64 (RECOMENDADO)

**Vantagens:**
- Evita problemas de line breaks
- Seguro para copiar/colar
- Sem risco de corrupcao de caracteres especiais

**Como configurar:**

1. **Conecte ao VPS e obtenha a chave em base64:**
   ```bash
   ssh root@72.61.39.235
   base64 -w 0 ~/.ssh/github_actions_deploy
   ```

2. **Copie a saida (uma UNICA linha):**
   ```
   LS0tLS1CRUdJTiBPUEVOU1NIIFBSSVZBVEUgS0VZLS0tLS0KYjNCbGJuTnphQzFyWlhrdGRqRUFBQUFBQkc1dmJtVUFBQUFFYm05dVpRQUFBQUFBQUFBQkFBQUFNd0FBQUF0emMyZ3RaVwpReU5UVXhPUUFBQUNBREZLdm8wN21WZHNXNDNHV3Y3Z3ltcTJTSS8vZ0lkTjB0VWJJV0JmWmdNd0FBQUppWnAyam5tYWRvCjV3QUFBQXR6YzJndFpXUXlOVFV4T1FBQUFDQURGS3ZvMDdtVmRzVzQzR1d2N2d5bXEyU0kvL2dJZE4wdFViSVdCZlpnTXcKQUFBRUJSdXdpMHVRMGdKM3FSckJ0L25ncFc3UUFoM3FyT2pmeFVxdzlyQ3d1YjZRTVVxK2pUdVpWMnhiamNaYS91REthcgpaSWovK0FoMDNTMVJzaFlGOW1BekFBQUFGV2RwZEdoMVlpMWhZM1JwYjI1ekxXUmxjR3h2ZVE9PQotLS0tLUVORCBPUEVOU1NIIFBSSVZBVEUgS0VZLS0tLS0K
   ```

3. **Configure o GitHub Secret:**
   - Va para: https://github.com/seu-usuario/seu-repo/settings/secrets/actions
   - Edite o secret `VPS_SSH_KEY`
   - Cole a string base64 COMPLETA (tudo em uma linha)
   - Salve

### OPCAO 2: Chave em Formato Raw (OpenSSH Padrao)

**Vantagens:**
- Formato padrao OpenSSH
- Mais facil de entender visualmente

**Como configurar:**

1. **Conecte ao VPS e obtenha a chave RAW:**
   ```bash
   ssh root@72.61.39.235
   cat ~/.ssh/github_actions_deploy
   ```

2. **Copie a saida EXATA (incluindo BEGIN/END):**
   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
   QyNTUxOQAAACADFKvo07mVdsW43GWv7gymq2SI//gIdN0tUbIWBfZgMwAAAJiZp2jnmado
   5wAAAAtzc2gtZWQyNTUxOQAAACADFKvo07mVdsW43GWv7gymq2SI//gIdN0tUbIWBfZgMw
   AAAEBRuwi0uQ0gJ3qRrBt/ngpW7QAh3qrOjfxUqw9rCwub6QMUq+jTuZV2xbjcZa/uDKar
   ZIj/+Ah03S1RshYF9mAzAAAAFWdpdGh1Yi1hY3Rpb25zLWRlcGxveQ==
   -----END OPENSSH PRIVATE KEY-----
   ```

3. **IMPORTANTE - Como copiar corretamente:**
   - Use `cat` para exibir (NUNCA use `nano` ou editor de texto)
   - Selecione TODO o texto (incluindo as linhas BEGIN e END)
   - Copie com Ctrl+C (ou cmd+C no Mac)
   - NAO adicione espacos ou linhas extras
   - NAO modifique nenhum caractere

4. **Configure o GitHub Secret:**
   - Va para: https://github.com/seu-usuario/seu-repo/settings/secrets/actions
   - Edite o secret `VPS_SSH_KEY`
   - Cole EXATAMENTE como copiou
   - Salve

## Verificacao da Configuracao

Apos atualizar o secret, o workflow ira:

1. Detectar automaticamente se a chave esta em base64 ou formato raw
2. Decodificar se necessario
3. Validar o formato da chave com `ssh-keygen -l`
4. Testar a conexao SSH antes de prosseguir

Se houver erro, voce vera uma mensagem clara:
```
::error::Invalid SSH key format. Please check VPS_SSH_KEY secret.
```

## Informacoes da Chave Atual

**Tipo:** ED25519 (mais seguro que RSA)
**Localizacao no VPS:** `/root/.ssh/github_actions_deploy`
**Chave publica:**
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAMUq+jTuZV2xbjcZa/uDKarZIj/+Ah03S1RshYF9mAz github-actions-deploy
```

**Status:** Chave publica configurada corretamente em `/root/.ssh/authorized_keys`

## Troubleshooting

### Erro: "Permission denied (publickey,password)"

**Causa:** Chave privada corrompida ou mal formatada
**Solucao:** Use a OPCAO 1 (base64) para evitar problemas de encoding

### Erro: "Invalid key format"

**Causa:** Chave incompleta ou com caracteres extras
**Solucao:**
1. Copie novamente usando `cat` (nao editor de texto)
2. Verifique se incluiu as linhas BEGIN/END
3. Use base64 se o problema persistir

### Erro: "Host key verification failed"

**Causa:** VPS nao esta em known_hosts
**Solucao:** O workflow ja adiciona automaticamente com `ssh-keyscan`

## Regenerar Par de Chaves (Se Necessario)

Se a chave estiver definitivamente corrompida, regenere:

```bash
ssh root@72.61.39.235

# Backup da chave antiga
mv ~/.ssh/github_actions_deploy ~/.ssh/github_actions_deploy.old
mv ~/.ssh/github_actions_deploy.pub ~/.ssh/github_actions_deploy.pub.old

# Gerar nova chave ED25519
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy -N ""

# Adicionar ao authorized_keys
cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys

# Obter chave em base64 para GitHub
base64 -w 0 ~/.ssh/github_actions_deploy
```

## Proximos Passos

1. Escolha OPCAO 1 (base64) ou OPCAO 2 (raw)
2. Copie a chave seguindo as instrucoes acima
3. Atualize o secret `VPS_SSH_KEY` no GitHub
4. Faca um commit qualquer para testar o deploy automatico
5. Verifique o log do workflow em: https://github.com/seu-usuario/seu-repo/actions

## Arquivos Modificados

- `.github/workflows/deploy-production.yml`: Atualizado para aceitar ambos formatos
- `docs/SSH-KEY-SETUP-GUIDE.md`: Este guia

## Contato

Se o problema persistir, verifique:
- Permissoes do arquivo de chave (deve ser 600)
- Conectividade SSH manual: `ssh -i chave root@72.61.39.235`
- Logs do GitHub Actions para erros especificos
