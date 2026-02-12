'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  RefreshCw, 
  Search, 
  LayoutGrid, 
  List, 
  Download, 
  File, 
  Image as ImageIcon, 
  Video, 
  FileArchive,
  Home,
  Clock,
  Share2,
  MoreVertical,
  LogOut,
  ChevronRight,
  Plus,
  Menu,
  Music,
  Folder,
  FolderPlus,
  Edit3,
  Trash2,
  X,
  Eye,
  FileCode,
  Box
} from 'lucide-react';

interface FileInfo {
  name: string;
  proxyUrl: string;
  isDir?: boolean;
}

const getFileIcon = (name: string, isDir?: boolean) => {
  if (isDir) return <Folder className="w-8 h-8 text-amber-400 fill-amber-400" />;
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg': case 'jpeg': case 'png': case 'gif': case 'svg': case 'webp':
      return <ImageIcon className="w-8 h-8 text-rose-500" />;
    case 'mp4': case 'mov': case 'avi': case 'webm':
      return <Video className="w-8 h-8 text-indigo-500" />;
    case 'mp3': case 'wav': case 'ogg': case 'flac':
      return <Music className="w-8 h-8 text-purple-500" />;
    case 'zip': case 'rar': case '7z': case 'tar': case 'gz':
      return <FileArchive className="w-8 h-8 text-amber-500" />;
    case 'pdf':
      return <FileText className="w-8 h-8 text-emerald-500" />;
    case 'docx': case 'doc':
      return <FileText className="w-8 h-8 text-blue-500" />;
    case 'xlsx': case 'xls':
      return <FileText className="w-8 h-8 text-green-600" />;
    case 'pptx': case 'ppt':
      return <FileText className="w-8 h-8 text-orange-500" />;
    case 'js': case 'ts': case 'tsx': case 'jsx': case 'json': case 'html': case 'css':
      return <FileCode className="w-8 h-8 text-blue-400" />;
    default:
      return <File className="w-8 h-8 text-slate-400" />;
  }
};

