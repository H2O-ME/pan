import { Octokit } from 'octokit';
import { encrypt, decrypt } from './crypto';

// 注意：在纯前端项目中，GitHub Token 必须由用户提供，不能硬编码在源码中。
// 我们将引导用户在设置中输入自己的 GitHub Token，并使用 APP_PASSWORD 进行加密后存储在 localStorage。

export class GitCloudService {
  private octokit: Octokit | null = null;
  private owner: string = '';
  private repo: string = '';

  constructor(token: string, owner: string, repo: string) {
    this.octokit = new Octokit({ auth: token });
    this.owner = owner;
    this.repo = repo;
  }

  /**
   * 获取文件列表
   * @param path 路径
   */
  async getFiles(path: string = '') {
    if (!this.octokit) throw new Error('Not initialized');
    
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: path,
      });

      return response.data;
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      // 如果仓库为空，GitHub API 会返回 404 或特定错误信息
      if (err?.status === 404 || err?.message?.includes('empty')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * 上传文件（加密）
   * @param path 路径
   * @param content 文件内容 (ArrayBuffer or string)
   * @param encryptionKey 加密密钥
   */
  async uploadFile(path: string, content: string, encryptionKey: string, message: string = 'Upload file') {
    if (!this.octokit) throw new Error('Not initialized');

    // 加密内容
    const encryptedContent = encrypt(content, encryptionKey);
    // Base64 编码
    const base64Content = btoa(encryptedContent);

    // 检查文件是否存在以获取 sha
    let sha: string | undefined;
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: path,
      });
      if (!Array.isArray(data)) {
        sha = data.sha;
      }
    } catch {
      // 文件不存在
    }

    return await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path: path,
      message: message,
      content: base64Content,
      sha: sha,
    });
  }

  /**
   * 下载文件（解密）
   * @param path 路径
   * @param encryptionKey 解密密钥
   */
  async downloadFile(path: string, encryptionKey: string) {
    if (!this.octokit) throw new Error('Not initialized');

    const response = await this.octokit.rest.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path: path,
    });

    if (Array.isArray(response.data)) {
      throw new Error('Not a file');
    }

    if ('content' in response.data) {
      const base64Content = response.data.content.replace(/\n/g, '');
      const encryptedContent = atob(base64Content);
      const decryptedContent = decrypt(encryptedContent, encryptionKey);
      return decryptedContent;
    }

    throw new Error('No content found');
  }

  /**
   * 删除文件
   */
  async deleteFile(path: string, sha: string, message: string = 'Delete file') {
    if (!this.octokit) throw new Error('Not initialized');

    return await this.octokit.rest.repos.deleteFile({
      owner: this.owner,
      repo: this.repo,
      path: path,
      sha: sha,
      message: message,
    });
  }
}
