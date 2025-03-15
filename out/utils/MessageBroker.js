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
exports.MessageBroker = exports.MessageStatus = exports.MessageType = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const PlatformManager_1 = require("./PlatformManager");
const logger_1 = require("./logger");
/**
 * メッセージの種類
 */
var MessageType;
(function (MessageType) {
    MessageType["SCOPE_CREATE"] = "scope:create";
    MessageType["SCOPE_UPDATE"] = "scope:update";
    MessageType["PROGRESS_REPORT"] = "progress:report";
    MessageType["COMMAND_EXECUTE"] = "command:execute";
    MessageType["RESULT_SUBMIT"] = "result:submit";
})(MessageType || (exports.MessageType = MessageType = {}));
/**
 * メッセージの状態
 */
var MessageStatus;
(function (MessageStatus) {
    MessageStatus["NEW"] = "new";
    MessageStatus["PROCESSING"] = "processing";
    MessageStatus["COMPLETED"] = "completed";
    MessageStatus["FAILED"] = "failed";
})(MessageStatus || (exports.MessageStatus = MessageStatus = {}));
/**
 * メッセージブローカークラス
 * ファイルベースのメッセージングを提供
 */
class MessageBroker {
    /**
     * シングルトンインスタンスを取得
     */
    static getInstance(projectId) {
        if (!MessageBroker.instance) {
            MessageBroker.instance = new MessageBroker(projectId);
        }
        return MessageBroker.instance;
    }
    /**
     * コンストラクタ
     */
    constructor(projectId) {
        // ファイル監視インスタンス
        this.watcher = null;
        // メッセージ受信コールバック
        this.messageCallbacks = new Map();
        // プロジェクトIDが指定されていない場合は環境変数から取得
        const actualProjectId = projectId || process.env.APPGENIUS_PROJECT_ID || 'default';
        // メッセージディレクトリのパスを構築
        const platformManager = PlatformManager_1.PlatformManager.getInstance();
        this.messageDirPath = path.join(platformManager.getTempDirectory('messages'), actualProjectId);
        // ディレクトリが存在しない場合は作成
        if (!fs.existsSync(this.messageDirPath)) {
            fs.mkdirSync(this.messageDirPath, { recursive: true });
        }
        logger_1.Logger.debug(`MessageBroker initialized with directory: ${this.messageDirPath}`);
    }
    /**
     * メッセージを送信
     */
    sendMessage(type, payload) {
        try {
            // メッセージIDを生成
            const messageId = (0, uuid_1.v4)();
            // メッセージオブジェクトを構築
            const message = {
                id: messageId,
                type,
                status: MessageStatus.NEW,
                payload,
                timestamp: Date.now()
            };
            // メッセージファイルのパスを構築
            const messageFilePath = this.getMessageFilePath(messageId, MessageStatus.NEW);
            // メッセージをファイルに書き込む
            fs.writeFileSync(messageFilePath, JSON.stringify(message, null, 2), 'utf8');
            logger_1.Logger.debug(`Message sent: ${messageId} (${type})`);
            return messageId;
        }
        catch (error) {
            logger_1.Logger.error('Failed to send message', error);
            throw error;
        }
    }
    /**
     * メッセージ受信のためのリスナーを登録
     */
    onMessage(type, callback) {
        // 指定されたタイプのコールバック配列を取得または作成
        if (!this.messageCallbacks.has(type)) {
            this.messageCallbacks.set(type, []);
        }
        // コールバックを登録
        this.messageCallbacks.get(type).push(callback);
        // ウォッチャーがまだ作成されていない場合は作成
        this.ensureWatcher();
        logger_1.Logger.debug(`Message listener registered for type: ${type}`);
    }
    /**
     * すべてのタイプのメッセージを受信するリスナーを登録
     */
    onAnyMessage(callback) {
        // すべてのメッセージタイプに対してリスナーを登録
        Object.values(MessageType).forEach(type => {
            this.onMessage(type, callback);
        });
        logger_1.Logger.debug('Message listener registered for all message types');
    }
    /**
     * ファイル監視が作成されていることを確認
     */
    ensureWatcher() {
        if (this.watcher !== null) {
            return;
        }
        try {
            // メッセージディレクトリを監視
            this.watcher = fs.watch(this.messageDirPath, (_eventType, filename) => {
                // ファイル名がnullまたは.jsonで終わらない場合はスキップ
                if (!filename || !filename.endsWith('.json')) {
                    return;
                }
                // 'new'ステータスのファイルのみ処理
                if (!filename.includes('.new.')) {
                    return;
                }
                this.processMessageFile(filename);
            });
            logger_1.Logger.debug(`File watcher started for directory: ${this.messageDirPath}`);
        }
        catch (error) {
            logger_1.Logger.error('Failed to create file watcher', error);
        }
    }
    /**
     * メッセージファイルを処理
     */
    processMessageFile(filename) {
        try {
            // メッセージファイルのパスを取得
            const filePath = path.join(this.messageDirPath, filename);
            // ファイルが存在するか確認
            if (!fs.existsSync(filePath)) {
                return;
            }
            // メッセージを読み込む
            const messageJson = fs.readFileSync(filePath, 'utf8');
            const message = JSON.parse(messageJson);
            // メッセージのステータスを「処理中」に更新
            message.status = MessageStatus.PROCESSING;
            // ファイル名を更新（.new.json → .processing.json）
            const processingFilePath = this.getMessageFilePath(message.id, MessageStatus.PROCESSING);
            // 元のファイルを削除して新しいステータスのファイルを作成
            fs.renameSync(filePath, processingFilePath);
            // 更新されたメッセージを書き込む
            fs.writeFileSync(processingFilePath, JSON.stringify(message, null, 2), 'utf8');
            logger_1.Logger.debug(`Processing message: ${message.id} (${message.type})`);
            // 該当するタイプのコールバックを実行
            if (this.messageCallbacks.has(message.type)) {
                this.messageCallbacks.get(message.type).forEach(callback => {
                    try {
                        callback(message);
                    }
                    catch (callbackError) {
                        logger_1.Logger.error(`Error in message callback for ${message.type}`, callbackError);
                    }
                });
            }
            // メッセージを処理済みとしてマーク
            this.markMessageAsCompleted(message.id);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to process message file: ${filename}`, error);
        }
    }
    /**
     * メッセージを処理完了としてマーク
     */
    markMessageAsCompleted(messageId) {
        try {
            // 処理中ファイルのパスを取得
            const processingFilePath = this.getMessageFilePath(messageId, MessageStatus.PROCESSING);
            // ファイルが存在するか確認
            if (!fs.existsSync(processingFilePath)) {
                return;
            }
            // メッセージを読み込む
            const messageJson = fs.readFileSync(processingFilePath, 'utf8');
            const message = JSON.parse(messageJson);
            // メッセージのステータスを「完了」に更新
            message.status = MessageStatus.COMPLETED;
            // 完了ファイルのパスを取得
            const completedFilePath = this.getMessageFilePath(messageId, MessageStatus.COMPLETED);
            // 処理中ファイルを削除して完了ファイルを作成
            fs.renameSync(processingFilePath, completedFilePath);
            // 更新されたメッセージを書き込む
            fs.writeFileSync(completedFilePath, JSON.stringify(message, null, 2), 'utf8');
            logger_1.Logger.debug(`Message marked as completed: ${messageId}`);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to mark message as completed: ${messageId}`, error);
        }
    }
    /**
     * メッセージを失敗としてマーク
     */
    markMessageAsFailed(messageId, error) {
        try {
            // 処理中ファイルのパスを取得
            const processingFilePath = this.getMessageFilePath(messageId, MessageStatus.PROCESSING);
            // ファイルが存在するか確認
            if (!fs.existsSync(processingFilePath)) {
                return;
            }
            // メッセージを読み込む
            const messageJson = fs.readFileSync(processingFilePath, 'utf8');
            const message = JSON.parse(messageJson);
            // メッセージのステータスを「失敗」に更新
            message.status = MessageStatus.FAILED;
            // エラー情報を追加
            message.payload.error = {
                message: error.message,
                stack: error.stack
            };
            // 失敗ファイルのパスを取得
            const failedFilePath = this.getMessageFilePath(messageId, MessageStatus.FAILED);
            // 処理中ファイルを削除して失敗ファイルを作成
            fs.renameSync(processingFilePath, failedFilePath);
            // 更新されたメッセージを書き込む
            fs.writeFileSync(failedFilePath, JSON.stringify(message, null, 2), 'utf8');
            logger_1.Logger.debug(`Message marked as failed: ${messageId}`);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to mark message as failed: ${messageId}`, error);
        }
    }
    /**
     * メッセージファイルのパスを取得
     */
    getMessageFilePath(messageId, status) {
        return path.join(this.messageDirPath, `${messageId}.${status}.json`);
    }
    /**
     * リソースの解放
     */
    dispose() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        this.messageCallbacks.clear();
        logger_1.Logger.debug('MessageBroker disposed');
    }
}
exports.MessageBroker = MessageBroker;
//# sourceMappingURL=MessageBroker.js.map