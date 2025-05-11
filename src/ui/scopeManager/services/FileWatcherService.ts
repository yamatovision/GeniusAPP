import { IFileWatcherService } from './interfaces/IFileWatcherService';
import { FileWatcherServiceImpl } from './implementations/FileWatcherServiceImpl';

/**
 * ファイル監視サービスを提供
 * シングルトンパターンで実装
 */
export class FileWatcherService {
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): IFileWatcherService {
    return FileWatcherServiceImpl.getInstance();
  }
}

// インターフェースのエクスポート
export { IFileWatcherService } from './interfaces/IFileWatcherService';