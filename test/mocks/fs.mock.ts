// FSモジュールのモック
export const fsMock = {
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('{}'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn()
};

// fs-extraモジュールのモック
export const fsExtraMock = {
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('{}'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  ensureDirSync: jest.fn()
};

// シングルトンインスタンス
export const fs = fsMock;
export const fsExtra = fsExtraMock;