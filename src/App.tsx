import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Masonry from 'react-masonry-css';
import { 
  Camera, 
  Info, 
  X, 
  Sun, 
  Moon, 
  Maximize2, 
  Aperture, 
  Clock, 
  Zap, 
  Focus,
  Download,
  Share2
} from 'lucide-react';
import { cn } from './lib/utils';
import { Photo } from './types';

export default function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [loadingExif, setLoadingExif] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPhotoId, setDownloadingPhotoId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const fullscreenContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const response = await fetch('/api/photos');
        if (!response.ok) throw new Error('Failed to fetch photos');
        const data = await response.json();
        setPhotos(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        // Mock data for demo if S3 is not configured
        setPhotos([
          {
            id: '1',
            url: 'https://picsum.photos/seed/photo1/800/1200',
            name: 'Mountain Peak',
            exif: { make: 'Sony', model: 'A7R IV', exposureTime: '1/500s', fNumber: 'f/4', iso: '100', focalLength: '35mm' }
          },
          {
            id: '2',
            url: 'https://picsum.photos/seed/photo2/1200/800',
            name: 'Urban Night',
            exif: { make: 'Canon', model: 'EOS R5', exposureTime: '1/30s', fNumber: 'f/1.8', iso: '1600', focalLength: '50mm' }
          },
          {
            id: '3',
            url: 'https://picsum.photos/seed/photo3/1000/1000',
            name: 'Forest Path',
            exif: { make: 'Nikon', model: 'Z7 II', exposureTime: '1/125s', fNumber: 'f/8', iso: '400', focalLength: '24mm' }
          },
          {
            id: '4',
            url: 'https://picsum.photos/seed/photo4/800/1000',
            name: 'Desert Dunes',
            exif: { make: 'Fujifilm', model: 'X-T4', exposureTime: '1/1000s', fNumber: 'f/11', iso: '200', focalLength: '16mm' }
          },
          {
            id: '5',
            url: 'https://picsum.photos/seed/photo5/1200/900',
            name: 'Ocean Breeze',
            exif: { make: 'Sony', model: 'A7S III', exposureTime: '1/2000s', fNumber: 'f/2.8', iso: '100', focalLength: '85mm' }
          },
          {
            id: '6',
            url: 'https://picsum.photos/seed/photo6/900/1200',
            name: 'Portrait Study',
            exif: { make: 'Leica', model: 'M11', exposureTime: '1/250s', fNumber: 'f/1.4', iso: '200', focalLength: '50mm' }
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchPhotos();
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      fullscreenContainerRef.current?.requestFullscreen?.().catch(err => {
        console.error('全屏模式启动失败:', err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error('退出全屏模式失败:', err);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!selectedPhoto && document.fullscreenElement) {
      document.exitFullscreen().catch(err => {
        console.error('关闭预览时退出全屏失败:', err);
      });
    }
  }, [selectedPhoto]);

  const handlePhotoClick = async (photo: Photo) => {
    setSelectedPhoto(photo);
    
    if (Object.keys(photo.exif).length === 0) {
      setLoadingExif(photo.id);
      try {
        const response = await fetch(`/api/photo/${encodeURIComponent(photo.id)}/exif`);
        if (response.ok) {
          const exifData = await response.json();
          setPhotos(prevPhotos => 
            prevPhotos.map(p => 
              p.id === photo.id ? { ...p, exif: exifData } : p
            )
          );
          setSelectedPhoto({ ...photo, exif: exifData });
        }
      } catch (err) {
        console.error('Failed to load EXIF data:', err);
      } finally {
        setLoadingExif(null);
      }
    }
  };

  const handleShare = async () => {
    if (!selectedPhoto) return;
    
    const shareData = {
      title: selectedPhoto.name,
      text: `查看这张精彩的照片：${selectedPhoto.name}`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('分享失败:', err);
        }
      }
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        alert('链接已复制到剪贴板！');
      }).catch(err => {
        console.error('复制链接失败:', err);
      });
    }
  };

  const handleDownload = async () => {
    if (!selectedPhoto) return;
    
    setDownloadingPhotoId(selectedPhoto.id);
    setDownloadProgress(0);
    
    try {
      const response = await fetch(selectedPhoto.url);
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status} ${response.statusText}`);
      }
      
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      const reader = response.body?.getReader();
      
      if (!reader) {
        throw new Error('无法读取图片数据');
      }
      
      const chunks: Uint8Array[] = [];
      let receivedLength = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        if (total > 0) {
          setDownloadProgress(Math.round((receivedLength / total) * 100));
        }
      }
      
      const blob = new Blob(chunks as BlobPart[]);
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      
      const fileExtension = selectedPhoto.url.split('.').pop()?.split('?')[0] || 'jpg';
      const sanitizedFileName = selectedPhoto.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s-_]/g, '').trim();
      link.download = `${sanitizedFileName}.${fileExtension}`;
      
      document.body.appendChild(link);
      link.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      
      setDownloadProgress(100);
      setTimeout(() => {
        setDownloadingPhotoId(null);
        setDownloadProgress(0);
      }, 1000);
      
    } catch (error) {
      console.error('下载失败:', error);
      alert(`下载失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setDownloadingPhotoId(null);
      setDownloadProgress(0);
    }
  };

  const breakpointColumns = {
    default: 4,
    1100: 3,
    700: 2,
    500: 1
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300",
      isDarkMode ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"
    )}>
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-transparent bg-white/80 dark:bg-zinc-950/40 backdrop-blur-md dark:backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-zinc-900 dark:bg-zinc-800/50 dark:backdrop-blur-md flex items-center justify-center border border-zinc-800 dark:border-zinc-700/50">
              <Camera className="w-6 h-6 text-white dark:text-zinc-200" />
            </div>
            <h1 className="text-xl font-bold tracking-tight dark:text-zinc-100/90">Photo Collection</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleDarkMode}
              className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800/50 dark:backdrop-blur-md transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-zinc-200" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-12 h-12 border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100 rounded-full animate-spin" />
            <p className="text-zinc-500 font-medium">正在加载作品集...</p>
          </div>
        ) : error && photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <Info className="w-12 h-12 text-zinc-400 mb-4" />
            <h2 className="text-xl font-semibold mb-2">未找到照片</h2>
            <p className="text-zinc-500 max-w-md">
              请检查 .env 文件中的 S3 配置或上传一些照片到您的存储桶。
            </p>
          </div>
        ) : (
          <Masonry
            breakpointCols={breakpointColumns}
            className="flex -ml-4 w-auto"
            columnClassName="pl-4 bg-clip-padding"
          >
            {photos.map((photo) => (
              <motion.div
                key={photo.id}
                layoutId={`photo-${photo.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 group relative overflow-hidden rounded-xl cursor-zoom-in shadow-sm hover:shadow-xl transition-shadow duration-300"
                onClick={() => handlePhotoClick(photo)}
              >
                <img
                  src={photo.url}
                  alt={photo.name}
                  className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-white/80 text-xs px-2 py-0.5 bg-white/20 rounded-full backdrop-blur-sm">
                      {photo.exif.model || '查看详情'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </Masonry>
        )}
      </main>

      {/* Photo Detail Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-zinc-950/95 backdrop-blur-xl"
          >
            <button 
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="w-full max-w-7xl h-full flex flex-col lg:flex-row gap-8 overflow-hidden">
              {/* Image Container */}
              <div
                ref={fullscreenContainerRef}
                className="flex-1 relative flex items-center justify-center overflow-hidden bg-zinc-900 rounded-2xl"
              >
                <motion.img
                  layoutId={`photo-${selectedPhoto.id}`}
                  src={selectedPhoto.url}
                  alt={selectedPhoto.name}
                  className="max-w-full max-h-full object-contain"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <button 
                    onClick={handleFullscreen}
                    className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                    title={isFullscreen ? '退出全屏' : '全屏查看'}
                  >
                    <Maximize2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Sidebar Info */}
              <motion.div 
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="w-full lg:w-80 flex flex-col gap-6 text-white"
              >
                <div>
                  <p className="text-zinc-400 text-sm">拍摄于 {selectedPhoto.exif.dateTime || '未知日期'}</p>
                </div>

                {loadingExif === selectedPhoto.id ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-4 border-zinc-600 border-t-white rounded-full animate-spin" />
                  </div>
                ) : Object.keys(selectedPhoto.exif).length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2">
                      <Camera className="w-5 h-5 text-zinc-400" />
                      <span className="text-xs text-zinc-500 uppercase font-semibold">Camera</span>
                      <span className="text-sm font-medium">{selectedPhoto.exif.make} {selectedPhoto.exif.model}</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2">
                      <Focus className="w-5 h-5 text-zinc-400" />
                      <span className="text-xs text-zinc-500 uppercase font-semibold">Lens</span>
                      <span className="text-sm font-medium">{selectedPhoto.exif.focalLength}</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2">
                      <Aperture className="w-5 h-5 text-zinc-400" />
                      <span className="text-xs text-zinc-500 uppercase font-semibold">Aperture</span>
                      <span className="text-sm font-medium">{selectedPhoto.exif.fNumber}</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2">
                      <Clock className="w-5 h-5 text-zinc-400" />
                      <span className="text-xs text-zinc-500 uppercase font-semibold">Shutter</span>
                      <span className="text-sm font-medium">{selectedPhoto.exif.exposureTime}</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2">
                      <Zap className="w-5 h-5 text-zinc-400" />
                      <span className="text-xs text-zinc-500 uppercase font-semibold">ISO</span>
                      <span className="text-sm font-medium">{selectedPhoto.exif.iso}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-400">
                    <Info className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">无EXIF数据</p>
                  </div>
                )}

                <div className="mt-auto flex gap-3">
                  <button 
                    onClick={handleDownload}
                    disabled={downloadingPhotoId === selectedPhoto.id}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors",
                      downloadingPhotoId === selectedPhoto.id
                        ? "bg-zinc-600 text-zinc-300 cursor-not-allowed"
                        : "bg-white text-zinc-900 hover:bg-zinc-200"
                    )}
                    title="下载图片"
                  >
                    {downloadingPhotoId === selectedPhoto.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin" />
                        {downloadProgress > 0 ? `${downloadProgress}%` : '下载中...'}
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" /> 下载
                      </>
                    )}
                  </button>
                  <button 
                    onClick={handleShare}
                    className="p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                    title="分享图片"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-12 border-t border-zinc-200 dark:border-zinc-800 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-zinc-500 text-sm">© 2026 Photo Collection. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-4">
            <a href="https://github.com/muzihuaner/photo-collection" className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">Github</a>
          </div>
        </div>
      </footer>
    </div>
  );
}