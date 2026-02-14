'use client';

import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  Download, 
  Trash2, 
  Upload, 
  RefreshCw, 
  Plus,
  ShieldCheck,
  HardDrive,
  FileImage,
  FileVideo,
  FileCode,
  Search,
  MoreVertical,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  File as FileIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GitConfig {
  owner: string;
  repo: string;
  token: string;
}

interface GitFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
}

interface UploadProgress {
  name: string;
  progress: number;
  status: 'uploading' | 'encrypting' | 'completed' | 'error';
}

export default function FileExplorer() {
  const [files, setFiles] = useState<GitFile[]>([]);
  const [allFiles, setAllFiles] = useState<GitFile[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [gitConfig, setGitConfig] = useState<GitConfig | null>(null);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalFilesCount, setTotalFilesCount] = useState<number | null>(null);
  const [draggedFile, setDraggedFile] = useState<GitFile | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  // 弹窗状态
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [movingFile, setMovingFile] = useState<GitFile | null>(null);
  const [targetMovePath, setTargetMovePath] = useState('');

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingFile, setDeletingFile] = useState<GitFile | null>(null);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    const init = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appKey = (window as any).__APP_KEY__;
      if (!appKey) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/config');
        const result = await res.json();
        
        if (result.success) {
          const { decrypt } = await import('@/lib/crypto');
          const decrypted = await decrypt(result.data, appKey);
          if (decrypted) {
            const config: GitConfig = JSON.parse(decrypted);
            setGitConfig(config);
            loadFiles(config, '');
          }
        }
      } catch {
        toast.error('配置加载失败');
      }
    };
    init();
  }, []);

  const loadFiles = async (config: GitConfig | null, path: string) => {
    if (!config) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/git?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setFiles(data);
      setCurrentPath(path);
    } catch {
      toast.error('文件加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async (file: GitFile, targetPath?: string) => {
    const newPath = targetPath;
    if (!newPath) {
      setMovingFile(file);
      setTargetMovePath(file.path);
      setIsMoveDialogOpen(true);
      return;
    }
    
    executeMove(file, newPath);
  };

  const executeMove = async (file: GitFile, newPath: string) => {
    if (!newPath || newPath === file.path) return;

    const toastId = toast.loading(`正在移动: ${file.name}...`);
    try {
      // 步骤 1: 获取内容
      toast.loading(`正在准备文件内容: ${file.name}`, { id: toastId });
      const resGet = await fetch(`/api/git?action=download&path=${encodeURIComponent(file.path)}&sha=${file.sha}`);
      if (!resGet.ok) throw new Error('获取原文件内容失败');
      const fileBuffer = await resGet.arrayBuffer();
      
      // 步骤 2: 在新位置创建
      toast.loading(`正在将 ${file.name} 写入新目录...`, { id: toastId });
      
      // 转换 ArrayBuffer 为 Base64 用于 POST 上传 (GitHub API 要求 Base64)
      const { encryptFile } = await import('@/lib/crypto');
      // 这里不需要重新加密，只需要将已加密的二进制转为 Base64
      const base64Content = await new Promise<string>((resolve) => {
        const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          resolve(dataUrl.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });

      const resCreate = await fetch('/api/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: newPath,
          content: base64Content,
          message: `Move ${file.name} to ${newPath}`
        })
      });

      if (!resCreate.ok) throw new Error('在新位置创建文件失败');

      // 步骤 3: 删除旧文件
      toast.loading(`正在清理旧位置的文件...`, { id: toastId });
      const resDelete = await fetch('/api/git', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: file.path,
          sha: file.sha,
          message: `Remove old file after move: ${file.name}`
        })
      });

      if (!resDelete.ok) throw new Error('清理旧文件失败');

      toast.success(`移动成功: ${file.name} -> ${newPath}`, { id: toastId });
      setIsMoveDialogOpen(false);
      loadFiles(gitConfig, currentPath);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(`移动失败: ${err.message || file.name}`, { id: toastId });
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName || !newFolderName.trim()) return;

    const toastId = toast.loading(`正在创建文件夹: ${newFolderName}...`);
    try {
      const res = await fetch('/api/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `${currentPath ? currentPath + '/' : ''}${newFolderName}/.keep`,
          content: btoa('This is a placeholder for a new folder.'),
          message: `Create folder ${newFolderName}`
        })
      });

      if (!res.ok) throw new Error('网络请求失败');
      
      toast.success(`文件夹创建成功: ${newFolderName}`, { id: toastId });
      setIsCreateFolderOpen(false);
      setNewFolderName('');
      loadFiles(gitConfig, currentPath);
    } catch {
      toast.error(`创建文件夹失败: ${newFolderName}`, { id: toastId });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appKey = (window as any).__APP_KEY__;
    const uploadId = file.name;
    
    setUploads(prev => [...prev, { name: file.name, progress: 0, status: 'encrypting' }]);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as ArrayBuffer;
      
      try {
        setUploads(prev => prev.map(u => u.name === uploadId ? { ...u, status: 'uploading', progress: 30 } : u));
        
        const { encryptFile } = await import('@/lib/crypto');
        const encryptedContent = await encryptFile(content, appKey);
        
        setUploads(prev => prev.map(u => u.name === uploadId ? { ...u, progress: 60 } : u));

        const res = await fetch('/api/git', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: `${currentPath ? currentPath + '/' : ''}${file.name}`,
            content: encryptedContent,
            message: `Upload ${file.name}`
          })
        });

        if (!res.ok) throw new Error('Upload failed');
        
        setUploads(prev => prev.map(u => u.name === uploadId ? { ...u, progress: 100, status: 'completed' } : u));
        toast.success(`上传成功: ${file.name}`);
        
        setTimeout(() => {
          setUploads(prev => prev.filter(u => u.name !== uploadId));
        }, 3000);
        
        loadFiles(gitConfig, currentPath);
      } catch {
        setUploads(prev => prev.map(u => u.name === uploadId ? { ...u, status: 'error' } : u));
        toast.error(`上传失败: ${file.name}`);
        
        // 错误卡片也在 5 秒后自动消失
        setTimeout(() => {
          setUploads(prev => prev.filter(u => u.name !== uploadId));
        }, 5000);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownload = async (file: GitFile) => {
    if (downloadingFiles.has(file.sha)) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appKey = (window as any).__APP_KEY__;
    const toastId = toast.loading(`正在请求文件: ${file.name}`);
    
    setDownloadingFiles(prev => new Set(prev).add(file.sha));
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 增加到60秒超时，适配大文件或慢速网络

    try {
      const res = await fetch(`/api/git?action=download&path=${encodeURIComponent(file.path)}&sha=${file.sha}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('网络请求失败');
      
      toast.loading(`正在解密文件: ${file.name}`, { id: toastId });
      
      let encryptedBuffer: ArrayBuffer;
      const contentType = res.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        // 如果返回的是 JSON，说明是直连地址
        const data = await res.json();
        if (data.downloadUrl) {
          // 使用直连地址 fetch 数据，避开 API 代理，直接从 GitHub CDN 下载
          const directRes = await fetch(data.downloadUrl, {
            signal: controller.signal
          });
          if (!directRes.ok) throw new Error('直连下载失败');
          encryptedBuffer = await directRes.arrayBuffer();
        } else {
          throw new Error('未获取到有效的下载地址');
        }
      } else {
        // 如果直接返回二进制，说明已经是文件内容
        encryptedBuffer = await res.arrayBuffer();
      }
      
      const { decryptFile } = await import('@/lib/crypto');
      const decryptedBuffer = await decryptFile(encryptedBuffer, appKey);
      
      toast.loading(`准备下载: ${file.name}`, { id: toastId });
      const blob = new Blob([decryptedBuffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`下载已开始: ${file.name}`, { id: toastId });
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const err = error as { name?: string; message?: string };
      if (err.name === 'AbortError') {
        toast.error('请求超时，请检查网络后重试', { id: toastId });
      } else {
        toast.error(`下载失败: ${err.message || file.name}`, { id: toastId });
      }
    } finally {
      setDownloadingFiles(prev => {
        const next = new Set(prev);
        next.delete(file.sha);
        return next;
      });
    }
  };

  const handleDelete = async (file: GitFile) => {
    setDeletingFile(file);
    setIsDeleteDialogOpen(true);
  };

  const executeDelete = async () => {
    if (!deletingFile) return;
    const file = deletingFile;
    const isDir = file.type === 'dir';

    const toastId = toast.loading(`正在删除: ${file.name}...`);
    try {
      if (isDir) {
        toast.loading(`正在扫描文件夹内容...`, { id: toastId });
        const res = await fetch(`/api/git?action=deleteDir&path=${encodeURIComponent(file.path)}`, {
          method: 'DELETE'
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || '删除目录失败');
        }
      } else {
        const res = await fetch('/api/git', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: file.path,
            sha: file.sha,
            message: `Delete ${file.name}`
          })
        });
        if (!res.ok) throw new Error('网络请求失败');
      }

      toast.success(`已成功删除: ${file.name}`, { id: toastId });
      setIsDeleteDialogOpen(false);
      loadFiles(gitConfig, currentPath);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(`删除失败: ${err.message || file.name}`, { id: toastId });
    }
  };

  const getFileIcon = (file: GitFile) => {
    if (file.type === 'dir') return (
      <div className="bg-zinc-100 p-2 rounded-lg">
        <Folder className="w-5 h-5 text-zinc-900 fill-zinc-900" />
      </div>
    );
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    const iconClass = "w-5 h-5 text-zinc-500 group-hover:text-black transition-colors";
    
    let icon = <FileIcon className={iconClass} />;
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext!)) icon = <FileImage className={iconClass} />;
    else if (['mp4', 'webm', 'mov'].includes(ext!)) icon = <FileVideo className={iconClass} />;
    else if (['js', 'ts', 'tsx', 'html', 'css', 'json', 'py', 'go', 'rs', 'c', 'cpp'].includes(ext!)) icon = <FileCode className={iconClass} />;
    
    return (
      <div className="bg-zinc-50 p-2 rounded-lg group-hover:bg-white transition-colors">
        {icon}
      </div>
    );
  };

  const handleBack = () => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    loadFiles(gitConfig, parts.join('/'));
  };

  const onDragStart = (e: React.DragEvent, file: GitFile) => {
    setDraggedFile(file);
    e.dataTransfer.setData('text/plain', file.path);
    // 设置拖拽预览图
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragEnd = () => {
    setDraggedFile(null);
    setDragOverPath(null);
  };

  const onDragOver = (e: React.DragEvent, folder: GitFile) => {
    e.preventDefault();
    if (draggedFile && draggedFile.path !== folder.path) {
      setDragOverPath(folder.path);
    }
  };

  const onDragLeave = () => {
    setDragOverPath(null);
  };

  const onDrop = async (e: React.DragEvent, targetFolder: GitFile) => {
    e.preventDefault();
    setDragOverPath(null);
    if (!draggedFile || draggedFile.path === targetFolder.path) return;
    
    const newPath = `${targetFolder.path}/${draggedFile.name}`;
    await handleMove(draggedFile, newPath);
    setDraggedFile(null);
  };

  useEffect(() => {
    if (gitConfig) {
      const fetchTotalCount = async () => {
        try {
          const res = await fetch('/api/git?action=search');
          if (res.ok) {
            const data = await res.json();
            setAllFiles(data);
            // 过滤掉文件夹，只统计文件数量
            const onlyFiles = data.filter((f: GitFile) => f.type === 'file');
            setTotalFilesCount(onlyFiles.length);
          }
        } catch (error) {
          console.error('Failed to fetch all files for total count', error);
        }
      };
      fetchTotalCount();
    }
  }, [gitConfig]);

  useEffect(() => {
    if (searchQuery.length > 0 && allFiles.length === 0 && gitConfig) {
      const fetchAllFiles = async () => {
        try {
          const res = await fetch('/api/git?action=search');
          if (res.ok) {
            const data = await res.json();
            setAllFiles(data);
          }
        } catch (error) {
          console.error('Failed to fetch all files for search', error);
        }
      };
      fetchAllFiles();
    }
  }, [searchQuery, allFiles.length, gitConfig]);

  const filteredFiles = searchQuery.length > 0 
    ? allFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : files;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen w-full bg-zinc-50 flex flex-col selection:bg-zinc-950 selection:text-white font-sans antialiased text-zinc-900 relative">
      {/* 背景水印/签名 - 融入背景 */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none z-0">
        <a 
          href="https://blog.tianhw.top" 
          target="_blank" 
          rel="noopener noreferrer"
          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full pointer-events-auto select-none transition-all duration-300 hover:bg-zinc-100/50 active:scale-95"
        >
          <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.4em] group-hover:text-zinc-500 transition-colors">
            Powered by THW
          </span>
          <ExternalLink className="w-2.5 h-2.5 text-zinc-200 group-hover:text-zinc-400 transition-colors" />
        </a>
      </div>

      {/* 顶部导航栏 - 统一为专业简洁风格 */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center gap-2 cursor-pointer group active:scale-95 transition-all duration-200" 
              onClick={() => loadFiles(gitConfig, '')}
            >
              <ShieldCheck className="w-5 h-5 text-zinc-950" />
              <span className="text-sm font-bold tracking-tight text-zinc-950">GitCloud</span>
            </div>
            
            <div className="h-4 w-px bg-zinc-200 mx-1 hidden sm:block" />
            
            <Breadcrumb className="hidden md:block">
              <BreadcrumbList className="text-[10px] font-bold text-zinc-500">
                <BreadcrumbItem>
                  <BreadcrumbLink 
                    className="hover:text-zinc-950 transition-all cursor-pointer active:scale-95 inline-block"
                    onClick={() => loadFiles(gitConfig, '')}
                  >
                    ROOT
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
                  <React.Fragment key={i}>
                    <BreadcrumbSeparator className="text-zinc-300" />
                    <BreadcrumbItem>
                      {i === arr.length - 1 ? (
                        <BreadcrumbPage className="text-zinc-950">{part.toUpperCase()}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          className="hover:text-zinc-950 transition-all cursor-pointer active:scale-95 inline-block"
                          onClick={() => loadFiles(gitConfig, arr.slice(0, i + 1).join('/'))}
                        >
                          {part.toUpperCase()}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => loadFiles(gitConfig, currentPath)} 
              disabled={loading}
              className="h-8 w-8 text-zinc-500 hover:text-zinc-950 active:scale-90 active:bg-zinc-100 transition-all duration-200"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 relative z-10 pb-24">
        {/* 操作区：搜索与主要操作 */}
        <div className="flex flex-col gap-3 mb-6 items-stretch sm:flex-row sm:items-center">
          <div className="relative flex-1 group">
            <Search className={cn(
              "w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 z-10 transition-colors duration-200",
              searchQuery && "text-zinc-950"
            )} />
            <Input 
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-zinc-200 rounded-xl h-10 text-sm focus-visible:ring-zinc-950 shadow-sm pr-10 transition-all duration-200 focus:shadow-md"
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-all p-1 rounded-full hover:bg-zinc-100 active:scale-90 z-20"
                >
                  <Plus className="w-4 h-4 rotate-45" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="flex-1 sm:flex-none">
              <Input 
                type="file" 
                className="hidden" 
                onChange={handleUpload}
                disabled={loading}
              />
              <Button asChild size="sm" className="w-full bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl h-10 px-4 font-bold transition-all active:scale-[0.96] cursor-pointer shadow-sm">
                <span>
                  <Upload className="w-3.5 h-3.5 mr-2" />
                  Upload
                </span>
              </Button>
            </label>
            <Button 
              variant="outline" 
              size="sm"
              className="rounded-xl h-10 border-zinc-200 hover:bg-zinc-50 px-4 font-bold text-zinc-700 bg-white shadow-sm active:scale-[0.96] transition-all" 
              onClick={() => setIsCreateFolderOpen(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-2" />
              Folder
            </Button>
          </div>
        </div>

        {/* 状态统计卡片 - 扁平化设计 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
          {[
            { 
              label: 'Repo', 
              value: `${gitConfig?.owner}/${gitConfig?.repo}`, 
              icon: HardDrive,
              onClick: () => gitConfig && window.open(`https://github.com/${gitConfig.owner}/${gitConfig.repo}`, '_blank')
            },
            { label: 'Files', value: totalFilesCount !== null ? totalFilesCount : files.length, icon: FileIcon },
            { label: 'Security', value: 'AES-256', icon: ShieldCheck }
          ].map((item, idx) => (
            <Card 
              key={idx} 
              className={cn(
                "border border-zinc-200 shadow-sm bg-white overflow-hidden min-h-[48px] flex items-center",
                item.onClick && "cursor-pointer hover:bg-zinc-50 transition-colors active:scale-[0.98]"
              )}
              onClick={item.onClick}
            >
              <CardContent className="p-2.5 w-full flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center border bg-zinc-50 border-zinc-100 text-zinc-600">
                    <item.icon className="w-3 h-3" />
                  </div>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{item.label}</span>
                </div>
                <p className="text-[11px] font-bold text-zinc-900 truncate text-right flex-1">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 上传任务状态 */}
        {uploads.length > 0 && (
          <div className="mb-8 space-y-2">
            <AnimatePresence>
              {uploads.map((u, i) => (
                <motion.div 
                  key={u.name + i} 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="bg-white border border-zinc-200 rounded-xl p-3 shadow-sm flex flex-col gap-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 flex items-center justify-center">
                      {u.status === 'completed' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : 
                       u.status === 'error' ? <AlertCircle className="w-4 h-4 text-red-600" /> : 
                       <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />}
                    </div>
                    <div className="flex-1 flex flex-col min-w-0 justify-center">
                      <span className="text-sm font-bold text-zinc-900 truncate leading-tight mb-0.5">{u.name}</span>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-tight">{u.status}</span>
                    </div>
                    <div className="shrink-0 flex items-center">
                      <span className="text-xs font-bold text-zinc-900 tabular-nums">{Math.round(u.progress)}%</span>
                    </div>
                  </div>
                  <Progress value={u.progress} className="h-1 rounded-full bg-zinc-100" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* 文件列表 - 提升对比度和可见度 */}
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 px-6 py-4 text-[12px] font-bold text-zinc-500 uppercase tracking-[0.1em] bg-zinc-50/50 border-b border-zinc-100 hidden md:grid">
            <div className="col-span-7">文件名</div>
            <div className="col-span-2 text-center">大小</div>
            <div className="col-span-3 text-right">操作</div>
          </div>
          
          <div className="divide-y divide-zinc-100 relative min-h-[400px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentPath + (searchQuery ? '-search' : '')}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="w-full"
              >
                {currentPath && !searchQuery && (
                  <div 
                    className="grid grid-cols-12 px-6 py-4 items-center hover:bg-zinc-50 transition-all cursor-pointer group active:scale-[0.99] active:bg-zinc-100/80"
                    onClick={handleBack}
                  >
                    <div className="col-span-12 flex items-center gap-4">
                      <div className="bg-zinc-100 p-2 rounded-lg group-hover:bg-zinc-200 transition-colors">
                        <Folder className="w-5 h-5 text-zinc-600" />
                      </div>
                      <span className="text-sm font-bold text-zinc-700">.. (返回上级)</span>
                    </div>
                  </div>
                )}
                
                {loading && filteredFiles.length === 0 ? (
                  <div className="p-8 space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-[40%]" />
                          <Skeleton className="h-3 w-[20%]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="py-24 text-center">
                    <Folder className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                    <p className="text-zinc-500 font-medium">未找到相关文件</p>
                  </div>
                ) : (
                  filteredFiles.map((file) => (
                    <div 
                      key={file.sha} 
                      className={cn(
                        "grid grid-cols-12 px-6 py-4 items-center hover:bg-zinc-50 transition-all group relative cursor-pointer active:scale-[0.99] active:bg-zinc-100/50",
                        draggedFile?.sha === file.sha && "opacity-50",
                        dragOverPath === file.path && "bg-zinc-100 ring-2 ring-inset ring-zinc-950 z-10"
                      )}
                      draggable={file.type === 'file'}
                      onDragStart={(e) => file.type === 'file' && onDragStart(e, file)}
                      onDragEnd={onDragEnd}
                      onDragOver={file.type === 'dir' ? (e) => onDragOver(e, file) : undefined}
                      onDragLeave={file.type === 'dir' ? onDragLeave : undefined}
                      onDrop={file.type === 'dir' ? (e) => onDrop(e, file) : undefined}
                      onClick={() => file.type === 'dir' ? loadFiles(gitConfig, file.path) : handleDownload(file)}
                    >
                      <div className="col-span-12 md:col-span-7 flex items-center gap-4 min-w-0">
                        <div className="shrink-0">
                          {getFileIcon(file)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-zinc-900 group-hover:text-zinc-950 transition-colors text-left truncate">
                            {file.name}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">
                              {file.type === 'dir' ? '文件夹' : file.name.split('.').pop() || '文件'}
                            </span>
                            <span className="md:hidden text-[10px] text-zinc-400 font-bold">
                              • {file.type === 'dir' ? '-' : formatSize(file.size)}
                            </span>
                            {searchQuery && file.path.includes('/') && (
                              <span className="text-[10px] text-zinc-400 truncate max-w-[150px]">
                                • 在 /{file.path.split('/').slice(0, -1).join('/')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="hidden md:block col-span-2 text-center">
                        <span className="text-xs font-bold text-zinc-600">
                          {file.type === 'dir' ? '--' : formatSize(file.size)}
                        </span>
                      </div>
                      
                      <div className="col-span-12 md:col-span-3 flex justify-end gap-1.5 mt-4 md:mt-0">
                        {file.type === 'file' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-3 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg font-bold text-xs active:scale-90 transition-all" 
                            disabled={downloadingFiles.has(file.sha)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file);
                            }}
                          >
                            {downloadingFiles.has(file.sha) ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            {downloadingFiles.has(file.sha) ? 'Downloading...' : 'Download'}
                          </Button>
                        )}
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg active:scale-90 transition-all"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="end" 
                            className="w-40 rounded-xl border-zinc-200 shadow-lg p-1 bg-white"
                          >
                            <DropdownMenuItem 
                              className="cursor-pointer gap-2 py-2 text-xs font-bold text-zinc-700 rounded-lg hover:bg-zinc-50 active:scale-95 transition-transform" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMove(file);
                              }}
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              移动到
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="cursor-pointer gap-2 py-2 text-xs font-bold text-red-600 rounded-lg hover:bg-red-50 hover:text-red-700 active:scale-95 transition-transform" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(file);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              删除{file.type === 'dir' ? '文件夹' : '文件'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* 创建文件夹弹窗 */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">创建新文件夹</DialogTitle>
            <DialogDescription>
              在当前目录下创建一个新的文件夹。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="文件夹名称"
              className="h-12 rounded-xl border-zinc-200 focus-visible:ring-zinc-950"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsCreateFolderOpen(false)} className="rounded-xl h-11 font-bold active:scale-95 transition-all">取消</Button>
            <Button onClick={handleCreateFolder} className="bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl h-11 font-bold active:scale-95 transition-all">创建文件夹</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 移动/重命名文件弹窗 */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">移动或重命名</DialogTitle>
            <DialogDescription>
              请输入 {movingFile?.name} 的目标路径（相对于根目录）。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={targetMovePath}
              onChange={(e) => setTargetMovePath(e.target.value)}
              placeholder="目标路径"
              className="h-12 rounded-xl border-zinc-200 focus-visible:ring-zinc-950"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && executeMove(movingFile!, targetMovePath)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)} className="rounded-xl h-11 font-bold active:scale-95 transition-all">取消</Button>
            <Button onClick={() => executeMove(movingFile!, targetMovePath)} className="bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl h-11 font-bold active:scale-95 transition-all">确认移动</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl border-red-100">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              确认删除
            </DialogTitle>
            <DialogDescription className="pt-2 text-zinc-600 font-medium">
              确定要删除{deletingFile?.type === 'dir' ? '文件夹及其所有内容' : '文件'} <span className="font-bold text-zinc-950">&quot;{deletingFile?.name}&quot;</span> 吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-xl h-11 font-bold active:scale-95 transition-all">取消</Button>
            <Button onClick={executeDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-11 font-bold border-none active:scale-95 transition-all">确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
