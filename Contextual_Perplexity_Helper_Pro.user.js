// ==UserScript==
// @name         Contextual Perplexity Helper Pro
// @namespace    http://tampermonkey.net/
// @version      4.5
// @description  Dock Bar discreto + Ghost Mode para Perplexity, YouTube, ChatGPT e Gemini
// @author       User
// @match        *://*/*
// @grant        GM_setClipboard
// @grant        GM_notification
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ========== CONFIGURAÇÃO ========== 
    const CONFIG = {
        version: '4.5', // Adicionado: Versão do script
        perplexityDomain: 'perplexity.ai',
        youtubeDomain: 'youtube.com',
        chatgptDomain: 'chatgpt.com',
        geminiDomain: 'gemini.google.com',
        maxTextLength: 5000,
        debounceDelay: 300,
        autoHideDelay: 5000, // 5s para auto-hide
        shortcuts: {
            toggle: 'KeyP',
            export: 'KeyE'
        }
    };

    // ========== OBSERVADOR DE URL ========== 
    let lastUrl = location.href;
    let urlChangeObserver = null;

    function observeUrlChange(callback) {
        urlChangeObserver = new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                callback();
            }
        });
        urlChangeObserver.observe(document.querySelector('title'), {
            childList: true,
            subtree: true
        });

        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function(...args) {
            originalPushState.apply(this, args);
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                callback();
            }
        };

        history.replaceState = function(...args) {
            originalReplaceState.apply(this, args);
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                callback();
            }
        };

        window.addEventListener('popstate', () => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                callback();
            }
        });
    }

    // ========== UTILITÁRIOS ========== 
    const Utils = {
        isDarkMode() {
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const bodyDark = document.body.classList.contains('dark') ||
                           document.documentElement.classList.contains('dark');
            return systemDark || bodyDark;
        },

        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        sanitizeText(text) {
            if (!text || typeof text !== 'string') return '';
            return text.trim().substring(0, CONFIG.maxTextLength);
        },

        sanitizeFileName(name) {
            return name.replace(/[\\/:"*?<>|]/g, '_')
                      .replace(/\s+/g, '_')
                      .substring(0, 100);
        },

        showToast(message, type = 'info') {
            const colors = {
                info: '#007bff',
                success: '#28a745',
                error: '#dc3545',
                warning: '#ffc107'
            };

            const toast = document.createElement('div');
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: ${colors[type]};
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 2147483647;
                font-family: sans-serif;
                font-size: 14px;
                animation: slideUp 0.3s ease-out;
            `;

            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideUp {
                    from { bottom: -50px; opacity: 0; }
                    to { bottom: 20px; opacity: 1; }
                }
            `;
            if (!document.getElementById('toast-style')) {
                style.id = 'toast-style';
                document.head.appendChild(style);
            }

            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.3s';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        },

        downloadFile(content, filename, mimeType = 'text/markdown') {
            const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        copyToClipboard(text) {
            if (typeof GM_setClipboard !== 'undefined') {
                GM_setClipboard(text);
            } else {
                navigator.clipboard.writeText(text).catch(() => {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                });
            }
        },

        saveDockState(state) {
            localStorage.setItem('perplexity-helper-dock-state', JSON.stringify(state));
        },

        loadDockState() {
            try {
                return JSON.parse(localStorage.getItem('perplexity-helper-dock-state') || '{}');
            } catch {
                return {};
            }
        },

        // New utility function to find the main scrollable element
        findScrollableElement() {
            // 1. Prioritize document.scrollingElement for modern browsers (usually html)
            if (document.scrollingElement && document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight) {
                return document.scrollingElement;
            }

            // 2. Look for elements explicitly marked as scrollable by CSS (e.g., Tailwind's overflow-y-auto)
            // This is a common pattern for frameworks that create custom scroll containers.
            const potentialCssScrollables = document.querySelectorAll('[style*="overflow-y: auto"], [style*="overflow-y: scroll"], [class*="overflow-y-auto"], [class*="overflow-y-scroll"]');
            for (const el of potentialCssScrollables) {
                if (el.scrollHeight > el.clientHeight) {
                    return el;
                }
            }

            // 3. Fallback: Check if html or body is truly scrollable (when content overflows)
            const isHtmlScrollable = document.documentElement.scrollHeight > document.documentElement.clientHeight;
            const isBodyScrollable = document.body.scrollHeight > document.body.clientHeight;

            if (isHtmlScrollable && window.getComputedStyle(document.documentElement).overflowY !== 'hidden') {
                return document.documentElement;
            }
            if (isBodyScrollable && window.getComputedStyle(document.body).overflowY !== 'hidden') {
                return document.body;
            }
            
            // 4. Last resort: Iterate common container elements and check if they are scrollable
            // This is a more general approach if document.scrollingElement doesn't work and no explicit CSS classes are found.
            const commonContainerTags = ['div', 'main', 'section', 'article', 'aside'];
            for (const tag of commonContainerTags) {
                const elements = document.getElementsByTagName(tag);
                for (const el of elements) {
                    const computedStyle = window.getComputedStyle(el);
                    if ((computedStyle.overflowY === 'auto' || computedStyle.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
                        // Check if it's visible and has significant size to avoid tiny hidden scrollables
                        const rect = el.getBoundingClientRect();
                        if (rect.height > 100 && rect.width > 100) { // arbitrary size check
                            return el;
                        }
                    }
                }
            }

            return null; // No suitable scrollable element found
        }
    };

    // ========== DETECÇÃO DE CONTEXTO ========== 
    const Context = {
        isPerplexity() {
            return window.location.hostname.includes(CONFIG.perplexityDomain);
        },

        isLibrary() {
            return this.isPerplexity() && window.location.pathname.includes('/library');
        },

        isArticle() {
            return this.isPerplexity() && window.location.pathname.includes('/search');
        },

        isYouTube() {
            return window.location.hostname.includes(CONFIG.youtubeDomain) &&
                   window.location.pathname.includes('/watch');
        },

        isChatGPT() {
            return window.location.hostname.includes(CONFIG.chatgptDomain);
        },

        isGemini() {
            return window.location.hostname.includes(CONFIG.geminiDomain);
        },

        isExternal() {
            return !this.isPerplexity() && !this.isYouTube() && !this.isChatGPT() && !this.isGemini();
        },

        getType() {
            if (this.isLibrary()) return 'library';
            if (this.isArticle()) return 'article';
            if (this.isYouTube()) return 'youtube';
            if (this.isChatGPT()) return 'chatgpt';
            if (this.isGemini()) return 'gemini';
            if (this.isExternal()) return 'external';
            return 'unknown';
        }
    };

    // ========== AÇÕES ========== 
    const Actions = {
        async exportLibrary(format = 'json') {
            Utils.showToast('Coletando conversas...', 'info');
            const items = document.querySelectorAll('a[href^="/search/"]');
            if (items.length === 0) {
                Utils.showToast('Nenhuma conversa encontrada', 'warning');
                return;
            }

            const conversations = Array.from(items).map(link => {
                const parent = link.closest('.relative, .flex');
                return {
                    title: link.querySelector('[data-testid^="thread-title"]')?.textContent?.trim() ||
                           link.textContent?.trim() || 'Sem título',
                    url: link.href,
                    description: parent?.querySelector('.text-quiet, .line-clamp-2')?.textContent?.trim() || '',
                    timestamp: new Date().toISOString()
                };
            });

            const timestamp = new Date().toISOString().split('T')[0];
            if (format === 'json') {
                Utils.downloadFile(JSON.stringify(conversations, null, 2), `perplexity-library-${timestamp}.json`, 'application/json');
            } else if (format === 'csv') {
                const csv = ['Título,URL,Descrição', ...conversations.map(c => `"${c.title.replace(/"/g, '""')}","${c.url}","${c.description.replace(/"/g, '""')}"` )].join('\n');
                Utils.downloadFile(csv, `perplexity-library-${timestamp}.csv`, 'text/csv');
            } else if (format === 'md') {
                const md = ['# Biblioteca Perplexity', '', `Exportado em: ${new Date().toLocaleString('pt-BR')}`, `Total: ${conversations.length} conversas`, '', ...conversations.map((c, i) => `## ${i + 1}. ${c.title}\n\n**Link:** ${c.url}\n\n${c.description}\n\n---\n`)].join('\n');
                Utils.downloadFile(md, `perplexity-library-${timestamp}.md`);
            }
            Utils.showToast(`${conversations.length} conversas exportadas!`, 'success');
        },

        async autoScrollLibrary() {
            Utils.showToast('Iniciando rolagem automática...', 'info');
            console.log('Auto-scroll started.');
            let lastCount = 0;
            let stableCount = 0;

            const scrollableElement = Utils.findScrollableElement();
            if (!scrollableElement) {
                Utils.showToast('Erro: Não foi possível encontrar um elemento rolável.', 'error');
                console.error('Auto-scroll failed: No scrollable element found.');
                return;
            }
            console.log('Scrollable element identified:', scrollableElement, 'Tag:', scrollableElement.tagName, 'ID:', scrollableElement.id, 'Class:', scrollableElement.className);

            for (let i = 0; i < 100; i++) {
                const scrollHeight = scrollableElement.scrollHeight;
                const clientHeight = scrollableElement.clientHeight;
                const currentScrollY = scrollableElement.scrollTop; // Use scrollTop for element scrolling

                console.log(`Iteration ${i + 1}:`);
                console.log(`  Scroll Height: ${scrollHeight}, Client Height: ${clientHeight}, Current Scroll Top: ${currentScrollY}`);

                // Scroll the identified element
                scrollableElement.scrollTo(0, scrollHeight);
                console.log(`  Scrolled element to: ${scrollHeight}`);

                await new Promise(r => setTimeout(r, 1500));

                const currentCount = document.querySelectorAll('a[href^="/search/"]').length;
                console.log(`  Previous Count: ${lastCount}, Current Conversations Count: ${currentCount}`);

                if (currentCount === lastCount) {
                    stableCount++;
                    console.log(`  Stable Count: ${stableCount}`);
                    if (stableCount >= 3) {
                        console.log('  Content count stable for 3 iterations. Stopping scroll.');
                        break;
                    }
                } else {
                    stableCount = 0;
                    console.log('  New content detected, stable count reset.');
                }
                lastCount = currentCount;
            }
            console.log('Auto-scroll finished.');
            Utils.showToast(`Rolagem concluída! ${lastCount} conversas carregadas`, 'success');
        },

        exportArticleMarkdown() {
            Utils.showToast('Exportando artigo completo...', 'info');
            const titleEl = document.querySelector('[data-testid*="thread-title"], h1.font-display, h1, .text-3xl');
            const contentEl = document.querySelector('main[class*="ThreadContent"], [class*="thread-content"], main, article');
            const title = titleEl?.textContent?.trim() || document.title.replace(' | Perplexity', '');
            let content = '';
            if (contentEl) {
                const messageBlocks = contentEl.querySelectorAll('[class*="message"], [class*="answer"], [class*="query"]');
                if (messageBlocks.length > 0) {
                    messageBlocks.forEach((block, idx) => {
                        const text = block.innerText?.trim();
                        if (text) content += `\n## Seção ${idx + 1}\n\n${text}\n\n`;
                    });
                } else {
                    content = contentEl.innerText;
                }
            } else {
                content = document.body.innerText;
            }
            const markdown = [`# ${title}`, '', `**Fonte:** ${window.location.href}`, `**Exportado:** ${new Date().toLocaleString('pt-BR')}`, '', '---', '', content.trim()].join('\n');
            const filename = `perplexity-${Utils.sanitizeFileName(title)}.md`;
            Utils.downloadFile(markdown, filename);
            Utils.showToast('Artigo exportado com sucesso!', 'success');
        },

        exportChatGPTConversation() {
            Utils.showToast('Exportando conversa do ChatGPT...', 'info');
            const titleEl = document.querySelector('h1, [class*="text-2xl"]');
            const title = titleEl?.textContent?.trim() || 'ChatGPT Conversa';
            const messages = [];
            const messageElements = document.querySelectorAll('[data-message-author-role], [class*="group"]');
            messageElements.forEach(el => {
                const role = el.getAttribute('data-message-author-role') || (el.textContent.includes('You') ? 'user' : 'assistant');
                const content = el.querySelector('[class*="markdown"], [class*="prose"]')?.innerText || el.innerText;
                if (content && content.trim().length > 0) {
                    messages.push({ role, content: content.trim() });
                }
            });
            const markdown = [`# ${title}`, '', `**Exportado de:** ChatGPT`, `**Data:** ${new Date().toLocaleString('pt-BR')}`, `**URL:** ${window.location.href}`, '', '---', '', ...messages.map(msg => {
                const speaker = msg.role === 'user' ? '### 👤 Você' : '### 🤖 ChatGPT';
                return `${speaker}\n\n${msg.content}\n\n---\n`;
            })].join('\n');
            const filename = `chatgpt-${Utils.sanitizeFileName(title)}.md`;
            Utils.downloadFile(markdown, filename);
            Utils.showToast('Conversa exportada!', 'success');
        },

        exportGeminiConversation() {
            Utils.showToast('Exportando conversa do Gemini...', 'info');
            const title = document.title.replace(' - Gemini', '') || 'Gemini Conversa';
            const messages = [];
            const chatContainer = document.querySelector('[class*="conversation"], [class*="chat"]') || document.body;
            const messageElements = chatContainer.querySelectorAll('[class*="message"], [class*="response"], [data-role]');
            messageElements.forEach(el => {
                const isUser = el.classList.toString().includes('user') || el.getAttribute('data-role') === 'user' || el.querySelector('[class*="user"]');
                const content = el.innerText?.trim();
                if (content && content.length > 10) {
                    messages.push({ role: isUser ? 'user' : 'assistant', content });
                }
            });
            if (messages.length === 0) {
                const allText = chatContainer.innerText;
                messages.push({ role: 'full', content: allText });
            }
            const markdown = [`# ${title}`, '', `**Exportado de:** Google Gemini`, `**Data:** ${new Date().toLocaleString('pt-BR')}`, `**URL:** ${window.location.href}`, '', '---', '', ...messages.map(msg => {
                if (msg.role === 'full') return msg.content;
                const speaker = msg.role === 'user' ? '### 👤 Você' : '### ✨ Gemini';
                return `${speaker}\n\n${msg.content}\n\n---\n`;
            })].join('\n');
            const filename = `gemini-${Utils.sanitizeFileName(title)}.md`;
            Utils.downloadFile(markdown, filename);
            Utils.showToast('Conversa exportada!', 'success');
        },

        youtubeVideoSummary() {
            const titleEl = document.querySelector('h1.ytd-watch-metadata, h1.title, yt-formatted-string.ytd-watch-metadata');
            const title = titleEl?.textContent?.trim() || document.title.replace(' - YouTube', '');
            const url = window.location.href;
            const clipboardText = `${title}\n${url}`;
            Utils.copyToClipboard(clipboardText);
            const prompt = `Analise este vídeo do YouTube e forneça:\n\n1. Resumo esquemático com diagrama ASCII dos principais conceitos\n2. Cronologia enxuta dos temas abordados no vídeo\n3. Principais insights e conclusões\n\nVídeo: "${title}"\nURL: ${url}`;
            Utils.showToast('URL e título copiados!', 'success');
            const perplexityUrl = `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`;
            window.open(perplexityUrl, '_blank');
        },

        copyYoutubeInfo() {
            const titleEl = document.querySelector('h1.ytd-watch-metadata, h1.title, yt-formatted-string.ytd-watch-metadata');
            const title = titleEl?.textContent?.trim() || document.title.replace(' - YouTube', '');
            const url = window.location.href;
            const info = `Título: ${title}\nURL: ${url}`;
            Utils.copyToClipboard(info);
            Utils.showToast('Informações copiadas!', 'success');
        },

        sendToPerplexity(prompt, pageContext = false) {
            let finalPrompt = prompt;
            if (pageContext) {
                const pageTitle = document.title;
                const pageUrl = window.location.href;
                finalPrompt = `${prompt}\n\nContexto: "${pageTitle}"\nURL: ${pageUrl}`;
            }
            const sanitized = Utils.sanitizeText(finalPrompt);
            const url = `https://www.perplexity.ai/search?q=${encodeURIComponent(sanitized)}`;
            window.open(url, '_blank');
            Utils.showToast('Abrindo Perplexity...', 'info');
        },

        sendSelectedText() {
            const selection = Utils.sanitizeText(window.getSelection().toString());
            if (!selection) {
                Utils.showToast('Nenhum texto selecionado', 'warning');
                return;
            }
            if (selection.length < 10) {
                Utils.showToast('Selecione mais texto (mínimo 10 caracteres)', 'warning');
                return;
            }
            const prompt = `Analise e responda sobre este texto:\n\n"${selection}"`;
            Actions.sendToPerplexity(prompt);
        }
    };

    // ========== INTERFACE HÍBRIDA ========== 
    class HybridPanel {
        constructor() {
            this.dockBar = null;
            this.ghostButton = null;
            this.panel = null;
            this.selectionBtn = null;
            this.isExpanded = false;
            this.isGhostMode = false;
            this.autoHideTimeout = null;
            this.contextType = Context.getType();
            this.dockState = Utils.loadDockState();
        }

        destroy() {
            if (this.dockBar) this.dockBar.remove();
            if (this.ghostButton) this.ghostButton.remove();
            if (this.panel) this.panel.remove();
            if (this.selectionBtn) this.selectionBtn.remove();
            clearTimeout(this.autoHideTimeout);
        }

        recreate() {
            this.destroy();
            this.contextType = Context.getType();
            this.dockState = Utils.loadDockState();
            this.create();
        }

        create() {
            this.addGlobalStyles();
            if (this.dockState.mode === 'ghost') {
                this.createGhostMode();
            } else {
                this.createDockBar();
            }
            this.createPanel();
            if (this.contextType === 'external') {
                this.createSelectionButton();
            }
        }

        addGlobalStyles() {
            if (document.getElementById('hybrid-helper-styles')) return;
            const style = document.createElement('style');
            style.id = 'hybrid-helper-styles';
            style.textContent = `
                @keyframes dockExpand {
                    0% { width: 4px; }
                    100% { width: 52px; }
                }
                @keyframes dockCollapse {
                    0% { width: 52px; }
                    100% { width: 4px; }
                }
                @keyframes ghostReveal {
                    0% { opacity: 0.2; transform: scale(0.8); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes panelSlideIn {
                    from { opacity: 0; transform: translateX(20px) scale(0.95); }
                    to { opacity: 1; transform: translateX(0) scale(1); }
                }
                .dock-expanded { animation: dockExpand 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
                .dock-collapsed { animation: dockCollapse 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
                .ghost-revealed { animation: ghostReveal 0.3s ease-out forwards; }
            `;
            document.head.appendChild(style);
        }

        createDockBar() {
            this.dockBar = document.createElement('div');
            const emoji = this.getEmoji();
            this.dockBar.innerHTML = `<span style="opacity: 0;">${emoji}</span>`;
            this.dockBar.className = 'dock-bar';
            this.dockBar.setAttribute('aria-label', 'Perplexity Helper');
            this.dockBar.style.cssText = `
                position: fixed;
                right: 0;
                top: 50%;
                transform: translateY(-50%);
                width: 4px;
                height: 80px;
                background: linear-gradient(180deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.8) 100%);
                border-radius: 4px 0 0 4px;
                cursor: pointer;
                z-index: 2147483646;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            `;

            let expandTimeout;
            this.dockBar.onmouseenter = () => {
                clearTimeout(expandTimeout);
                this.dockBar.classList.remove('dock-collapsed');
                this.dockBar.classList.add('dock-expanded');
                this.dockBar.querySelector('span').style.opacity = '1';
            };

            this.dockBar.onmouseleave = () => {
                expandTimeout = setTimeout(() => {
                    this.dockBar.classList.remove('dock-expanded');
                    this.dockBar.classList.add('dock-collapsed');
                    this.dockBar.querySelector('span').style.opacity = '0';
                }, 1000);
            };

            this.dockBar.onclick = (e) => {
                e.stopPropagation();
                this.toggle();
            };

            this.dockBar.oncontextmenu = (e) => {
                e.preventDefault();
                this.switchToGhostMode();
            };

            document.body.appendChild(this.dockBar);
        }

        createGhostMode() {
            this.isGhostMode = true;
            this.ghostButton = document.createElement('button');
            const emoji = this.getEmoji();
            this.ghostButton.innerHTML = emoji;
            this.ghostButton.setAttribute('aria-label', 'Perplexity Helper (Ghost Mode)');
            this.ghostButton.style.cssText = `
                position: fixed;
                bottom: 16px;
                right: 16px;
                width: 28px;
                height: 28px;
                background: rgba(136, 136, 136, 0.6);
                color: white;
                border: none;
                border-radius: 50%;
                font-size: 14px;
                cursor: pointer;
                opacity: 0.25;
                z-index: 2147483646;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            `;

            this.ghostButton.onmouseenter = () => {
                this.ghostButton.style.opacity = '1';
                this.ghostButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                this.ghostButton.style.transform = 'scale(1.15)';
                this.ghostButton.classList.add('ghost-revealed');
            };

            this.ghostButton.onmouseleave = () => {
                this.ghostButton.style.opacity = '0.25';
                this.ghostButton.style.background = 'rgba(136, 136, 136, 0.6)';
                this.ghostButton.style.transform = 'scale(1)';
            };

            this.ghostButton.onclick = () => this.toggle();
            this.ghostButton.oncontextmenu = (e) => {
                e.preventDefault();
                this.switchToDockMode();
            };

            document.body.appendChild(this.ghostButton);
        }

        switchToGhostMode() {
            Utils.saveDockState({ mode: 'ghost' });
            if (this.dockBar) this.dockBar.remove();
            this.createGhostMode();
            Utils.showToast('👻 Modo Ghost ativado (Ctrl+clique para voltar)', 'info');
        }

        switchToDockMode() {
            Utils.saveDockState({ mode: 'dock' });
            if (this.ghostButton) this.ghostButton.remove();
            this.createDockBar();
            Utils.showToast('📱 Dock Bar ativado (Ctrl+clique para Ghost)', 'info');
        }

        createPanel() {
            this.panel = document.createElement('div');
            this.panel.id = 'hybrid-helper-panel';
            this.panel.setAttribute('role', 'dialog');
            this.panel.style.cssText = `
                position: fixed;
                bottom: 90px;
                right: 24px;
                width: 280px;
                max-height: 70vh;
                background: ${Utils.isDarkMode() ? '#1a1d23' : '#ffffff'};
                color: ${Utils.isDarkMode() ? '#e4e4e7' : '#18181b'};
                border: 1px solid ${Utils.isDarkMode() ? '#3a3f4b' : '#e5e7eb'};
                box-shadow: 0 12px 40px rgba(0,0,0,0.25);
                border-radius: 16px;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                z-index: 2147483645;
                display: none;
                overflow: hidden;
            `;

            const header = document.createElement('div');
            header.style.cssText = `padding: 16px; border-bottom: 1px solid ${Utils.isDarkMode() ? '#2d313b' : '#e5e7eb'};`;
            header.innerHTML = `
                <div style="display: flex; align-items: center;">
                    <span style="font-size: 20px; margin-right: 8px;">${this.getEmoji()}</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 14px; color: ${Utils.isDarkMode() ? '#93e1d8' : '#20808d'};">Helper Pro v${CONFIG.version}</div>
                        <div style="font-size: 11px; color: ${Utils.isDarkMode() ? '#9ca3af' : '#6b7280'};">${this.getContextLabel()}</div>
                    </div>
                    <button id="dock-close" style="background: none; border: none; font-size: 18px; cursor: pointer; color: ${Utils.isDarkMode() ? '#9ca3af' : '#6b7280'}; padding: 4px;">✕</button>
                </div>
            `;
            this.panel.appendChild(header);

            const content = document.createElement('div');
            content.style.cssText = `padding: 12px; max-height: calc(70vh - 120px); overflow-y: auto;`;
            this.addContextButtons(content);
            this.panel.appendChild(content);

            const footer = document.createElement('div');
            footer.style.cssText = `padding: 12px 16px; border-top: 1px solid ${Utils.isDarkMode() ? '#2d313b' : '#e5e7eb'}; font-size: 11px; color: ${Utils.isDarkMode() ? '#6b7280' : '#9ca3af'}; text-align: center;`;
            footer.innerHTML = `<kbd style="padding: 2px 6px; background: ${Utils.isDarkMode() ? '#2d313b' : '#f3f4f6'}; border-radius: 3px;">Ctrl+Shift+P</kbd> Toggle`;
            this.panel.appendChild(footer);

            document.body.appendChild(this.panel);

            document.getElementById('dock-close').onclick = () => this.hide();
        }

        getEmoji() {
            const emojis = { library: '📚', article: '📄', youtube: '🎬', chatgpt: '💬', gemini: '✨', external: '🔮', unknown: '❓' };
            return emojis[this.contextType] || emojis.unknown;
        }

        getContextLabel() {
            const labels = { library: 'Biblioteca', article: 'Artigo', youtube: 'YouTube', chatgpt: 'ChatGPT', gemini: 'Gemini', external: window.location.hostname.substring(0, 20) + (window.location.hostname.length > 20 ? '...' : ''), unknown: 'Desconhecido' };
            return labels[this.contextType] || labels.unknown;
        }

        addContextButtons(container) {
            const createBtn = (text, onClick, color) => {
                const btn = document.createElement('button');
                btn.textContent = text;
                btn.style.cssText = `
                    display: flex; align-items: center; justify-content: center;
                    width: 100%; margin-bottom: 8px; padding: 10px 12px;
                    background: ${color}; border: none; border-radius: 10px;
                    color: white; font-weight: 600; font-size: 12px; cursor: pointer;
                    transition: all 0.2s; box-shadow: 0 2px 8px ${color}40;
                `;
                btn.onmouseenter = () => { btn.style.transform = 'translateY(-2px)'; btn.style.filter = 'brightness(1.1)'; };
                btn.onmouseleave = () => { btn.style.transform = 'translateY(0)'; btn.style.filter = 'brightness(1)'; };
                btn.onclick = () => { onClick(); this.hide(); };
                container.appendChild(btn);
            };

            const actions = {
                library: [
                    ['📥 JSON', () => Actions.exportLibrary('json'), '#0ea5e9'],
                    ['📊 CSV', () => Actions.exportLibrary('csv'), '#8b5cf6'],
                    ['📝 MD', () => Actions.exportLibrary('md'), '#6366f1'],
                    ['↓ Tudo', () => Actions.autoScrollLibrary(), '#10b981']
                ],
                article: [['📥 Artigo', () => Actions.exportArticleMarkdown(), '#0ea5e9']],
                youtube: [['🎯 ASCII', () => Actions.youtubeVideoSummary(), '#ff0000'], ['📋 Info', () => Actions.copyYoutubeInfo(), '#cc0000']],
                chatgpt: [['📥 ChatGPT', () => Actions.exportChatGPTConversation(), '#10a37f']],
                gemini: [['📥 Gemini', () => Actions.exportGeminiConversation(), '#4285f4']],
                external: [
                    ['📊 ASCII', () => Actions.sendToPerplexity('Faça um resumo com diagrama ASCII dos principais conceitos desta página', true), '#06b6d4'],
                    ['📝 Resumo', () => Actions.sendToPerplexity('Faça um resumo simples e direto desta página', true), '#8b5cf6'],
                    ['⭐ Destaques', () => Actions.sendToPerplexity('Liste os principais destaques e pontos importantes desta página', true), '#f59e0b']
                ]
            };

            (actions[this.contextType] || []).forEach(([text, action, color]) => createBtn(text, action, color));
        }

        createSelectionButton() {
            if (this.selectionBtn) return;
            this.selectionBtn = document.createElement('button');
            this.selectionBtn.innerHTML = '🔍';
            this.selectionBtn.style.cssText = `
                position: fixed; bottom: 90px; right: 24px;
                width: 40px; height: 40px; background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white; border: none; border-radius: 50%; font-size: 18px;
                cursor: pointer; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
                z-index: 2147483644; display: none; align-items: center; justify-content: center;
                transition: all 0.3s;
            `;
            this.selectionBtn.onclick = () => Actions.sendSelectedText();
            this.selectionBtn.onmouseenter = () => this.selectionBtn.style.transform = 'scale(1.1)';
            this.selectionBtn.onmouseleave = () => this.selectionBtn.style.transform = 'scale(1)';
            document.body.appendChild(this.selectionBtn);

            const debouncedCheck = Utils.debounce(() => {
                const text = window.getSelection().toString().trim();
                this.selectionBtn.style.display = text.length > 10 ? 'flex' : 'none';
            }, CONFIG.debounceDelay);
            document.addEventListener('selectionchange', debouncedCheck);
        }

        toggle() {
            if (this.isExpanded) {
                this.hide();
            } else {
                this.show();
            }
        }

        show() {
            if (!this.panel) this.createPanel();
            this.panel.style.display = 'block';
            this.isExpanded = true;
            clearTimeout(this.autoHideTimeout);
        }

        hide() {
            if (this.panel) {
                this.panel.style.display = 'none';
                this.isExpanded = false;
                this.startAutoHide();
            }
        }

        startAutoHide() {
            this.autoHideTimeout = setTimeout(() => {
                if (!this.isExpanded) {
                    if (this.isGhostMode && this.ghostButton) {
                        this.ghostButton.style.opacity = '0.25';
                    }
                }
            }, CONFIG.autoHideDelay);
        }
    }

    // ========== INICIALIZAÇÃO ========== 
    let panel = new HybridPanel();

    function init() {
        panel.create();
        console.log('🚀 Hybrid Perplexity Helper v4.1 carregado! Modo:', panel.dockState.mode || 'dock');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    observeUrlChange(() => {
        setTimeout(() => panel.recreate(), 500);
    });

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.code === CONFIG.shortcuts.toggle) {
            e.preventDefault();
            panel.toggle();
        }
        if (e.ctrlKey && e.shiftKey && e.code === CONFIG.shortcuts.export) {
            e.preventDefault();
            const type = Context.getType();
            if (type === 'library') Actions.exportLibrary('json');
            else if (type === 'article') Actions.exportArticleMarkdown();
            else if (type === 'youtube') Actions.youtubeVideoSummary();
            else if (type === 'chatgpt') Actions.exportChatGPTConversation();
            else if (type === 'gemini') Actions.exportGeminiConversation();
        }
    });

})();
