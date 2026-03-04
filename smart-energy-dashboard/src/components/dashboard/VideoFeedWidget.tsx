import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Video, Upload, AlertCircle } from 'lucide-react';
import { useEnergy } from '../../context/EnergyContext';
import type { ZoneState } from '../../types';

const VideoFeedWidget: React.FC = () => {
    const { fps, setFps, updateDetectionResults, setIsProcessing } = useEnergy();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const zoneCanvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const inferenceActive = useRef(false);
    const objectUrlRef = useRef<string | null>(null);

    // Handle file selection
    const handleFileSelect = useCallback((file: File) => {
        // Revoke previous object URL
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }

        setVideoFile(file);
        setError(null);
        setIsPlaying(false);
        inferenceActive.current = false;

        const video = videoRef.current;
        if (!video) return;

        const url = URL.createObjectURL(file);
        objectUrlRef.current = url;

        // Reset video state
        video.pause();
        video.removeAttribute('src');
        video.load();

        // Set up event handlers before setting src
        const onCanPlay = () => {
            video.removeEventListener('canplay', onCanPlay);
            setIsPlaying(true);
            video.play().catch((e) => {
                console.warn('Autoplay blocked, user interaction needed:', e);
                setIsPlaying(true); // still show controls
            });
        };

        const onError = () => {
            video.removeEventListener('error', onError);
            video.removeEventListener('canplay', onCanPlay);
            const mediaError = video.error;
            console.error('Video error:', mediaError?.code, mediaError?.message);
            setError(`Cannot play this video (error ${mediaError?.code}). Try a different MP4 file or use Safari for MOV files.`);
            setIsPlaying(false);
        };

        video.addEventListener('canplay', onCanPlay, { once: true });
        video.addEventListener('error', onError, { once: true });

        video.muted = true;
        video.playsInline = true;
        video.loop = true;
        video.src = url;
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) {
            handleFileSelect(file);
        }
    }, [handleFileSelect]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelect(file);
    }, [handleFileSelect]);

    // Inference loop — sends frames to backend when video is playing
    useEffect(() => {
        if (!isPlaying || !videoFile) return;

        inferenceActive.current = true;
        setIsProcessing(true);

        const runInference = async () => {
            while (inferenceActive.current) {
                if (!videoRef.current || !canvasRef.current || videoRef.current.paused) {
                    await new Promise(r => setTimeout(r, 100));
                    continue;
                }

                const video = videoRef.current;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (!ctx) break;

                // Sync canvas dimensions
                if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                }

                // Capture frame
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = video.videoWidth;
                tempCanvas.height = video.videoHeight;
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx) break;
                tempCtx.drawImage(video, 0, 0);

                const startTime = performance.now();

                try {
                    const blob = await new Promise<Blob | null>(resolve =>
                        tempCanvas.toBlob(resolve, 'image/jpeg', 0.8)
                    );
                    if (!blob || !inferenceActive.current) break;

                    const formData = new FormData();
                    formData.append('image', blob, 'frame.jpg');

                    const backendUrl = import.meta.env.VITE_AI_ENGINE_URL || 'http://localhost:8000';
                    const response = await fetch(`${backendUrl}/detect`, {
                        method: 'POST',
                        body: formData,
                    });

                    if (response.ok && inferenceActive.current) {
                        const data = await response.json();
                        updateDetectionResults(data);

                        const endTime = performance.now();
                        setFps(Math.round(1000 / (endTime - startTime)));

                        // Draw bounding boxes
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        data.detections.forEach((det: any) => {
                            const [x1, y1, x2, y2] = det.bbox;
                            ctx.strokeStyle = '#3b82f6';
                            ctx.lineWidth = 3;
                            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

                            ctx.fillStyle = '#3b82f6';
                            const text = `${det.class} ${Math.round(det.confidence * 100)}%`;
                            const textWidth = ctx.measureText(text).width;
                            ctx.fillRect(x1, y1 - 20 > 0 ? y1 - 20 : 0, textWidth + 10, 20);
                            ctx.fillStyle = '#ffffff';
                            ctx.font = '12px sans-serif';
                            ctx.fillText(text, x1 + 5, y1 - 5 > 15 ? y1 - 5 : 15);
                        });

                        // Draw zone overlays
                        const zoneStates: ZoneState[] = data.zone_states || [];
                        if (zoneStates.length > 0 && zoneCanvasRef.current) {
                            const zoneCanvas = zoneCanvasRef.current;
                            const zoneCtx = zoneCanvas.getContext('2d');
                            if (zoneCtx) {
                                if (zoneCanvas.width !== video.videoWidth || zoneCanvas.height !== video.videoHeight) {
                                    zoneCanvas.width = video.videoWidth;
                                    zoneCanvas.height = video.videoHeight;
                                }
                                zoneCtx.clearRect(0, 0, zoneCanvas.width, zoneCanvas.height);

                                zoneStates.forEach((zone: ZoneState) => {
                                    const poly = zone.polygon;
                                    if (!poly || poly.length < 3) return;

                                    zoneCtx.beginPath();
                                    const startX = poly[0][0] * zoneCanvas.width;
                                    const startY = poly[0][1] * zoneCanvas.height;
                                    zoneCtx.moveTo(startX, startY);
                                    for (let i = 1; i < poly.length; i++) {
                                        zoneCtx.lineTo(poly[i][0] * zoneCanvas.width, poly[i][1] * zoneCanvas.height);
                                    }
                                    zoneCtx.closePath();

                                    zoneCtx.fillStyle = zone.is_occupied
                                        ? 'rgba(34, 197, 94, 0.15)'
                                        : 'rgba(148, 163, 184, 0.1)';
                                    zoneCtx.fill();

                                    zoneCtx.strokeStyle = zone.is_occupied
                                        ? 'rgba(34, 197, 94, 0.7)'
                                        : 'rgba(148, 163, 184, 0.4)';
                                    zoneCtx.lineWidth = 2;
                                    zoneCtx.stroke();

                                    // Label at centroid
                                    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length * zoneCanvas.width;
                                    const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length * zoneCanvas.height;

                                    const label = zone.zone_name;
                                    zoneCtx.font = 'bold 11px sans-serif';
                                    const metrics = zoneCtx.measureText(label);
                                    const pad = 4;

                                    zoneCtx.fillStyle = zone.is_occupied
                                        ? 'rgba(34, 197, 94, 0.85)'
                                        : 'rgba(100, 116, 139, 0.7)';
                                    zoneCtx.fillRect(
                                        cx - metrics.width / 2 - pad,
                                        cy - 7 - pad,
                                        metrics.width + pad * 2,
                                        14 + pad * 2,
                                    );

                                    zoneCtx.fillStyle = '#ffffff';
                                    zoneCtx.textAlign = 'center';
                                    zoneCtx.textBaseline = 'middle';
                                    zoneCtx.fillText(label, cx, cy);
                                    zoneCtx.textAlign = 'start';
                                    zoneCtx.textBaseline = 'alphabetic';
                                });
                            }
                        }
                    }
                } catch (err) {
                    console.error('Inference error:', err);
                }
            }

            setIsProcessing(false);
        };

        runInference();

        return () => {
            inferenceActive.current = false;
        };
    }, [isPlaying, videoFile, updateDetectionResults, setFps, setIsProcessing]);

    // Cleanup object URL on unmount
    useEffect(() => {
        return () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, []);

    const { peopleCount } = useEnergy();

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Video className="w-4 h-4 text-blue-500" />
                    CCTV Feed
                </h3>
                <div className="flex items-center gap-3">
                    {videoFile && (
                        <label className="text-xs text-blue-600 cursor-pointer hover:text-blue-800 font-medium">
                            Change Video
                            <input
                                type="file"
                                accept="video/*"
                                onChange={handleInputChange}
                                className="hidden"
                            />
                        </label>
                    )}
                    {isPlaying && (
                        <span className={`text-xs font-mono px-2 py-1 rounded flex items-center gap-2 ${fps > 1 ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${fps > 1 ? 'bg-green-500' : 'bg-orange-500'}`} />
                            {fps} FPS
                        </span>
                    )}
                </div>
            </div>

            <div
                className="relative aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center group border border-slate-800"
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
            >
                {/* Video element */}
                <video
                    ref={videoRef}
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Bounding box canvas */}
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />

                {/* Zone overlay canvas */}
                <canvas
                    ref={zoneCanvasRef}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />

                {/* Error */}
                {error && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 text-white p-4 text-center">
                        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {/* Upload prompt (no video loaded) */}
                {!videoFile && !error && (
                    <label className="absolute inset-0 z-10 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors">
                        <Upload className="w-10 h-10 text-slate-400 mb-3" />
                        <p className="text-sm text-slate-400 font-medium">Upload a video file</p>
                        <p className="text-xs text-slate-500 mt-1">.MOV, .MP4, .WebM</p>
                        <p className="text-xs text-slate-600 mt-2">or drag & drop</p>
                        <input
                            type="file"
                            accept="video/*"
                            onChange={handleInputChange}
                            className="hidden"
                        />
                    </label>
                )}

                {/* Processing spinner (video loaded but not playing yet) */}
                {videoFile && !isPlaying && !error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2" />
                        <span className="text-xs">Loading video...</span>
                    </div>
                )}

                {/* Top overlay */}
                {isPlaying && (
                    <div className="absolute top-0 left-0 p-4 z-10 flex flex-col gap-2 pointer-events-none">
                        <div className="flex items-center gap-2">
                            <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse flex items-center gap-1.5 shadow-sm">
                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                PROCESSING
                            </div>
                            <div className="font-mono text-xs text-white/80">
                                {new Date().toLocaleTimeString()}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                            <span className="text-[10px] font-mono text-green-400 tracking-wider">DETECTING</span>
                        </div>
                    </div>
                )}

                {/* Grid overlay */}
                {isPlaying && (
                    <div
                        className="absolute inset-0 opacity-10 pointer-events-none"
                        style={{
                            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                            backgroundSize: '40px 40px',
                        }}
                    />
                )}

                {/* Bottom right stats */}
                {isPlaying && (
                    <div className="absolute bottom-4 right-4 z-10 text-white/70 font-mono text-xs pointer-events-none text-right">
                        <p>DETECTED: {peopleCount}</p>
                        <p className="text-[10px] text-white/50">YOLO Inference</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoFeedWidget;
