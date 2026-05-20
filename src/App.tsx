import React, { useState, useRef, useMemo } from "react";
import { 
  Upload, 
  FileAudio, 
  FileVideo, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  RefreshCcw,
  Copy,
  X,
  Play,
  FileText,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast, Toaster } from "sonner";
import { transcribeToSRT } from "@/src/lib/gemini";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FileItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'done' | 'error';
  result?: string;
  error?: string;
}

export default function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFile = useMemo(() => 
    files.find(f => f.id === selectedFileId), 
  [files, selectedFileId]);

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    
    const validFiles: FileItem[] = [];
    Array.from(newFiles).forEach(file => {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`File "${file.name}" quá lớn (> 20MB).`);
        return;
      }
      validFiles.push({
        id: crypto.randomUUID(),
        file,
        status: 'pending'
      });
    });

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      if (!selectedFileId) {
        setSelectedFileId(validFiles[0].id);
      }
      toast.success(`Đã thêm ${validFiles.length} file.`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFiles(prev => prev.filter(f => f.id !== id));
    if (selectedFileId === id) {
      setSelectedFileId(null);
    }
  };

  const processFile = async (id: string) => {
    const fileItem = files.find(f => f.id === id);
    if (!fileItem || fileItem.status === 'processing') return;

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'processing' } : f));

    try {
      const result = await transcribeToSRT(fileItem.file);
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'done', result } : f));
      return true;
    } catch (error) {
      console.error(error);
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: 'Lỗi xử lý' } : f));
      return false;
    }
  };

  const processAll = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');
    if (pendingFiles.length === 0) return;

    setIsProcessingAll(true);
    for (const f of pendingFiles) {
      await processFile(f.id);
    }
    setIsProcessingAll(false);
    toast.success("Đã hoàn thành xử lý danh sách file.");
  };

  const downloadSRT = (fileItem: FileItem) => {
    if (!fileItem.result) return;
    const blob = new Blob([fileItem.result], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileItem.file.name.split(".")[0]}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    const doneFiles = files.filter(f => f.status === 'done' && f.result);
    if (doneFiles.length === 0) return;
    
    doneFiles.forEach((f, index) => {
      setTimeout(() => downloadSRT(f), index * 300);
    });
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Đã sao chép vào bộ nhớ tạm!");
  };

  const clearAll = () => {
    setFiles([]);
    setSelectedFileId(null);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-primary/20">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <header className="border-b border-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
              <RefreshCcw className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">ScribeSRT</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded border border-border">
              v1.1.0-multi
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: File List & Upload */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border border-border bg-white shadow-sm overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Danh sách file</CardTitle>
                    <CardDescription>Tải lên và quản lý các file cần xử lý</CardDescription>
                  </div>
                  {files.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearAll} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Xóa hết
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload Area */}
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 rounded-xl bg-muted/30 transition-all cursor-pointer"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="audio/*,video/*"
                    multiple
                  />
                  <Upload className="w-8 h-8 text-muted-foreground mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-medium">Thêm file mới</p>
                  <p className="text-xs text-muted-foreground mt-1">Hỗ trợ chọn nhiều file cùng lúc</p>
                </div>

                {/* File List */}
                <ScrollArea className="h-[400px] pr-4 -mr-4">
                  <div className="space-y-2">
                    <AnimatePresence initial={false}>
                      {files.map((fileItem) => (
                        <motion.div
                          key={fileItem.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          onClick={() => setSelectedFileId(fileItem.id)}
                          className={cn(
                            "group flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer relative",
                            selectedFileId === fileItem.id 
                              ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20" 
                              : "bg-white border-border hover:border-primary/30"
                          )}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                            fileItem.file.type.startsWith('audio') ? "bg-blue-50 text-blue-500" : "bg-purple-50 text-purple-500"
                          )}>
                            {fileItem.file.type.startsWith('audio') ? <FileAudio className="w-5 h-5" /> : <FileVideo className="w-5 h-5" />}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate pr-6">{fileItem.file.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-muted-foreground">
                                {(fileItem.file.size / (1024 * 1024)).toFixed(1)} MB
                              </span>
                              {fileItem.status === 'pending' && <Badge variant="secondary" className="text-[9px] px-1.5 h-4">Chờ</Badge>}
                              {fileItem.status === 'processing' && (
                                <Badge variant="outline" className="text-[9px] px-1.5 h-4 border-primary text-primary animate-pulse">
                                  <Loader2 className="w-2 h-2 mr-1 animate-spin" />
                                  Đang xử lý
                                </Badge>
                              )}
                              {fileItem.status === 'done' && <Badge className="text-[9px] px-1.5 h-4 bg-green-500 hover:bg-green-600">Xong</Badge>}
                              {fileItem.status === 'error' && <Badge variant="destructive" className="text-[9px] px-1.5 h-4">Lỗi</Badge>}
                            </div>
                          </div>

                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => removeFile(fileItem.id, e)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    
                    {files.length === 0 && (
                      <div className="py-12 text-center text-muted-foreground/40">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-10" />
                        <p className="text-sm">Chưa có file nào được thêm</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Batch Controls */}
                <div className="pt-4 space-y-3">
                  <Button 
                    className="w-full h-11 font-semibold shadow-sm" 
                    disabled={files.length === 0 || isProcessingAll || !files.some(f => f.status === 'pending' || f.status === 'error')}
                    onClick={processAll}
                  >
                    {isProcessingAll ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang xử lý hàng loạt...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4 fill-current" />
                        Xử lý tất cả
                      </>
                    )}
                  </Button>
                  
                  {files.some(f => f.status === 'done') && (
                    <Button 
                      variant="outline" 
                      className="w-full h-11 border-primary/20 hover:bg-primary/5 hover:text-primary" 
                      onClick={downloadAll}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Tải về tất cả (.srt)
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Preview & Result */}
          <div className="lg:col-span-7">
            <Card className="h-full flex flex-col bg-white shadow-sm border border-border overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-muted/5">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Xem trước kết quả</CardTitle>
                    <CardDescription>
                      {selectedFile ? `Đang xem: ${selectedFile.file.name}` : "Chọn một file để xem kết quả"}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {selectedFile?.result && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(selectedFile.result!)} title="Sao chép">
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => downloadSRT(selectedFile)} className="gap-2">
                          <Download className="w-4 h-4" />
                          Tải về .srt
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 relative min-h-[500px]">
                <AnimatePresence mode="wait">
                  {!selectedFile && (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30 p-12 text-center"
                    >
                      <FileText className="w-16 h-16 mb-4 opacity-10" />
                      <p className="text-sm max-w-[200px]">Chọn một file từ danh sách bên trái để xem nội dung phụ đề</p>
                    </motion.div>
                  )}

                  {selectedFile && selectedFile.status === 'processing' && (
                    <motion.div 
                      key="processing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10"
                    >
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                          <Loader2 className="w-12 h-12 text-primary animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-lg">Đang xử lý file...</p>
                          <p className="text-sm text-muted-foreground">AI đang phân tích âm thanh và tạo phụ đề</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {selectedFile && selectedFile.status === 'error' && (
                    <motion.div 
                      key="error"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center text-destructive p-12 text-center"
                    >
                      <AlertCircle className="w-16 h-16 mb-4 opacity-20" />
                      <p className="font-semibold">Có lỗi xảy ra</p>
                      <p className="text-sm opacity-70 mt-1">{selectedFile.error || "Không thể tạo phụ đề cho file này"}</p>
                      <Button variant="outline" size="sm" className="mt-4" onClick={() => processFile(selectedFile.id)}>
                        Thử lại
                      </Button>
                    </motion.div>
                  )}

                  {selectedFile && selectedFile.status === 'done' && selectedFile.result && (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="h-full flex flex-col"
                    >
                      <ScrollArea className="flex-1 p-6 bg-[#1E1E1E]">
                        <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap leading-relaxed selection:bg-white/10">
                          {selectedFile.result}
                        </pre>
                      </ScrollArea>
                      <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Đã hoàn thành
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                          SRT Format • UTF-8
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {selectedFile && selectedFile.status === 'pending' && (
                    <motion.div 
                      key="pending"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/50 p-12 text-center"
                    >
                      <Play className="w-16 h-16 mb-4 opacity-10" />
                      <p className="text-sm">File đang chờ xử lý. Nhấn "Xử lý tất cả" hoặc nút bắt đầu.</p>
                      <Button variant="outline" size="sm" className="mt-4" onClick={() => processFile(selectedFile.id)}>
                        Xử lý file này
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>

        </div>
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-12 border-t border-border mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <RefreshCcw className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium">ScribeSRT</p>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2026 ScribeSRT. Powered by Google Gemini AI.
          </p>
          <div className="flex gap-6 text-xs text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">Chính sách bảo mật</a>
            <a href="#" className="hover:text-primary transition-colors">Điều khoản dịch vụ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
