// ==UserScript==
// @name         Contextual Perplexity Helper Pro
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Painéis contextuais discretos para Perplexity, YouTube, ChatGPT e Gemini (com suporte SPA)
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
        perplexityDomain: 'perplexity.ai',
        youtubeDomain: 'youtube.com',
        chatgptDomain: 'chatgpt.com',
        geminiDomain: 'gemini.google.com',
        maxTextLength: 5000,
        debounceDelay: 300,
        shortcuts: {
            toggle: 'KeyP',
            export: 'KeyE'
        }
    };

    // ========== OBSERVADOR DE URL (mantido igual) ==========
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

    // ========== UTILITÁRIOS (mantidos iguais) ==========
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
            return name.replace(/[\\\/:\*\?"<>\|]/g, '_')
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
        }
    };

    // ========== DETECÇÃO DE CONTEXTO (mantida igual) ==========
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

    // ========== AÇÕES (mantidas iguais) ==========
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
                Utils.downloadFile(
                    JSON.stringify(conversations, null, 2),
                    `perplexity-library-${timestamp}.json`,
                    'application/json'
                );
            } else if (format === 'csv') {
                const csv = [
                    'Título,URL,Descrição',
                    ...conversations.map(c =>
                        `"${c.title.replace(/"/g, '""')}","${c.url}","${c.description.replace(/"/g, '""')}"`
                    )
                ].join('\n');
                Utils.downloadFile(csv, `perplexity-library-${timestamp}.csv`, 'text/csv');
            } else if (format === 'md') {
                const md = [
                    '# Biblioteca Perplexity',
                    '',
                    `Exportado em: ${new Date().toLocaleString('pt-BR')}`,
                    `Total: ${conversations.length} conversas`,
                    '',
                    ...conversations.map((c, i) =>
                        `## ${i + 1}. ${c.title}\n\n**Link:** ${c.url}\n\n${c.description}\n\n---\n`
                    )
                ].join('\n');
                Utils.downloadFile(md, `perplexity-library-${timestamp}.md`);
            }

            Utils.showToast(`${conversations.length} conversas exportadas!`, 'success');
        },

        async autoScrollLibrary() {
            Utils.showToast('Iniciando rolagem automática...', 'info');

            let lastCount = 0;
            let stableCount = 0;

            for (let i = 0; i < 30; i++) {
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(r => setTimeout(r, 1000));

                const currentCount = document.querySelectorAll('a[href^="/search/"]').length;
                if (currentCount === lastCount) {
                    stableCount++;
                    if (stableCount >= 3) break;
                } else {
                    stableCount = 0;
                }
                lastCount = currentCount;
            }

            window.scrollTo(0, 0);
            Utils.showToast(`Rolagem concluída! ${lastCount} conversas carregadas`, 'success');
        },

        exportArticleMarkdown() {
            Utils.showToast('Exportando artigo completo...', 'info');

            const titleEl = document.querySelector(
                '[data-testid*="thread-title"], h1.font-display, h1, .text-3xl'
            );

            const contentEl = document.querySelector(
                'main[class*="ThreadContent"], [class*="thread-content"], main, article'
            );

            const title = titleEl?.textContent?.trim() || document.title.replace(' | Perplexity', '');

            let content = '';
            if (contentEl) {
                const messageBlocks = contentEl.querySelectorAll('[class*="message"], [class*="answer"], [class*="query"]');
                if (messageBlocks.length > 0) {
                    messageBlocks.forEach((block, idx) => {
                        const text = block.innerText?.trim();
                        if (text) {
                            content += `\n## Seção ${idx + 1}\n\n${text}\n\n`;
                        }
                    });
                } else {
                    content = contentEl.innerText;
                }
            } else {
                content = document.body.innerText;
            }

            const markdown = [
                `# ${title}`,
                '',
                `**Fonte:** ${window.location.href}`,
                `**Exportado:** ${new Date().toLocaleString('pt-BR')}`,
                '',
                '---',
                '',
                content.trim()
            ].join('\n');

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
                const role = el.getAttribute('data-message-author-role') ||
                           (el.textContent.includes('You') ? 'user' : 'assistant');
                const content = el.querySelector('[class*="markdown"], [class*="prose"]')?.innerText ||
                              el.innerText;

                if (content && content.trim().length > 0) {
                    messages.push({
                        role: role,
                        content: content.trim()
                    });
                }
            });

            const markdown = [
                `# ${title}`,
                '',
                `**Exportado de:** ChatGPT`,
                `**Data:** ${new Date().toLocaleString('pt-BR')}`,
                `**URL:** ${window.location.href}`,
                '',
                '---',
                '',
                ...messages.map(msg => {
                    const speaker = msg.role === 'user' ? '### 👤 Você' : '### 🤖 ChatGPT';
                    return `${speaker}\n\n${msg.content}\n\n---\n`;
                })
            ].join('\n');

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
                const isUser = el.classList.toString().includes('user') ||
                             el.getAttribute('data-role') === 'user' ||
                             el.querySelector('[class*="user"]');

                const content = el.innerText?.trim();

                if (content && content.length > 10) {
                    messages.push({
                        role: isUser ? 'user' : 'assistant',
                        content: content
                    });
                }
            });

            if (messages.length === 0) {
                const allText = chatContainer.innerText;
                messages.push({
                    role: 'full',
                    content: allText
                });
            }

            const markdown = [
                `# ${title}`,
                '',
                `**Exportado de:** Google Gemini`,
                `**Data:** ${new Date().toLocaleString('pt-BR')}`,
                `**URL:** ${window.location.href}`,
                '',
                '---',
                '',
                ...messages.map(msg => {
                    if (msg.role === 'full') {
                        return msg.content;
                    }
                    const speaker = msg.role === 'user' ? '### 👤 Você' : '### ✨ Gemini';
                    return `${speaker}\n\n${msg.content}\n\n---\n`;
                })
            ].join('\n');

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

            const prompt = `Analise este vídeo do YouTube e forneça:

1. Resumo esquemático com diagrama ASCII dos principais conceitos
2. Cronologia enxuta dos temas abordados no vídeo
3. Principais insights e conclusões

Vídeo: "${title}"
URL: ${url}`;

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
            this.sendToPerplexity(prompt);
        }
    };

    // ========== INTERFACE REDESENHADA ==========
    class Panel {
        constructor() {
            this.fabButton = null;
            this.panel = null;
            this.expanded = false;
            this.selectionBtn = null;
            this.contextType = Context.getType();
        }

        destroy() {
            if (this.panel) {
                this.panel.remove();
                this.panel = null;
            }
            if (this.fabButton) {
                this.fabButton.remove();
                this.fabButton = null;
            }
            if (this.selectionBtn) {
                this.selectionBtn.remove();
                this.selectionBtn = null;
            }
            this.expanded = false;
        }

        recreate() {
            this.destroy();
            this.contextType = Context.getType();
            this.create();
        }

        create() {
            if (this.fabButton) return;

            const dark = Utils.isDarkMode();
            this.createFAB(dark);
            this.createPanel(dark);

            if (this.contextType === 'external') {
                this.createSelectionButton(dark);
            }

            this.addGlobalStyles();
        }

        addGlobalStyles() {
            if (document.getElementById('perplexity-helper-styles')) return;

            const style = document.createElement('style');
            style.id = 'perplexity-helper-styles';
            style.textContent = `
                @keyframes fabPulse {
                    0%, 100% { box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
                    50% { box-shadow: 0 4px 20px rgba(102, 126, 234, 0.6); }
                }

                @keyframes panelSlideIn {
                    from {
                        opacity: 0;
                        transform: translateX(20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                }

                @keyframes panelSlideOut {
                    from {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(20px) scale(0.95);
                    }
                }

                .perplexity-fab-button {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .perplexity-fab-button:hover {
                    transform: scale(1.1) !important;
                    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6) !important;
                }

                .perplexity-fab-button:active {
                    transform: scale(0.95) !important;
                }

                .perplexity-panel-show {
                    animation: panelSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }

                .perplexity-panel-hide {
                    animation: panelSlideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
            `;
            document.head.appendChild(style);
        }

        createFAB(dark) {
            this.fabButton = document.createElement('button');
            const emoji = this.getTitleEmoji(this.contextType);

            this.fabButton.innerHTML = emoji;
            this.fabButton.className = 'perplexity-fab-button';
            this.fabButton.setAttribute('aria-label', 'Abrir Perplexity Helper');
            this.fabButton.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                width: 56px;
                height: 56px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 50%;
                font-size: 24px;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                z-index: 2147483646;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                animation: fabPulse 2s ease-in-out infinite;
            `;

            this.fabButton.onclick = () => this.toggle();
            document.body.appendChild(this.fabButton);
        }

        createPanel(dark) {
            this.panel = document.createElement('div');
            this.panel.id = 'perplexity-helper-panel';
            this.panel.setAttribute('role', 'dialog');
            this.panel.setAttribute('aria-label', 'Perplexity Helper');
            this.panel.style.cssText = `
                position: fixed;
                bottom: 90px;
                right: 24px;
                width: 280px;
                max-height: 70vh;
                background: ${dark ? '#1a1d23' : '#ffffff'};
                color: ${dark ? '#e4e4e7' : '#18181b'};
                border: 1px solid ${dark ? '#3a3f4b' : '#e5e7eb'};
                box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                border-radius: 16px;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: 14px;
                z-index: 2147483645;
                display: none;
                overflow: hidden;
            `;

            // Header
            const header = document.createElement('div');
            const titleEmoji = this.getTitleEmoji(this.contextType);
            header.innerHTML = `
                <div style="display: flex; align-items: center; padding: 16px; border-bottom: 1px solid ${dark ? '#2d313b' : '#e5e7eb'};">
                    <span style="font-size: 20px; margin-right: 8px;">${titleEmoji}</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 14px; color: ${dark ? '#93e1d8' : '#20808d'};">
                            Helper Pro
                        </div>
                        <div style="font-size: 11px; color: ${dark ? '#9ca3af' : '#6b7280'}; margin-top: 2px;">
                            ${this.getContextLabel(this.contextType)}
                        </div>
                    </div>
                </div>
            `;
            this.panel.appendChild(header);

            // Content
            const content = document.createElement('div');
            content.style.cssText = `
                padding: 12px;
                max-height: calc(70vh - 120px);
                overflow-y: auto;
            `;
            this.addContextButtons(content, this.contextType, dark);
            this.panel.appendChild(content);

            // Footer
            const footer = document.createElement('div');
            footer.innerHTML = `
                <div style="padding: 12px 16px; border-top: 1px solid ${dark ? '#2d313b':'#e5e7eb'}; font-size: 11px; color: ${dark?'#6b7280':'#9ca3af'}; text-align: center;">
                    <kbd style="padding: 2px 6px; background: ${dark?'#2d313b':'#f3f4f6'}; border-radius: 3px; font-size: 10px;">Ctrl+Shift+P</kbd> para abrir/fechar
                </div>
            `;
            this.panel.appendChild(footer);

            document.body.appendChild(this.panel);
        }

        getTitleEmoji(type) {
            const emojis = {
                library: '📚',
                article: '📄',
                youtube: '🎬',
                chatgpt: '💬',
                gemini: '✨',
                external: '🔮',
                unknown: '❓'
            };
            return emojis[type] || emojis.unknown;
        }

        getContextLabel(type) {
            const labels = {
                library: 'Biblioteca',
                article: 'Artigo',
                youtube: 'YouTube',
                chatgpt: 'ChatGPT',
                gemini: 'Gemini',
                external: window.location.hostname.length > 20
                    ? window.location.hostname.substring(0, 20) + '...'
                    : window.location.hostname,
                unknown: 'Desconhecido'
            };
            return labels[type] || labels.unknown;
        }

        addContextButtons(container, contextType, dark) {
            const btnStyle = (color, isCompact = false) => `
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                margin-bottom: 8px;
                padding: ${isCompact ? '8px 10px' : '10px 12px'};
                background: ${color};
                border: none;
                border-radius: 10px;
                color: white;
                font-weight: 600;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 2px 8px ${color}40;
            `;

            if (contextType === 'library') {
                container.appendChild(this.createBtn('📥 JSON', () => Actions.exportLibrary('json'), btnStyle('#0ea5e9')));
                container.appendChild(this.createBtn('📊 CSV', () => Actions.exportLibrary('csv'), btnStyle('#8b5cf6')));
                container.appendChild(this.createBtn('📝 Markdown', () => Actions.exportLibrary('md'), btnStyle('#6366f1')));
                container.appendChild(this.createBtn('↓ Carregar tudo', () => Actions.autoScrollLibrary(), btnStyle('#10b981')));

            } else if (contextType === 'article') {
                container.appendChild(this.createBtn('📥 Exportar Markdown', () => Actions.exportArticleMarkdown(), btnStyle('#0ea5e9')));

            } else if (contextType === 'youtube') {
                container.appendChild(this.createBtn('🎯 Resumo ASCII', () => Actions.youtubeVideoSummary(), btnStyle('#ff0000')));
                container.appendChild(this.createBtn('📋 Copiar info', () => Actions.copyYoutubeInfo(), btnStyle('#cc0000')));

            } else if (contextType === 'chatgpt') {
                container.appendChild(this.createBtn('📥 Exportar conversa', () => Actions.exportChatGPTConversation(), btnStyle('#10a37f')));

            } else if (contextType === 'gemini') {
                container.appendChild(this.createBtn('📥 Exportar conversa', () => Actions.exportGeminiConversation(), btnStyle('#4285f4')));

            } else if (contextType === 'external') {
                container.appendChild(this.createBtn('📊 Resumo ASCII', () => Actions.sendToPerplexity('Faça um resumo com diagrama ASCII dos principais conceitos desta página', true), btnStyle('#06b6d4', true)));
                container.appendChild(this.createBtn('📝 Resumo simples', () => Actions.sendToPerplexity('Faça um resumo simples e direto desta página', true), btnStyle('#8b5cf6', true)));
                container.appendChild(this.createBtn('⭐ Destaques', () => Actions.sendToPerplexity('Liste os principais destaques e pontos importantes desta página', true), btnStyle('#f59e0b', true)));
            }
        }

        createBtn(text, onClick, style) {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.style.cssText = style;
            btn.onclick = () => {
                onClick();
                this.hide();
            };
            btn.onmouseenter = () => {
                btn.style.transform = 'translateY(-2px)';
                btn.style.filter = 'brightness(1.1)';
            };
            btn.onmouseleave = () => {
                btn.style.transform = 'translateY(0)';
                btn.style.filter = 'brightness(1)';
            };
            return btn;
        }

        createSelectionButton(dark) {
            if (this.selectionBtn) return;

            this.selectionBtn = document.createElement('button');
            this.selectionBtn.textContent = '🔍';
            this.selectionBtn.setAttribute('aria-label', 'Perguntar sobre seleção');
            this.selectionBtn.style.cssText = `
                position: fixed;
                bottom: 90px;
                right: 24px;
                width: 48px;
                height: 48px;
                padding: 0;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                border: none;
                border-radius: 50%;
                font-size: 20px;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
                z-index: 2147483644;
                display: none;
                align-items: center;
                justify-content: center;
                transition: all 0.3s;
            `;

            this.selectionBtn.onclick = () => Actions.sendSelectedText();
            this.selectionBtn.onmouseenter = () => {
                this.selectionBtn.style.transform = 'scale(1.1)';
            };
            this.selectionBtn.onmouseleave = () => {
                this.selectionBtn.style.transform = 'scale(1)';
            };
            document.body.appendChild(this.selectionBtn);

            const debouncedCheck = Utils.debounce(() => {
                const text = window.getSelection().toString().trim();
                this.selectionBtn.style.display = text.length > 10 ? 'flex' : 'none';
            }, CONFIG.debounceDelay);

            document.addEventListener('selectionchange', debouncedCheck);
        }

        toggle() {
            if (this.expanded) {
                this.hide();
            } else {
                this.show();
            }
        }

        show() {
            if (!this.panel) this.create();

            this.panel.style.display = 'block';
            this.panel.classList.remove('perplexity-panel-hide');
            this.panel.classList.add('perplexity-panel-show');
            this.expanded = true;

            // Rotaciona o FAB
            if (this.fabButton) {
                this.fabButton.style.transform = 'rotate(45deg)';
            }
        }

        hide() {
            if (!this.panel) return;

            this.panel.classList.remove('perplexity-panel-show');
            this.panel.classList.add('perplexity-panel-hide');

            setTimeout(() => {
                if (this.panel) {
                    this.panel.style.display = 'none';
                }
            }, 300);

            this.expanded = false;

            // Rotaciona o FAB de volta
            if (this.fabButton) {
                this.fabButton.style.transform = 'rotate(0deg)';
            }
        }
    }

    // ========== INICIALIZAÇÃO ==========
    let panel = new Panel();

    function init() {
        panel.create();
        console.log('🚀 Perplexity Helper Pro v4.0 carregado! Contexto:', Context.getType());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    observeUrlChange(() => {
        console.log('🔄 URL mudou, recriando painel...', Context.getType());
        setTimeout(() => {
            panel.recreate();
        }, 500);
    });

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.code === CONFIG.shortcuts.toggle) {
            e.preventDefault();
            panel.toggle();
        }
        if (e.ctrlKey && e.shiftKey && e.code === CONFIG.shortcuts.export) {
            e.preventDefault();
            const contextType = Context.getType();
            if (contextType === 'library') Actions.exportLibrary('json');
            else if (contextType === 'article') Actions.exportArticleMarkdown();
            else if (contextType === 'youtube') Actions.youtubeVideoSummary();
            else if (contextType === 'chatgpt') Actions.exportChatGPTConversation();
            else if (contextType === 'gemini') Actions.exportGeminiConversation();
        }
    });

})();
