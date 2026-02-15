import React, { useEffect, useRef, useState } from 'react';
import { Camera, Maximize2, AlertCircle } from 'lucide-react';
import { useEnergy } from '../../context/EnergyContext';

interface LiveFeedWidgetProps {
    roomId?: string; // Add roomId prop
    roomName?: string;
    occupancy?: number;
}

const LiveFeedWidget: React.FC<LiveFeedWidgetProps> = ({ roomId: propRoomId, roomName = "Main Camera", occupancy }) => {
    const { fps, setPeopleCount, setFps } = useEnergy();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);

    // Camera Access
    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'user',
                        width: { ideal: 640 },
                        height: { ideal: 360 }
                    }
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        setIsStreaming(true);
                        videoRef.current?.play();
                    };
                }
            } catch (err) {
                console.error("Camera Error:", err);
                setError("Camera access denied. Please allow permissions.");
            }
        };

        startCamera();

        return () => {
            // Cleanup stream
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Inference Loop
    useEffect(() => {
        if (!isStreaming) return;

        const intervalId = setInterval(async () => {
            if (!videoRef.current || !canvasRef.current) return;

            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            if (!ctx) return;

            // Set canvas dimensions to match video
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }

            // Draw current frame to hidden context/canvas for blob generation
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = video.videoWidth;
            tempCanvas.height = video.videoHeight;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) return;

            tempCtx.drawImage(video, 0, 0);

            // Get Blob and Send via API
            tempCanvas.toBlob(async (blob) => {
                if (!blob) return;

                const formData = new FormData();
                formData.append('image', blob, 'frame.jpg');

                const startTime = performance.now();

                try {
                    const backendUrl = import.meta.env.VITE_AI_ENGINE_URL || 'http://localhost:8000';
                    // Use propRoomId if available, else derive or fallback
                    const roomId = propRoomId || roomName.replace('Room ', '') || '1';

                    const response = await fetch(`${backendUrl}/detect/${roomId}`, {
                        method: 'POST',
                        body: formData
                    });

                    if (response.ok) {
                        const data = await response.json();

                        // Update Context
                        setPeopleCount(data.people_count);
                        const endTime = performance.now();
                        const newFps = Math.round(1000 / (endTime - startTime));
                        setFps(newFps); // Approximate Network FPS

                        // Draw Bounding Boxes
                        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear previous drawings

                        data.detections.forEach((det: any) => {
                            const [x1, y1, x2, y2] = det.bbox;
                            const width = x2 - x1;
                            const height = y2 - y1;

                            // Draw Box
                            ctx.strokeStyle = '#3b82f6'; // Blue-500
                            ctx.lineWidth = 3;
                            ctx.strokeRect(x1, y1, width, height);

                            // Draw Label Background
                            ctx.fillStyle = '#3b82f6';
                            const text = `${det.class} ${Math.round(det.confidence * 100)}%`;
                            const textWidth = ctx.measureText(text).width;
                            ctx.fillRect(x1, y1 - 20 > 0 ? y1 - 20 : 0, textWidth + 10, 20);

                            // Draw Text
                            ctx.fillStyle = '#ffffff';
                            ctx.font = '12px sans-serif';
                            ctx.fillText(text, x1 + 5, y1 - 5 > 15 ? y1 - 5 : 15);
                        });
                    }
                } catch (err) {
                    console.error("Inference Error:", err);
                }
            }, 'image/jpeg', 0.8); // 0.8 Quality

        }, 250); // ~4 FPS for smoother detection

        return () => clearInterval(intervalId);
    }, [isStreaming, setPeopleCount, setFps, propRoomId, roomName]);

    // Fallback display logic
    const { peopleCount: globalCount } = useEnergy();
    const displayCount = occupancy !== undefined ? occupancy : globalCount;

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-blue-500" />
                    {roomName}
                </h3>
                <span className={`text-xs font-mono px-2 py-1 rounded flex items-center gap-2 ${fps > 5 ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50'
                    }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${fps > 5 ? 'bg-green-500' : 'bg-orange-500'
                        }`} />
                    FPS: {fps}
                </span>
            </div>

            <div className="relative aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center group border border-slate-800">

                {/* 1. Video Element (Source) */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                />

                {/* 2. Canvas Overlay (Bounding Boxes) */}
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />

                {/* Error Message */}
                {error && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 text-white p-4 text-center">
                        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                        <p>{error}</p>
                    </div>
                )}

                {/* Loading State */}
                {!isStreaming && !error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                        <span className="text-xs">Accessing Camera...</span>
                    </div>
                )}

                {/* Top Overlay */}
                <div className="absolute top-0 left-0 p-4 z-10 flex flex-col gap-2 pointer-events-none">
                    <div className="flex items-center gap-2">
                        <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse flex items-center gap-1.5 shadow-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            REC
                        </div>
                        <div className="font-mono text-xs text-white/80">
                            {new Date().toLocaleTimeString()}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : 'bg-green-500'} shadow-[0_0_8px_rgba(34,197,94,0.8)]`} />
                        <span className="text-[10px] font-mono text-green-400 tracking-wider">{error ? 'OFFLINE' : 'ONLINE'}</span>
                    </div>
                </div>

                {/* Grid Overlay */}
                <div className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{
                        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                        backgroundSize: '40px 40px'
                    }}
                />

                <div className="absolute bottom-4 right-4 z-10 text-white/70 font-mono text-xs pointer-events-none text-right">
                    <p>DETECTED: {displayCount}</p>
                    <p className="text-[10px] text-white/50">Cloud Inference</p>
                </div>

                <button className="absolute bottom-4 right-4 p-2 bg-white/10 backdrop-blur-md text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20 pointer-events-auto">
                    <Maximize2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default LiveFeedWidget;
