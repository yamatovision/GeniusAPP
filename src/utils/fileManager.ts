import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

export class FileManager {
  /**
   * ファイルを読み込む
   */
  public static async readFile(filePath: string): Promise<string> {
    try {
      const uri = vscode.Uri.file(filePath);
      const content = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(content).toString('utf-8');
    } catch (error) {
      Logger.error(`Failed to read file ${filePath}`, error as Error);
      throw new Error(`ファイル ${filePath} の読み込みに失敗しました`);
    }
  }

  /**
   * ファイルに書き込む
   */
  public static async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const uri = vscode.Uri.file(filePath);
      const data = Buffer.from(content, 'utf-8');
      await vscode.workspace.fs.writeFile(uri, data);
      Logger.debug(`File ${filePath} written successfully`);
    } catch (error) {
      Logger.error(`Failed to write file ${filePath}`, error as Error);
      throw new Error(`ファイル ${filePath} の書き込みに失敗しました`);
    }
  }

  /**
   * ディレクトリを作成する
   */
  public static async createDirectory(dirPath: string): Promise<void> {
    try {
      const uri = vscode.Uri.file(dirPath);
      await vscode.workspace.fs.createDirectory(uri);
      Logger.debug(`Directory ${dirPath} created successfully`);
    } catch (error) {
      Logger.error(`Failed to create directory ${dirPath}`, error as Error);
      throw new Error(`ディレクトリ ${dirPath} の作成に失敗しました`);
    }
  }

  /**
   * ファイルが存在するか確認する
   */
  public static async fileExists(filePath: string): Promise<boolean> {
    try {
      const uri = vscode.Uri.file(filePath);
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * ディレクトリが存在するか確認する
   */
  public static async directoryExists(dirPath: string): Promise<boolean> {
    return this.fileExists(dirPath);
  }

  /**
   * ディレクトリ内のファイル・フォルダをリストアップする
   */
  public static async listDirectory(dirPath: string): Promise<string[]> {
    try {
      const uri = vscode.Uri.file(dirPath);
      const entries = await vscode.workspace.fs.readDirectory(uri);
      return entries.map(entry => entry[0]);
    } catch (error) {
      Logger.error(`Failed to list directory ${dirPath}`, error as Error);
      throw new Error(`ディレクトリ ${dirPath} の読み取りに失敗しました`);
    }
  }

  /**
   * ファイルを開く
   */
  public static async openFile(filePath: string): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(document);
      Logger.debug(`File ${filePath} opened successfully`);
    } catch (error) {
      Logger.error(`Failed to open file ${filePath}`, error as Error);
      throw new Error(`ファイル ${filePath} を開くことができませんでした`);
    }
  }

  /**
   * 一時ファイルを作成する
   */
  public static async createTempFile(content: string, extension: string = '.txt'): Promise<string> {
    try {
      // 一時ディレクトリを取得
      const tempDir = path.join(process.env.TEMP || process.env.TMP || '/tmp', 'appgenius-ai');
      
      // 一時ディレクトリが存在しない場合は作成
      if (!await this.directoryExists(tempDir)) {
        await this.createDirectory(tempDir);
      }
      
      // ユニークなファイル名を生成
      const fileName = `temp_${Date.now()}${extension}`;
      const filePath = path.join(tempDir, fileName);
      
      // ファイルに内容を書き込む
      await this.writeFile(filePath, content);
      
      return filePath;
    } catch (error) {
      Logger.error('Failed to create temp file', error as Error);
      throw new Error('一時ファイルの作成に失敗しました');
    }
  }
}