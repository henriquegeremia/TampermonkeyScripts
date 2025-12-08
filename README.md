# 🚀 Contextual Perplexity Helper Pro
![henriquegeremiaTampermonkeyScripts_-_Google_Chrome_chrome_zubUofWkn6](https://github.com/user-attachments/assets/034ce538-e102-480e-92c2-98ef924a330b)

Este é um script Tampermonkey projetado para aprimorar sua experiência de navegação em plataformas como Perplexity, YouTube, ChatGPT e Gemini, oferecendo uma Barra de Dock discreta e um "Modo Fantasma" para maior conveniência e funcionalidades de exportação.

## ✨ Recursos

-   **Dock Bar Discreta / Modo Fantasma:** Uma interface minimalista que se integra discretamente à sua navegação, com a opção de um modo fantasma para maior discrição.
-   **Exportação de Conversas:**
    -   **Perplexity:** Exporte a biblioteca de conversas em JSON, CSV ou Markdown. Exporte artigos completos em Markdown.
    -   **ChatGPT:** Exporte conversas em Markdown.
    -   **Gemini:** Exporte conversas em Markdown.
-   **Integração com YouTube:**
    -   Obtenha um resumo ASCII do vídeo, cronologia e insights via Perplexity.
    -   Copie facilmente título e URL do vídeo.
-   **Envio Contextual para Perplexity:**
    -   Envie texto selecionado ou o conteúdo da página atual para o Perplexity para análise.
-   **Atalhos de Teclado:**
    -   `Ctrl+Shift+P`: Alternar a visibilidade do Dock Bar/Painel.
    -   `Ctrl+Shift+E`: Executar a ação de exportação contextual (dependendo da plataforma).

## 📥 Instalação

### Pré-requisitos

-   **Extensão Tampermonkey:** Certifique-se de ter a extensão Tampermonkey instalada em seu navegador (Chrome, Firefox, Edge, etc.).

### Passos da Instalação

1.  **Copie a URL Raw do Script:**
    A URL Raw deste script hospedado no GitHub é:
    `https://raw.githubusercontent.com/henriquegeremia/TampermonkeyScripts/master/Contextual_Perplexity_Helper_Pro_4.1.user.js`
    Copie esta URL.

2.  **Crie um Novo Script no Tampermonkey:**
    -   Abra o dashboard do Tampermonkey no seu navegador.
    -   Clique no ícone **+** ("Create a new script") para criar um novo script.
    -   **Substitua todo o conteúdo** do novo script pelo seguinte cabeçalho, garantindo que as URLs `@require`, `@updateURL` e `@downloadURL` apontem para a URL Raw copiada acima:

    ```javascript
    // ==UserScript==
    // @name         Contextual Perplexity Helper Pro
    // @namespace    http://tampermonkey.net/
    // @version      4.1
    // @description  Dock Bar discreto + Ghost Mode para Perplexity, YouTube, ChatGPT e Gemini
    // @author       User
    // @match        *://*/*
    // @grant        GM_setClipboard
    // @grant        GM_notification
    // @run-at       document-idle
    // @require      https://raw.githubusercontent.com/henriquegeremia/TampermonkeyScripts/master/Contextual_Perplexity_Helper_Pro_4.1.user.js
    // @updateURL    https://raw.githubusercontent.com/henriquegeremia/TampermonkeyScripts/master/Contextual_Perplexity_Helper_Pro_4.1.user.js
    // @downloadURL  https://raw.githubusercontent.com/henriquegeremia/TampermonkeyScripts/master/Contextual_Perplexity_Helper_Pro_4.1.user.js
    // ==/UserScript==
    // O corpo principal do script será carregado via @require
    ```

3.  **Salve o Script:** Salve o novo script no Tampermonkey.

4.  **Habilite Atualizações Automáticas:**
    -   No dashboard do Tampermonkey, vá para Configurações (Settings).
    -   Mude "Config mode" para "Advanced".
    -   Defina "Check for updates every X minutes" (por exemplo, 60 minutos) para que o script seja atualizado automaticamente.

## 💡 Como Usar

Uma vez instalado, o script adicionará uma pequena **Dock Bar** (ou um botão flutuante no "Modo Fantasma") na lateral da sua tela.

-   **Clique na Dock Bar/Botão:** Para abrir o painel de ferramentas, que oferece opções contextualizadas para a página atual.
-   **`Ctrl+Shift+P`:** Use este atalho para alternar rapidamente a visibilidade do painel.
-   **`Ctrl+Shift+E`:** Ativa a função de exportação relevante para a página atual (por exemplo, exporta uma conversa do ChatGPT, ou um artigo do Perplexity).
-   **`Clique direito` na Dock Bar/Botão:** Alterna entre a Dock Bar e o Modo Fantasma.

## 🤝 Contribuição

Este é um projeto pessoal, mas sinta-se à vontade para adaptá-lo às suas necessidades.

## 📄 Licença

[Em breve, ou mencione se não houver licença específica]
