"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    static initialize(extensionName, level = LogLevel.INFO, autoShow = false) {
        this.outputChannel = vscode.window.createOutputChannel(extensionName);
        this.logLevel = level;
        // ログファイルのパスを設定
        const homeDir = os.homedir();
        const logDir = path.join(homeDir, '.appgenius-ai', 'logs');
        // ログディレクトリが存在しない場合は作成
        if (!fs.existsSync(logDir)) {
            try {
                fs.mkdirSync(logDir, { recursive: true });
            }
            catch (err) {
                console.error('ログディレクトリの作成に失敗しました:', err);
            }
        }
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        this.logFilePath = path.join(logDir, `appgenius-ai-${timestamp}.log`);
        this.info(`Logger initialized with level: ${LogLevel[level]}`);
        this.info(`ログファイル: ${this.logFilePath}`);
        // 設定がtrueの場合のみログウィンドウを表示
        if (autoShow) {
            this.show();
        }
    }
    static setLevel(level) {
        this.logLevel = level;
        this.info(`Log level set to: ${LogLevel[level]}`);
    }
    static debug(message, data) {
        if (this.logLevel <= LogLevel.DEBUG) {
            this.log('DEBUG', message, data);
        }
    }
    static info(message, data) {
        if (this.logLevel <= LogLevel.INFO) {
            this.log('INFO', message, data);
        }
    }
    static warn(message, data) {
        if (this.logLevel <= LogLevel.WARN) {
            this.log('WARN', message, data);
        }
    }
    static error(message, error, data, autoShow = false) {
        if (this.logLevel <= LogLevel.ERROR) {
            this.log('ERROR', message);
            if (error) {
                // 詳細なエラー情報をログに記録
                this.log('ERROR', `Error details: ${error.message}`);
                // AxiosエラーからHTTPステータスなどの詳細情報を抽出
                try {
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const axios = require('axios');
                    if (axios && axios.isAxiosError && axios.isAxiosError(error)) {
                        // axiosエラーとしてのプロパティにアクセスするため型アサーション
                        const axiosError = error;
                        if (axiosError.response) {
                            const statusCode = axiosError.response?.status;
                            const responseData = axiosError.response?.data;
                            const requestUrl = axiosError.config?.url;
                            const requestMethod = axiosError.config?.method;
                            this.log('ERROR', `API Error: ${statusCode} ${requestMethod?.toUpperCase() || 'UNKNOWN'} ${requestUrl || 'UNKNOWN_URL'}`);
                            if (responseData) {
                                try {
                                    const formattedData = typeof responseData === 'object'
                                        ? JSON.stringify(responseData, null, 2)
                                        : responseData;
                                    this.log('ERROR', `Response data: ${formattedData}`);
                                }
                                catch (e) {
                                    this.log('ERROR', `Response data: [非シリアル化データ]`);
                                }
                            }
                        }
                    }
                }
                catch (e) {
                    // axiosモジュールが読み込めない場合は何もしない
                }
                if (error.stack) {
                    this.log('ERROR', `Stack trace: ${error.stack}`);
                }
            }
            if (data) {
                this.log('ERROR', 'Additional data:', data);
            }
            // エラー時には設定に応じてログウィンドウを表示（デフォルトで非表示に変更）
            if (autoShow) {
                this.show();
            }
        }
    }
    static log(level, message, data) {
        if (!this.outputChannel) {
            // フォールバック: 初期化前にログが呼ばれた場合
            console.log(`[${level}] ${message}`);
            return;
        }
        const timestamp = new Date().toISOString();
        let logMessage = `[${timestamp}] [${level}] ${message}`;
        if (data) {
            // オブジェクトや配列の場合はJSON文字列化
            if (typeof data === 'object' && data !== null) {
                try {
                    logMessage += `\n${JSON.stringify(data, null, 2)}`;
                }
                catch (e) {
                    logMessage += `\n[非シリアル化オブジェクト: ${typeof data}]`;
                }
            }
            else {
                logMessage += `\n${data}`;
            }
        }
        // コンソール出力
        this.outputChannel.appendLine(logMessage);
        // ファイル出力
        if (this.logFilePath) {
            try {
                fs.appendFileSync(this.logFilePath, logMessage + '\n');
            }
            catch (err) {
                console.error('ログファイルへの書き込みに失敗しました:', err);
            }
        }
    }
    static show() {
        if (this.outputChannel) {
            this.outputChannel.show(true); // preserveFocus=true
        }
    }
    static dispose() {
        if (this.outputChannel) {
            this.outputChannel.dispose();
        }
    }
    static getLogFilePath() {
        return this.logFilePath;
    }
    static async readLogFile() {
        if (!this.logFilePath) {
            return 'ログファイルが設定されていません';
        }
        try {
            return await fs.promises.readFile(this.logFilePath, 'utf-8');
        }
        catch (err) {
            this.error('ログファイルの読み取りに失敗しました', err);
            return `ログファイルの読み取りに失敗しました: ${err.message}`;
        }
    }
}
exports.Logger = Logger;
Logger.logLevel = LogLevel.INFO; // INFO以上のレベルのみ出力するように設定
//# sourceMappingURL=logger.js.map