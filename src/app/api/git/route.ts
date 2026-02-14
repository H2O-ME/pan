import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';

interface GitFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
}

const getOctokit = () => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not configured');
  return new Octokit({ auth: token });
};

const owner = process.env.GITHUB_OWNER || '';
const repo = process.env.GITHUB_REPO || '';

// 获取文件列表
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') || '';
  const action = searchParams.get('action');

  try {
    const octokit = getOctokit();

    // 如果是下载操作
    if (action === 'download') {
      const sha = searchParams.get('sha');
      
      // 优先方案：获取文件的 download_url 并重定向，利用浏览器直连 GitHub 节点，绕过服务器转发
      const response = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });

      if (Array.isArray(response.data)) {
        return NextResponse.json({ error: 'Not a file' }, { status: 400 });
      }

      if ('download_url' in response.data && response.data.download_url) {
        // 返回直连地址，让前端直接 fetch 这个地址，避开 API 代理
        return NextResponse.json({ 
          downloadUrl: response.data.download_url,
          name: response.data.name
        });
      }

      // 回退方案：如果无法获取直连地址（如私有库或特殊情况），则手动获取内容并流式返回
      let contentBuffer: Buffer;
      if ('content' in response.data && response.data.content) {
        contentBuffer = Buffer.from(response.data.content, 'base64');
      } else {
        const blob = await octokit.rest.git.getBlob({
          owner,
          repo,
          file_sha: sha || response.data.sha,
        });
        contentBuffer = Buffer.from(blob.data.content, 'base64');
      }

      return new NextResponse(contentBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(response.data.name)}"`,
        },
      });
    }

    // 如果是搜索操作
    if (action === 'search') {
      // 首先获取默认分支
      const repoInfo = await octokit.rest.repos.get({
        owner,
        repo,
      });
      const defaultBranch = repoInfo.data.default_branch;

      const response = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: defaultBranch,
        recursive: 'true',
      });

      const files = response.data.tree
        .filter(item => item.type === 'blob' || item.type === 'tree')
        .map(item => ({
          name: item.path?.split('/').pop() || '',
          path: item.path || '',
          sha: item.sha || '',
          size: item.size || 0,
          type: item.type === 'blob' ? 'file' : 'dir',
        }));

      return NextResponse.json(files);
    }

    // 默认列表操作
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    });

    // 格式化数据，只返回前端需要的字段，隐藏 GitHub 内部 URL
    const files = (Array.isArray(response.data) ? response.data : [response.data]).map(file => ({
      name: file.name,
      path: file.path,
      sha: file.sha,
      size: file.size,
      type: file.type,
    }));

    return NextResponse.json(files);
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 404 || err?.message?.includes('empty')) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}

// 上传文件
export async function POST(request: Request) {
  try {
    const { path, content, sha, message } = await request.json();
    const octokit = getOctokit();

    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: message || 'Upload via Git Cloud Pan',
      content, // 前端已经加密并转为 Base64 的内容
      sha: sha || undefined,
    });

    return NextResponse.json({ success: true, sha: response.data.content?.sha });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}

// 删除文件或文件夹
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const dirPath = searchParams.get('path');

  try {
    const octokit = getOctokit();

    if (action === 'deleteDir' && dirPath) {
      // 递归删除文件夹
      // 1. 获取文件夹下的所有内容
      const getRecursiveFiles = async (path: string): Promise<GitFile[]> => {
        const response = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
        });
        
        let files: GitFile[] = [];
        const items = Array.isArray(response.data) ? response.data : [response.data];
        
        for (const item of items) {
          if (item.type === 'dir') {
            const subFiles = await getRecursiveFiles(item.path);
            files = [...files, ...subFiles];
          } else {
            files.push({
              name: item.name,
              path: item.path,
              sha: item.sha,
              size: item.size,
              type: 'file'
            });
          }
        }
        return files;
      };

      const allFiles = await getRecursiveFiles(dirPath);
      
      // 2. 逐个删除文件
      for (const file of allFiles) {
        await octokit.rest.repos.deleteFile({
          owner,
          repo,
          path: file.path,
          message: `Delete folder ${dirPath} - removing ${file.name}`,
          sha: file.sha,
        });
      }

      return NextResponse.json({ success: true, count: allFiles.length });
    }

    // 普通文件删除
    const { path, sha, message } = await request.json();
    await octokit.rest.repos.deleteFile({
      owner,
      repo,
      path,
      message: message || 'Delete via Git Cloud Pan',
      sha,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
