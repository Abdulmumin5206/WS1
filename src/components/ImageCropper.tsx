import React, { useState, useRef, useEffect } from 'react';
import { Crop, Move, ZoomIn, ZoomOut, RotateCw, Check, X } from 'lucide-react';

interface ImageCropperProps {
  imageUrl: string;
  aspectRatio?: number;
  onCropComplete: (croppedImageUrl: string) => void;
  onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({
  imageUrl,
  aspectRatio: initialAspectRatio = 4/3,
  onCropComplete,
  onCancel
}) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Initialize image dimensions on load
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
      setPosition({ x: 0, y: 0 });
      setScale(1);
      setRotation(0);
    };
    img.src = imageUrl;
  }, [imageUrl]);
  
  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };
  
  // Handle mouse move for dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setPosition({ x: newX, y: newY });
  };
  
  // Handle mouse up to stop dragging
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Zoom in
  const zoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.1, 3));
  };
  
  // Zoom out
  const zoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.1, 0.5));
  };
  
  // Rotate image
  const rotateImage = () => {
    setRotation(prevRotation => (prevRotation + 90) % 360);
  };

  // Change aspect ratio
  const changeAspectRatio = (newRatio: number) => {
    setAspectRatio(newRatio);
    // Reset position and scale when changing ratio
    setPosition({ x: 0, y: 0 });
    setScale(1);
  };
  
  // Complete cropping
  const completeCrop = () => {
    if (!containerRef.current || !imageRef.current) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;
    
    // Fill with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Center the canvas
    ctx.translate(canvas.width / 2, canvas.height / 2);
    
    // Apply rotation
    ctx.rotate((rotation * Math.PI) / 180);
    
    // Apply scaling
    ctx.scale(scale, scale);
    
    // Draw the image centered and with position offset
    const img = imageRef.current;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    
    ctx.drawImage(
      img,
      -imgWidth / 2 + position.x / scale,
      -imgHeight / 2 + position.y / scale,
      imgWidth,
      imgHeight
    );
    
    const croppedImageUrl = canvas.toDataURL('image/jpeg', 0.9);
    onCropComplete(croppedImageUrl);
  };
  
  // Calculate container height based on aspect ratio
  const containerStyle = {
    width: '100%',
    height: aspectRatio ? `${(1 / aspectRatio) * 400}px` : '400px'
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-90">
      <div className="bg-white rounded-lg overflow-hidden shadow-xl max-w-4xl w-full p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Crop Image</h3>
          <button 
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Aspect Ratio Selection */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => changeAspectRatio(1)}
            className={`px-4 py-2 rounded ${
              aspectRatio === 1 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Square (1:1)
          </button>
          <button
            onClick={() => changeAspectRatio(4/3)}
            className={`px-4 py-2 rounded ${
              aspectRatio === 4/3 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Standard (4:3)
          </button>
          <button
            onClick={() => changeAspectRatio(16/9)}
            className={`px-4 py-2 rounded ${
              aspectRatio === 16/9 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Widescreen (16:9)
          </button>
        </div>
        
        <div className="flex flex-col items-center">
          {/* Crop container with aspect ratio */}
          <div 
            ref={containerRef}
            className="relative overflow-hidden bg-gray-50 border border-gray-300 mb-4"
            style={containerStyle}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* The image to crop */}
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Image to crop"
              className="absolute"
              style={{
                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                transformOrigin: 'center',
                left: '50%',
                top: '50%',
                maxWidth: 'none',
                maxHeight: 'none'
              }}
              draggable={false}
            />
            
            {/* Grid overlay */}
            <div className="absolute inset-0">
              <div className="w-full h-full border-2 border-white border-opacity-50 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-white border-opacity-20"></div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex items-center justify-center space-x-4 mb-4">
            <button 
              onClick={zoomOut}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700"
              title="Zoom out"
            >
              <ZoomOut size={20} />
            </button>
            
            <button 
              onClick={zoomIn}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700"
              title="Zoom in"
            >
              <ZoomIn size={20} />
            </button>
            
            <button 
              onClick={rotateImage}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700"
              title="Rotate"
            >
              <RotateCw size={20} />
            </button>
          </div>
          
          <div className="flex items-center justify-end space-x-2 w-full">
            <button 
              onClick={onCancel}
              className="py-2 px-4 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            
            <button 
              onClick={completeCrop}
              className="py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper; 