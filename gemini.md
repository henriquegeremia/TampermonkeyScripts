# 📦 Instruções para Criação de Pacotes Tampermonkey (Loader + Core)

Baseado no padrão utilizado nos scripts deste repositório, siga este guia para criar e distribuir seus scripts de forma modular.

## 🏗️ Estrutura do Pacote

O sistema utiliza dois arquivos principais:

1. **Loader (`Nome_Do_Script_Loader.user.js`)**: O arquivo que o usuário instala no Tampermonkey. Ele contém apenas o cabeçalho de metadados.
2. **Core (`Nome_Do_Script_Core.js`)**: O arquivo que contém a lógica real do script, carregado dinamicamente.

## 📝 Cabeçalho do Loader (Exemplo)

```javascript
// ==UserScript==
// @name         Nome Do Script
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Descrição do que o script faz
// @author       Seu Nome
// @match        *://*/*
// @grant        GM_setClipboard
// @grant        GM_notification
// @run-at       document-idle
// @require      https://raw.githubusercontent.com/USUARIO/REPO/master/Nome_Do_Script_Core.js
// @updateURL    https://raw.githubusercontent.com/USUARIO/REPO/master/Nome_Do_Script_Loader.user.js
// @downloadURL  https://raw.githubusercontent.com/USUARIO/REPO/master/Nome_Do_Script_Loader.user.js
// ==/UserScript==

// O corpo deste arquivo deve ficar vazio ou conter apenas uma IIFE mínima.
(function() {
    'use strict';
})();
```

## 🚀 Vantagens deste Padrão

- **Atualização em Tempo Real**: Você pode atualizar o código no GitHub (Core) e os usuários receberão a atualização sem precisar reinstalar o script (dependendo do cache do browser).
- **Organização**: Separa os metadados da lógica, facilitando a manutenção de scripts grandes.
- **Versatilidade**: Permite usar ferramentas de build locais (como Webpack ou Vite) para gerar o arquivo Core, enquanto o Loader permanece simples.

## 🛠️ Como Publicar e Manter

1. **Push Inicial**: Dê push em ambos os arquivos para o GitHub.
2. **URLs Raw**: Obtenha a URL **Raw** de ambos os arquivos.
3. **Configuração**:
   - No Loader, aponte o `@require` para a URL Raw do seu arquivo **Core**.
   - Aponte o `@updateURL` e `@downloadURL` para a URL Raw do próprio arquivo **Loader**.
4. **Instalação**: Distribua o link da URL Raw do **Loader** para que os usuários o instalem clicando em "Install".

### 🔄 Regra Procedural de Sincronização
>
> [!IMPORTANT]
> **Sempre sincronize após editar!** Como a GUI do Tampermonkey lê a lógica via `@require` apontando para o repositório remoto (GitHub Raw), as alterações feitas localmente **só terão efeito** no navegador após você realizar o `git push`.
>
> **Fluxo obrigatório:** Editar `Core.js` ➡️ `git add/commit/push` ➡️ Testar no Browser.

---
> [!NOTE]
> Para testes locais sem precisar de push constante, você pode temporariamente usar o protocolo `file:///` no `@require`, mas lembre-se de habilitar o "Acesso a URLs de arquivo" nas configurações da extensão Tampermonkey e reverter para a URL do GitHub antes da publicação final.
