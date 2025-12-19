(function () {
    'use strict';

    // Configurações
    const SCROLL_DELAY = 3000; // Aumentado para dar mais tempo ao YouTube renderizar
    const MAX_NO_CHANGE_ATTEMPTS = 3; // Tentativas antes de assumir que chegou ao fim

    // Estado
    let isScraping = false;

    // Criar UI
    function createUI() {
        // Remove UI antiga se existir (útil durante recargas de script)
        const oldUi = document.getElementById('yt-scraper-ui');
        if (oldUi) oldUi.remove();

        const div = document.createElement('div');
        div.id = 'yt-scraper-ui';
        div.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #1f1f1f;
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 9999;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            border: 1px solid #333;
            font-family: Roboto, Arial, sans-serif;
            font-size: 14px;
            min-width: 200px;
        `;

        div.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #ff0000; font-weight: bold;">YT Scraper</h3>
            <div id="yt-scraper-status" style="margin-bottom: 10px; color: #aaa;">Pronto para iniciar</div>
            <div style="display: flex; gap: 5px;">
                <button id="btn-start" style="flex: 1; padding: 8px; cursor: pointer; background: #cc0000; color: white; border: none; border-radius: 4px; font-weight: bold;">Iniciar</button>
                <button id="btn-stop" style="flex: 1; padding: 8px; cursor: pointer; background: #444; color: white; border: none; border-radius: 4px; display: none;">Parar/Baixar</button>
            </div>
        `;

        document.body.appendChild(div);

        document.getElementById('btn-start').addEventListener('click', startProcess);
        document.getElementById('btn-stop').addEventListener('click', stopAndExport);
    }

    // Função Principal de Rolagem
    async function startProcess() {
        isScraping = true;
        const btnStart = document.getElementById('btn-start');
        const btnStop = document.getElementById('btn-stop');
        const statusDiv = document.getElementById('yt-scraper-status');

        btnStart.style.display = 'none';
        btnStop.style.display = 'block';
        statusDiv.innerText = "Iniciando rolagem...";

        let lastHeight = document.documentElement.scrollHeight; // Usando documentElement
        let attempts = 0;

        const scrollLoop = async () => {
            if (!isScraping) return;

            // Estratégia de Rolagem Focada:
            // 1. Tenta achar le spinner de carregamento
            const spinner = document.querySelector('ytd-continuation-item-renderer');
            // 2. Tenta achar o último vídeo renderizado
            const items = document.querySelectorAll('ytd-playlist-video-renderer');

            if (spinner) {
                spinner.scrollIntoView({ behavior: 'auto', block: 'center' });
            } else if (items.length > 0) {
                // Rola até o último vídeo para forçar o trigger de novos itens
                items[items.length - 1].scrollIntoView({ behavior: 'auto', block: 'center' });
            } else {
                // Fallback clássico
                window.scrollTo(0, document.documentElement.scrollHeight);
            }

            statusDiv.innerText = `Rolando... Itens visíveis: ${items.length}`;

            await new Promise(r => setTimeout(r, SCROLL_DELAY));

            // Verificação de progresso
            // Em vez de apenas altura, verificamos também a quantidade de itens
            let newHeight = document.documentElement.scrollHeight;
            let currentItemCount = document.querySelectorAll('ytd-playlist-video-renderer').length;

            // Se a altura não mudou, verifica novamente
            if (newHeight === lastHeight) {
                attempts++;
                statusDiv.innerText = `Verificando novos vídeos (${attempts}/${MAX_NO_CHANGE_ATTEMPTS})...`;

                if (attempts >= MAX_NO_CHANGE_ATTEMPTS) {
                    stopAndExport();
                    return;
                }
            } else {
                attempts = 0;
                lastHeight = newHeight;
            }

            if (isScraping) scrollLoop();
        };

        scrollLoop();
    }

    // Função de Extração e Exportação
    function stopAndExport() {
        isScraping = false;
        const statusDiv = document.getElementById('yt-scraper-status');
        statusDiv.innerText = "Extraindo dados...";

        const videos = document.querySelectorAll('ytd-playlist-video-renderer');
        let csvContent = "\uFEFFTitle;Channel;Duration;Link\n"; // \uFEFF força o Excel a ler UTF-8 corretamente

        videos.forEach(video => {
            try {
                const titleEl = video.querySelector('#video-title');
                const channelEl = video.querySelector('.ytd-channel-name a') || video.querySelector('.ytd-channel-name');
                const durationEl = video.querySelector('#text.ytd-thumbnail-overlay-time-status-renderer');

                // Limpeza de dados
                let title = titleEl ? titleEl.innerText.trim().replace(/"/g, '""') : "N/A";
                let link = titleEl ? titleEl.href.split('&list=')[0] : "N/A"; // Remove o parametro da playlist para pegar o link direto
                let channel = channelEl ? channelEl.innerText.trim() : "N/A";
                let duration = durationEl ? durationEl.innerText.trim() : "N/A";

                // Formatar para CSV (delimitado por ponto e vírgula por causa do Excel em PT-BR)
                csvContent += `"${title}";"${channel}";"${duration}";"${link}"\n`;

            } catch (e) {
                console.error("Erro ao processar vídeo:", e);
            }
        });

        downloadCSV(csvContent);

        // Reset UI
        document.getElementById('btn-start').style.display = 'block';
        document.getElementById('btn-stop').style.display = 'none';
        statusDiv.innerText = `Concluído! ${videos.length} vídeos exportados.`;
    }

    function downloadCSV(csvContent) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `youtube_watch_later_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Inicializar quando a página carregar
    window.addEventListener('load', () => {
        // Pequeno delay para garantir que o YouTube carregou o básico
        setTimeout(createUI, 2000);
    });

})();