export default function CloudreveImprovedUI() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionsLoading, setIsActionsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; progress: number; speed: string } | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      if (data.files) {
        // Group files by path to simulate directory structure
        const processedFiles: FileInfo[] = data.files.map((f: any) => ({
          ...f,
          isDir: f.name.endsWith('/.gitkeep') || false,
          displayName: f.name.replace('/.gitkeep', '')
        }));
        setFiles(processedFiles);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsActionsLoading(true);
    setUploadProgress({ name: file.name, progress: 0, speed: '0 KB/s' });

    const xhr = new XMLHttpRequest();
    const startTime = Date.now();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = (event.loaded / 1024 / (elapsed || 0.1)).toFixed(1);
        setUploadProgress({ name: file.name, progress, speed: `${speed} KB/s` });
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        fetchFiles();
      } else {
        alert('上传失败');
      }
      setIsActionsLoading(false);
      setUploadProgress(null);
    };

    xhr.onerror = () => {
      alert('上传发生错误');
      setIsActionsLoading(false);
      setUploadProgress(null);
    };

    const formData = new FormData();
    const targetPath = currentPath.length > 0 ? currentPath.join('/') + '/' : '';
    formData.append('file', file, targetPath + file.name);

    xhr.open('POST', '/api/files');
    xhr.send(formData);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const createNewFolder = async () => {
    const folderName = prompt('请输入文件夹名称:');
    if (!folderName) return;

    setIsActionsLoading(true);
    try {
      const fullPath = [...currentPath, folderName].join('/');
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName: fullPath }),
      });
      if (res.ok) fetchFiles();
    } catch (error) {
      console.error('Create folder error', error);
    } finally {
      setIsActionsLoading(false);
    }
  };

  const handleRename = async (file: FileInfo) => {
    const newName = prompt('请输入新名称:', file.name);
    if (!newName || newName === file.name) return;

    setIsActionsLoading(true);
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(file.name)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPath: newName }),
      });
      if (res.ok) fetchFiles();
    } catch (error) {
      console.error('Rename error', error);
    } finally {
      setIsActionsLoading(false);
    }
  };

  const handleDelete = async (file: FileInfo) => {
    if (!confirm(`确定要删除 ${file.name} 吗？`)) return;

    setIsActionsLoading(true);
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(file.name)}`, {
        method: 'DELETE',
      });
      if (res.ok) fetchFiles();
    } catch (error) {
      console.error('Delete error', error);
    } finally {
      setIsActionsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
      window.location.reload();
    } catch (error) {
      console.error('Logout error:', error);
      window.location.reload();
    }
  };

  const getFilteredFiles = () => {
    let filtered = files.filter(f => !f.name.endsWith('.gitkeep'));
    
    // Category filters
    if (activeTab === 'image') {
      filtered = filtered.filter(f => /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(f.name));
    } else if (activeTab === 'video') {
      filtered = filtered.filter(f => /\.(mp4|mov|avi|webm)$/i.test(f.name));
    } else if (activeTab === 'audio') {
      filtered = filtered.filter(f => /\.(mp3|wav|ogg|flac)$/i.test(f.name));
    } else if (activeTab === 'doc') {
      filtered = filtered.filter(f => /\.(pdf|docx|doc|xlsx|xls|pptx|ppt|txt)$/i.test(f.name));
    } else if (activeTab === 'recent') {
      // For now, just show first 10 files as "recent"
      filtered = filtered.slice(0, 10);
    } else {
      // Filter by current path if in "all" or other non-category tabs
      const pathPrefix = currentPath.length > 0 ? currentPath.join('/') + '/' : '';
      filtered = files.filter(f => {
        const relativeName = f.name.startsWith(pathPrefix) ? f.name.slice(pathPrefix.length) : null;
        if (relativeName === null) return false;
        if (relativeName === '.gitkeep') return false;
        // Only show items in current folder level
        return !relativeName.includes('/');
      }).map(f => {
        // If it's a directory (detected by .gitkeep existence in that path in the full list)
        const isDir = files.some(ff => ff.name === (pathPrefix + f.name.split('/')[0] + '/.gitkeep'));
        return { ...f, isDir };
      });
      
      // Deduplicate directories
      const seen = new Set();
      filtered = filtered.filter(f => {
        const name = f.name.replace(pathPrefix, '').split('/')[0];
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      });
    }

    if (searchQuery) {
      filtered = filtered.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    return filtered;
  };

  const filteredFiles = getFilteredFiles();

  const handleFileClick = (file: FileInfo) => {
    if (file.isDir) {
      const folderName = file.name.split('/').pop() || file.name;
      setCurrentPath([...currentPath, folderName]);
      setActiveTab('all');
    } else {
      setPreviewFile(file);
    }
  };

  return (
    <div className="flex h-screen bg-[#f7f9fc] text-slate-700 overflow-hidden font-sans">
      {/* Dynamic Sidebar */}
      <aside className={`
        ${isMobileMenuOpen ? 'fixed inset-0 z-50 translate-x-0' : 'hidden md:flex -translate-x-full md:translate-x-0'}
        w-64 bg-white border-r border-slate-200 flex-col transition-transform duration-300 ease-in-out
      `}>
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-2xl font-black text-blue-600 tracking-tight flex items-center">
            <Share2 className="mr-2 w-7 h-7" /> GitPan
          </h1>
          <button className="md:hidden p-2 text-slate-400" onClick={() => setIsMobileMenuOpen(false)}>
            <ChevronRight className="rotate-180" />
          </button>
        </div>
        
        <div className="px-4 mb-6 space-y-2">
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isActionsLoading}
            className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl font-bold shadow-lg shadow-blue-100 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Upload className="w-5 h-5" /> 
            <span>开始上传</span>
          </button>
          <button 
            onClick={createNewFolder}
            disabled={isActionsLoading}
            className="w-full flex items-center justify-center space-x-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 py-2.5 rounded-2xl font-bold transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <FolderPlus className="w-5 h-5" /> 
            <span>新建文件夹</span>
          </button>
        </div>

        {uploadProgress && (
          <div className="mx-4 mb-4 p-4 bg-white border border-blue-100 rounded-2xl shadow-sm animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600 truncate mr-2">{uploadProgress.name}</span>
              <span className="text-[10px] font-black text-blue-600">{uploadProgress.progress}%</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-2">
              <div 
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${uploadProgress.progress}%` }}
              ></div>
            </div>
            <div className="flex items-center text-[10px] text-slate-400 font-bold">
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              {uploadProgress.speed}
            </div>
          </div>
        )}

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          <button 
            onClick={() => { setActiveTab('all'); setCurrentPath([]); }}
            className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-2xl transition-all ${activeTab === 'all' && currentPath.length === 0 ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Home className="w-5 h-5 mr-3" /> 我的文件
          </button>

          <div className="pl-6 space-y-1">
            {/* Simple static tree for demo/matching image, in real use we'd generate this */}
            {files.filter(f => f.name.endsWith('/.gitkeep')).map(f => {
              const parts = f.name.replace('/.gitkeep', '').split('/');
              if (parts.length > 1) return null; // Only top level for sidebar
              const name = parts[0];
              return (
                <button 
                  key={name}
                  onClick={() => { setCurrentPath([name]); setActiveTab('all'); }}
                  className="w-full flex items-center px-4 py-2 text-xs font-medium text-slate-500 hover:text-blue-600 rounded-xl hover:bg-slate-50 transition-all"
                >
                  <Folder className="w-4 h-4 mr-2" /> {name}
                </button>
              );
            })}
          </div>

          <div className="my-4 border-t border-slate-100 mx-4"></div>

          <button 
            onClick={() => setActiveTab('recent')}
            className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-2xl transition-all ${activeTab === 'recent' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Clock className="w-5 h-5 mr-3" /> 最近使用
          </button>
          
          <button 
            onClick={() => setActiveTab('image')}
            className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-2xl transition-all ${activeTab === 'image' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <ImageIcon className="w-5 h-5 mr-3" /> 图片
          </button>

          <button 
            onClick={() => setActiveTab('video')}
            className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-2xl transition-all ${activeTab === 'video' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Video className="w-5 h-5 mr-3" /> 视频
          </button>

          <button 
            onClick={() => setActiveTab('audio')}
            className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-2xl transition-all ${activeTab === 'audio' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Music className="w-5 h-5 mr-3" /> 音乐
          </button>

          <button 
            onClick={() => setActiveTab('doc')}
            className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-2xl transition-all ${activeTab === 'doc' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <FileText className="w-5 h-5 mr-3" /> 文档
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={logout}
            className="w-full flex items-center px-4 py-3 text-sm font-semibold text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
          >
            <LogOut className="w-5 h-5 mr-3" /> 退出登录
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Navbar */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 z-10 transition-all">
          <div className="flex items-center flex-1 pr-4">
            <button className="md:hidden mr-4 p-2 text-slate-500 bg-slate-100 rounded-xl" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center bg-slate-100/80 rounded-2xl px-4 py-2.5 w-full max-w-xl group focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all border border-transparent focus-within:border-blue-200">
              <Search className="w-4 h-4 text-slate-400 mr-2 group-focus-within:text-blue-500" />
              <input 
                type="text" 
                placeholder="搜索文件、后缀名..." 
                className="bg-transparent border-none outline-none text-sm w-full text-slate-600 placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            <button 
              onClick={fetchFiles}
              className={`p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-all ${isLoading ? 'bg-slate-50' : ''}`}
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <div className="h-6 w-px bg-slate-200 hidden md:block mx-1"></div>
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center space-x-1">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-500'}`}
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-500'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Content Explorer */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {/* Breadcrumbs */}
          <div className="mb-8 flex items-center text-sm font-semibold tracking-wide overflow-x-auto whitespace-nowrap pb-2">
            <button 
              onClick={() => setCurrentPath([])}
              className={`px-3 py-1.5 rounded-xl transition-all ${currentPath.length === 0 ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
            >
              根目录
            </button>
            {currentPath.map((path, index) => (
              <React.Fragment key={index}>
                <ChevronRight className="w-4 h-4 mx-1 text-slate-300 shrink-0" />
                <button 
                  onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
                  className={`px-3 py-1.5 rounded-xl transition-all ${index === currentPath.length - 1 ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                >
                  {path}
                </button>
              </React.Fragment>
            ))}
            {searchQuery && (
              <>
                <ChevronRight className="w-4 h-4 mx-1 text-slate-300 shrink-0" />
                <span className="text-slate-400 px-3 py-1.5 bg-slate-100 rounded-xl">搜索结果: {searchQuery}</span>
              </>
            )}
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-blue-100 rounded-full animate-ping opacity-20"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
                </div>
              </div>
              <p className="font-bold text-slate-400 tracking-wider">正在与 Git 仓库握手...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Upload className="w-10 h-10 text-slate-200" />
              </div>
              <p className="text-xl font-black text-slate-300 mb-2">空空如也</p>
              <p className="text-slate-400 text-sm mb-8">开始存放您的第一个云端资产</p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95"
              >
                即刻上传
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 md:gap-8">
              {filteredFiles.map((file) => (
                <div 
                  key={file.name} 
                  onClick={() => handleFileClick(file)}
                  className="group bg-white rounded-3xl p-5 border border-white hover:border-blue-100 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 flex flex-col items-center cursor-pointer relative"
                >
                  <div className="mb-4 transform group-hover:scale-110 transition-transform duration-500 group-hover:-translate-y-1">
                    {getFileIcon(file.name, file.isDir)}
                  </div>
                  <span className="text-sm font-bold text-slate-600 text-center truncate w-full px-2" title={file.name}>
                    {file.name.split('/').pop()}
                  </span>
                  
                  <div className="mt-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" onClick={(e) => e.stopPropagation()}>
                    {!file.isDir && (
                      <a 
                        href={`${file.proxyUrl}?download=1`} 
                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        title="下载"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button 
                      onClick={() => handleRename(file)}
                      className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 hover:text-blue-500 transition-all" 
                      title="重命名"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(file)}
                      className="p-1.5 bg-rose-50 text-rose-400 rounded-lg hover:bg-rose-500 hover:text-white transition-all" 
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">文件名</th>
                    <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-[0.2em] hidden sm:table-cell text-center">下载</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredFiles.map((file) => (
                    <tr 
                      key={file.name} 
                      onClick={() => handleFileClick(file)}
                      className="hover:bg-blue-50/30 transition-all group cursor-pointer"
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center">
                          <div className="mr-5 p-2 rounded-2xl bg-slate-50 group-hover:bg-white transition-colors border border-transparent group-hover:border-blue-50">
                            {React.cloneElement(getFileIcon(file.name, file.isDir) as React.ReactElement<any>, { className: 'w-6 h-6' })}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
                              {file.name.split('/').pop()}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                              {file.isDir ? 'FOLDER' : `${file.name.split('.').pop()} FILE`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right sm:text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-2">
                          {!file.isDir && (
                            <a 
                              href={`${file.proxyUrl}?download=1`} 
                              className="p-2 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all"
                            >
                              <Download className="w-5 h-5" />
                            </a>
                          )}
                          <button 
                            onClick={() => handleRename(file)}
                            className="p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-500 rounded-xl transition-all"
                          >
                            <Edit3 className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(file)}
                            className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-5xl h-full max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center">
                <div className="p-2 bg-blue-50 rounded-xl mr-4">
                  {React.cloneElement(getFileIcon(previewFile.name) as React.ReactElement<any>, { className: 'w-6 h-6' })}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-700 truncate max-w-md">{previewFile.name.split('/').pop()}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{previewFile.name.split('.').pop()} FILE</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <a 
                  href={`${previewFile.proxyUrl}?download=1`}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold flex items-center hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  <Download className="w-4 h-4 mr-2" /> 下载
                </a>
                <button 
                  onClick={() => setPreviewFile(null)}
                  className="p-2.5 text-slate-400 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-slate-50/50 p-4 md:p-8 flex items-center justify-center">
              {['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(previewFile.name.split('.').pop()?.toLowerCase() || '') ? (
                <img src={previewFile.proxyUrl} alt={previewFile.name} className="max-w-full max-h-full object-contain rounded-2xl shadow-lg" />
              ) : ['mp4', 'webm', 'mov'].includes(previewFile.name.split('.').pop()?.toLowerCase() || '') ? (
                <video src={previewFile.proxyUrl} controls className="max-w-full max-h-full rounded-2xl shadow-lg" />
              ) : ['mp3', 'wav', 'ogg'].includes(previewFile.name.split('.').pop()?.toLowerCase() || '') ? (
                <div className="bg-white p-12 rounded-[2rem] shadow-xl flex flex-col items-center">
                  <div className="w-24 h-24 bg-purple-50 rounded-full flex items-center justify-center mb-8 animate-pulse">
                    <Music className="w-12 h-12 text-purple-500" />
                  </div>
                  <audio src={previewFile.proxyUrl} controls className="w-80" />
                </div>
              ) : previewFile.name.split('.').pop()?.toLowerCase() === 'pdf' ? (
                <iframe src={previewFile.proxyUrl} className="w-full h-full rounded-xl border border-slate-200 shadow-sm bg-white" />
              ) : (
                <div className="bg-white p-12 rounded-[2rem] shadow-xl border border-slate-100 flex flex-col items-center max-w-md text-center">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8">
                    <Box className="w-12 h-12 text-slate-300" />
                  </div>
                  <h4 className="text-xl font-black text-slate-700 mb-2">无法在线预览</h4>
                  <p className="text-slate-400 font-medium mb-8">此文件格式暂不支持在线预览，请下载到本地查看。</p>
                  <a 
                    href={`${previewFile.proxyUrl}?download=1`}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
                  >
                    立即下载
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Styled File Input */}
      <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
}
