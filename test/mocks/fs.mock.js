"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fsExtra = exports.fs = exports.fsExtraMock = exports.fsMock = void 0;
// FSモジュールのモック
exports.fsMock = {
    existsSync: jest.fn().mockReturnValue(true),
    readFileSync: jest.fn().mockReturnValue('{}'),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn()
};
// fs-extraモジュールのモック
exports.fsExtraMock = {
    existsSync: jest.fn().mockReturnValue(true),
    readFileSync: jest.fn().mockReturnValue('{}'),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    ensureDirSync: jest.fn()
};
// シングルトンインスタンス
exports.fs = exports.fsMock;
exports.fsExtra = exports.fsExtraMock;
//# sourceMappingURL=fs.mock.js.map