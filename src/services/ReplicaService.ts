import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';

/**
 * レプリカ作成結果のインターフェース
 */
export interface ReplicaResult {
    success: boolean;
    outputDir: string;
    error?: string;
    stats?: {
        htmlFiles: number;
        cssFiles: number;
        jsFiles: number;
        images: number;
        totalSize: number;
    };
}

/**
 * レプリカサービス - Webサイトのレプリカを作成
 */
export class ReplicaService {
    private static instance: ReplicaService;
    private scriptPath: string;

    private constructor(private extensionPath: string) {
        this.scriptPath = path.join(extensionPath, 'scripts', 'website_replicator.py');
    }

    /**
     * シングルトンインスタンスを取得
     */
    static getInstance(extensionPath: string): ReplicaService {
        if (!ReplicaService.instance) {
            ReplicaService.instance = new ReplicaService(extensionPath);
        }
        return ReplicaService.instance;
    }

    /**
     * レプリカを作成
     */
    async createReplica(url: string, projectPath: string): Promise<ReplicaResult> {
        try {
            Logger.info('レプリカ作成開始', { url, projectPath });

            // Python環境を確認
            await this.checkPythonEnvironment();

            // 出力ディレクトリを設定
            const outputDir = path.join(projectPath, 'replica');

            // Pythonスクリプトを実行
            const result = await this.executePythonScript(url, outputDir);

            if (result.success) {
                Logger.info('レプリカ作成成功', { url, outputDir: result.outputDir });
                
                // クリック検出スクリプトを注入
                await this.injectClickDetectionScript(result.outputDir);
            }

            return result;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            Logger.error('レプリカ作成エラー', error instanceof Error ? error : new Error(errorMessage), { url });
            
            return {
                success: false,
                outputDir: '',
                error: errorMessage
            };
        }
    }

