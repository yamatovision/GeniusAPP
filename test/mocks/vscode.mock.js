"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vscode = exports.vscodeMock = void 0;
// VSCodeモジュールのモック
exports.vscodeMock = {
    window: {
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        createStatusBarItem: jest.fn().mockReturnValue({
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn()
        }),
        createOutputChannel: jest.fn().mockReturnValue({
            appendLine: jest.fn(),
            clear: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn()
        }),
        createWebviewPanel: jest.fn().mockReturnValue({
            webview: {
                onDidReceiveMessage: jest.fn(),
                postMessage: jest.fn(),
                html: ''
            },
            onDidDispose: jest.fn(),
            onDidChangeViewState: jest.fn(),
            reveal: jest.fn(),
            dispose: jest.fn()
        })
    },
    commands: {
        registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        executeCommand: jest.fn()
    },
    workspace: {
        getConfiguration: jest.fn().mockReturnValue({
            get: jest.fn(),
            update: jest.fn()
        }),
        workspaceFolders: [{ uri: { fsPath: '/test/path' } }],
        onDidChangeConfiguration: jest.fn().mockReturnValue({ dispose: jest.fn() })
    },
    EventEmitter: jest.fn().mockImplementation(() => ({
        event: 'mock-event',
        fire: jest.fn(),
        dispose: jest.fn()
    })),
    Disposable: {
        from: jest.fn()
    },
    ViewColumn: {
        One: 1,
        Two: 2,
        Three: 3
    },
    StatusBarAlignment: {
        Left: 1,
        Right: 2
    },
    Uri: {
        file: jest.fn().mockImplementation(path => ({ fsPath: path })),
        parse: jest.fn(),
        joinPath: jest.fn().mockImplementation((...paths) => ({ fsPath: paths.join('/') }))
    },
    ThemeColor: jest.fn(),
    env: {
        openExternal: jest.fn()
    }
};
// シングルトンインスタンス
exports.vscode = exports.vscodeMock;
//# sourceMappingURL=vscode.mock.js.map