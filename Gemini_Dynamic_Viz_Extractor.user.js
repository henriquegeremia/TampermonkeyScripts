// ==UserScript==
// @name         Gemini Dynamic Visualization Extractor
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Extrai visualizações dinâmicas do Gemini (iframes) para arquivos HTML autônomos
// @author       User
// @match        https://gemini.google.com/*
// @grant        GM_download
// @grant        GM_setClipboard
// @grant        GM_notification
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        version: '0.2',
        buttonId: 'gemini-viz-export-btn',
        containerClass: 'gemini-viz-container'
    };

    console.log(`Gemini Text Extractor v${CONFIG.version} loaded`);

    // ========== UI MODULE ==========
    const UI = {
        createButton() {
            if (document.getElementById(CONFIG.buttonId)) return;

            const btn = document.createElement('button');
            btn.id = CONFIG.buttonId;
            btn.textContent = '📥 Export Viz';
            btn.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                padding: 10px 15px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                display: none; /* Hidden by default */
                font-family: 'Google Sans', sans-serif;
                font-weight: 500;
                transition: transform 0.2s;
            `;

            btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
            btn.onmouseout = () => btn.style.transform = 'scale(1)';

            btn.onclick = Logic.handleExport;

            document.body.appendChild(btn);
            return btn;
        },

        showButton() {
            const btn = document.getElementById(CONFIG.buttonId);
            if (btn) btn.style.display = 'block';
        },

        hideButton() {
            const btn = document.getElementById(CONFIG.buttonId);
            if (btn) btn.style.display = 'none';
        },

        toast(message) {
            if (typeof GM_notification === 'function') {
                GM_notification({ text: message, title: 'Gemini Extractor', timeout: 3000 });
            } else {
                alert(message);
            }
        }
    };

    // ========== CORE LOGIC ==========
    const Logic = {
        targetIframe: null,

        checkForIframes() {
            // Gemini visualizations often live in iframes.
            // We look for iframes that might contain the dynamic visualization.
            // Often these have specific classes or SRCs, but generic detection is safer for now.
            const iframes = document.querySelectorAll('iframe');

            // Filter logic: Find the "right" iframe. 
            // Usually valid viz iframes have content.
            for (let iframe of iframes) {
                try {
                    // Check if accessible (same-origin policy might block some, but extensions often bypass)
                    if (iframe.contentDocument && iframe.contentBody !== null) {
                        // Simple heuristic: if it has substantial content or specific markers
                        // For now, we take the last detected substantial iframe
                        if (iframe.offsetWidth > 100 && iframe.offsetHeight > 100) {
                            Logic.targetIframe = iframe;
                            UI.showButton();
                            // console.log("Iframe detected:", iframe);
                        }
                    }
                } catch (e) {
                    // Ignore cross-origin blocking errors if any
                }
            }
        },

        async blobToBase64(blobUrl) {
            try {
                const response = await fetch(blobUrl);
                const blob = await response.blob();
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                console.error("Error converting blob to base64:", e);
                return null;
            }
        },

        async handleExport() {
            if (!Logic.targetIframe) {
                UI.toast("No visualization iframe found!");
                return;
            }
            UI.toast("⏳ Exporting visualization...");
            console.log("Export triggered for", Logic.targetIframe);

            try {
                // 1. Clone the content
                const doc = Logic.targetIframe.contentDocument;
                const clone = doc.documentElement.cloneNode(true);

                // 2. Process Images (Blob -> Base64)
                const images = clone.querySelectorAll('img');
                let validImages = 0;

                for (let img of images) {
                    if (img.src && img.src.startsWith('blob:')) {
                        const base64 = await Logic.blobToBase64(img.src);
                        if (base64) {
                            img.src = base64;
                            validImages++;
                        }
                    }
                }
                console.log(`Processed ${validImages} blob images.`);

                // 3. Ensure styles are preserved
                if (!clone.querySelector('meta[charset]')) {
                    const meta = document.createElement('meta');
                    meta.setAttribute('charset', 'UTF-8');
                    clone.querySelector('head').prepend(meta);
                }

                // 4. Generate HTML String
                const htmlContent = `<!DOCTYPE html>\n<html>\n${clone.innerHTML}\n</html>`;

                // 5. Download
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const filename = `gemini_viz_${timestamp}.html`;

                Logic.downloadFile(htmlContent, filename);
                UI.toast(`✅ Exported: ${filename}`);

            } catch (e) {
                console.error("Export failed:", e);
                UI.toast("❌ Export failed. Check console.");
            }
        },

        downloadFile(content, filename) {
            const blob = new Blob([content], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    // ========== INITIALIZATION ==========
    function init() {
        UI.createButton();

        // Observer to detect new content (Gemini is SPA)
        const observer = new MutationObserver((mutations) => {
            Logic.checkForIframes();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Initial check
        setTimeout(Logic.checkForIframes, 2000);
    }

    init();

})();