    /**
     * Python環境をチェック
     */
    private async checkPythonEnvironment(): Promise<void> {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn('python3', ['--version']);
            
            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    Logger.debug('Python環境確認完了');
                    resolve();
                } else {
                    reject(new Error('Python3が利用できません。Python3をインストールしてください。'));
                }
            });

            pythonProcess.on('error', (error) => {
                reject(new Error(`Python環境エラー: ${error.message}`));
            });
        });
    }

    /**
     * Pythonスクリプトを実行
     */
    private async executePythonScript(url: string, outputDir: string): Promise<ReplicaResult> {
        return new Promise((resolve) => {
            const args = [this.scriptPath, url, '-o', outputDir];

            Logger.info('Pythonスクリプト実行開始', { 
                command: 'python3',
                args: args.join(' ')
            });

            const pythonProcess = spawn('python3', args);
            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                // プログレス表示をVSCodeの通知で表示
                if (output.includes('Downloading:')) {
                    vscode.window.setStatusBarMessage(`🔄 ${output.trim()}`, 3000);
                }
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    // 統計情報を解析
                    const stats = this.parseStats(stdout);
                    
                    resolve({
                        success: true,
                        outputDir,
                        stats
                    });
                } else {
                    resolve({
                        success: false,
                        outputDir,
                        error: stderr || `プロセスがコード ${code} で終了しました`
                    });
                }
            });

            pythonProcess.on('error', (error) => {
                resolve({
                    success: false,
                    outputDir,
                    error: `Pythonプロセスの起動に失敗: ${error.message}`
                });
            });
        });
    }

    /**
     * 統計情報を解析
     */
    private parseStats(output: string): any {
        const stats: any = {
            htmlFiles: 0,
            cssFiles: 0,
            jsFiles: 0,
            images: 0,
            totalSize: 0
        };

        // HTML files
        const htmlMatch = output.match(/html_files: (\d+) files/);
        if (htmlMatch) {stats.htmlFiles = parseInt(htmlMatch[1]);}

        // CSS files
        const cssMatch = output.match(/css: (\d+) files/);
        if (cssMatch) {stats.cssFiles = parseInt(cssMatch[1]);}

        // JS files
        const jsMatch = output.match(/js: (\d+) files/);
        if (jsMatch) {stats.jsFiles = parseInt(jsMatch[1]);}

        // Images
        const imagesMatch = output.match(/images: (\d+) files/);
        if (imagesMatch) {stats.images = parseInt(imagesMatch[1]);}

        // Total size
        const sizeMatch = output.match(/Total size: ([\d.]+) MB/);
        if (sizeMatch) {stats.totalSize = parseFloat(sizeMatch[1]);}

        return stats;
    }

    /**
     * クリック検出スクリプトを注入
     */
    private async injectClickDetectionScript(outputDir: string): Promise<void> {
        const clickDetectionScript = `
<script>
// シンプル要素検査スクリプト
(function() {
    let selectedElement = null;
    let overlay = null;
    let hoveredElement = null;

    // モーダル要素かどうかをチェック（z-indexベース）
    function isModalElement(element) {
        let current = element;
        while (current && current !== document.body) {
            const zIndex = parseInt(window.getComputedStyle(current).zIndex);
            if (zIndex >= 999999) return true;
            current = current.parentElement;
        }
        return false;
    }

    // ハイライト表示
    function addHighlight(element) {
        removeHighlight();
        if (element && !isModalElement(element)) {
            element.style.outline = '2px solid #007acc';
            element.style.outlineOffset = '1px';
            hoveredElement = element;
        }
    }

    // ハイライト削除
    function removeHighlight() {
        if (hoveredElement) {
            hoveredElement.style.outline = '';
            hoveredElement.style.outlineOffset = '';
            hoveredElement = null;
        }
    }

    // 要素情報を取得
    function getElementInfo(element) {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        
        // XPathを取得
        function getXPath(el) {
            if (el.id !== '') return 'id("' + el.id + '")';
            if (el === document.body) return el.tagName;
            
            let ix = 0;
            const siblings = el.parentNode.childNodes;
            for (let i = 0; i < siblings.length; i++) {
                const sibling = siblings[i];
                if (sibling === el) return getXPath(el.parentNode) + '/' + el.tagName + '[' + (ix + 1) + ']';
                if (sibling.nodeType === 1 && sibling.tagName === el.tagName) ix++;
            }
        }

        // CSSセレクタを取得
        function getCSSPath(el) {
            const path = [];
            while (el.nodeType === Node.ELEMENT_NODE) {
                let selector = el.nodeName.toLowerCase();
                if (el.id) {
                    selector += '#' + el.id;
                    path.unshift(selector);
                    break;
                } else {
                    let sib = el, nth = 1;
                    while (sib = sib.previousElementSibling) {
                        if (sib.nodeName.toLowerCase() == selector) nth++;
                    }
                    if (nth != 1) selector += ":nth-of-type(" + nth + ")";
                }
                path.unshift(selector);
                el = el.parentNode;
            }
            return path.join(' > ');
        }

        // テキスト行を分析
        const textLines = element.innerText ? element.innerText.split('\\n').filter(line => line.trim()) : [];
        
        return {
            xpath: getXPath(element),
            selector: getCSSPath(element),
            tagName: element.tagName,
            className: element.className,
            id: element.id,
            text: element.innerText || '',
            textLines: textLines.map(line => ({ text: line, length: line.length })),
            html: element.outerHTML.substring(0, 200) + '...',
            styles: {
                fontSize: styles.fontSize,
                color: styles.color,
                backgroundColor: styles.backgroundColor,
                fontWeight: styles.fontWeight,
                fontFamily: styles.fontFamily,
                textAlign: styles.textAlign,
                lineHeight: styles.lineHeight,
                padding: styles.padding,
                margin: styles.margin
            },
            bounds: {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                top: Math.round(rect.top),
                left: Math.round(rect.left)
            }
        };
    }

    // 要素情報をフォーマット
    function formatElementInfo(info) {
        let formatted = '【要素の特定情報】\\n';
        formatted += '要素のXPath: ' + info.xpath + '\\n';
        formatted += 'セレクタ: ' + info.selector + '\\n';
        formatted += '現在のHTML: ' + info.html + '\\n\\n';
        
        formatted += '【視覚的コンテキスト】\\n';
        formatted += 'タグ: ' + info.tagName;
        if (info.id) formatted += ', ID: ' + info.id;
        if (info.className) formatted += ', クラス: ' + info.className;
        formatted += '\\n\\n';
        
        if (info.textLines.length > 0) {
            formatted += '【現在の内容】\\n';
            info.textLines.forEach((line, index) => {
                formatted += '- ' + (index + 1) + '行目: 「' + line.text + '」（' + line.length + '文字）\\n';
            });
            formatted += '\\n';
        }
        
        formatted += '【スタイル情報（主要なもののみ）】\\n';
        formatted += 'font-size: ' + info.styles.fontSize + '\\n';
        formatted += 'color: ' + info.styles.color + '\\n';
        formatted += 'text-align: ' + info.styles.textAlign + '\\n';
        formatted += 'line-height: ' + info.styles.lineHeight + '\\n';
        formatted += '\\n';
        
        formatted += '【表示サイズ】\\n';
        formatted += '幅: ' + info.bounds.width + 'px, 高さ: ' + info.bounds.height + 'px';
        
        return formatted;
    }

    // オーバーレイを作成
    function createOverlay() {
        overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.3); z-index: 999999; display: none;';
        
        const infoBox = document.createElement('div');
        infoBox.style.cssText = 'position: fixed; top: 20px; right: 20px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px; max-height: 80vh; overflow-y: auto; z-index: 1000000;';
        
        const title = document.createElement('h3');
        title.textContent = '要素情報';
        title.style.cssText = 'margin: 0 0 10px 0; font-size: 16px;';
        
        const content = document.createElement('pre');
        content.style.cssText = 'font-size: 12px; white-space: pre-wrap; word-wrap: break-word; margin: 0 0 10px 0;';
        
        const copyButton = document.createElement('button');
        copyButton.textContent = 'コピー';
        copyButton.style.cssText = 'background: #007acc; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;';
        
        const closeButton = document.createElement('button');
        closeButton.textContent = '閉じる';
        closeButton.style.cssText = 'background: #666; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-left: 10px;';
        
        infoBox.appendChild(title);
        infoBox.appendChild(content);
        infoBox.appendChild(copyButton);
        infoBox.appendChild(closeButton);
        overlay.appendChild(infoBox);
        document.body.appendChild(overlay);
        
        return { overlay, content, copyButton, closeButton };
    }

    // 初期化
    const { content: infoContent, copyButton, closeButton } = createOverlay();

    // マウスオーバーイベント
    document.addEventListener('mouseover', function(e) {
        if (!isModalElement(e.target) && overlay.style.display === 'none') {
            addHighlight(e.target);
        }
    }, true);

    // マウスアウトイベント
    document.addEventListener('mouseout', function(e) {
        if (!isModalElement(e.relatedTarget)) {
            removeHighlight();
        }
    }, true);

    // クリックイベント
    document.addEventListener('click', function(e) {
        if (isModalElement(e.target)) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        selectedElement = e.target;
        const info = getElementInfo(selectedElement);
        const formatted = formatElementInfo(info);
        
        infoContent.textContent = formatted;
        overlay.style.display = 'block';
        
        removeHighlight();
        selectedElement.style.outline = '3px solid #007acc';
    }, true);

    // コピーボタン
    copyButton.addEventListener('click', function(e) {
        e.stopPropagation();
        const text = infoContent.textContent;
        
        // iframe内から親フレームへメッセージを送信
        if (window.parent !== window) {
            window.parent.postMessage({
                command: 'copyElementInfo',
                text: text
            }, '*');
            copyButton.textContent = 'コピー完了！';
            setTimeout(() => {
                copyButton.textContent = 'コピー';
            }, 2000);
        } else if (window.vscode) {
            // 直接VSCode APIを使用（通常のWebview環境）
            window.vscode.postMessage({
                command: 'copyElementInfo',
                text: text
            });
            copyButton.textContent = 'コピー完了！';
            setTimeout(() => {
                copyButton.textContent = 'コピー';
            }, 2000);
        } else {
            // フォールバック: document.execCommandを使用
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length);
            
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    copyButton.textContent = 'コピー完了！';
                    setTimeout(() => {
                        copyButton.textContent = 'コピー';
                    }, 2000);
                } else {
                    alert('コピー機能が制限されています。要素情報:\\n\\n' + text);
                }
            } catch (err) {
                alert('コピー機能が制限されています。要素情報:\\n\\n' + text);
            } finally {
                document.body.removeChild(textarea);
            }
        }
    });

    // 閉じるボタン
    closeButton.addEventListener('click', function(e) {
        e.stopPropagation();
        overlay.style.display = 'none';
        if (selectedElement) {
            selectedElement.style.outline = '';
            selectedElement = null;
        }
    });

    // ESCキーで閉じる
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (overlay.style.display !== 'none') {
                overlay.style.display = 'none';
                if (selectedElement) {
                    selectedElement.style.outline = '';
                    selectedElement = null;
                }
            } else {
                removeHighlight();
            }
        }
    });
})();
</script>
`;

        try {
            const indexPath = path.join(outputDir, 'index.html');
            let html = await fs.promises.readFile(indexPath, 'utf-8');
            
            // </body>タグの前にスクリプトを挿入
            if (html.includes('</body>')) {
                html = html.replace('</body>', clickDetectionScript + '\n</body>');
            } else {
                // </body>タグがない場合は末尾に追加
                html += clickDetectionScript;
            }
            
            await fs.promises.writeFile(indexPath, html, 'utf-8');
            Logger.info('クリック検出スクリプトを注入しました', { path: indexPath });
            
        } catch (error) {
            Logger.warn('クリック検出スクリプトの注入に失敗しました', { 
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * レプリカが存在するかチェック
     */
    async checkReplicaExists(projectPath: string): Promise<boolean> {
        try {
            const replicaPath = path.join(projectPath, 'replica', 'index.html');
            await fs.promises.access(replicaPath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * レプリカのパスを取得
     */
    getReplicaPath(projectPath: string): string {
        return path.join(projectPath, 'replica', 'index.html');
    }
}