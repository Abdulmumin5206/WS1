import { Canvas, CanvasRenderingContext2D, createCanvas, loadImage } from 'canvas';

export interface ProcessedImage {
  url: string;
  width: number;
  height: number;
  size: number;
}

export interface ImageProcessingOptions {
  maxDimension?: number;
  quality?: number;
  format?: 'jpeg' | 'png';
}

const DEFAULT_OPTIONS: ImageProcessingOptions = {
  maxDimension: 1200,
  quality: 0.8,
  format: 'jpeg'
};

export async function processImage(
  imageData: string | File | Blob,
  options: ImageProcessingOptions = DEFAULT_OPTIONS
): Promise<ProcessedImage> {
  const { maxDimension = 1200, quality = 0.8, format = 'jpeg' } = options;
  
  // Convert File/Blob to data URL if needed
  let imageUrl = typeof imageData === 'string' 
    ? imageData 
    : await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(imageData);
      });

  // Load image
  const img = await loadImage(imageUrl);
  
  // Calculate dimensions
  let width = img.width;
  let height = img.height;
  
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  // Create canvas and context
  const canvas: Canvas = createCanvas(width, height);
  const ctx: CanvasRenderingContext2D = canvas.getContext('2d');

  // Draw white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Draw image with high quality settings
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to desired format
  const processedUrl = format === 'png' 
    ? canvas.toDataURL('image/png')
    : canvas.toDataURL('image/jpeg', quality);

  // Calculate size in bytes (base64 string length * 0.75)
  const base64Length = processedUrl.substring(processedUrl.indexOf(',') + 1).length;
  const size = Math.round(base64Length * 0.75);

  return {
    url: processedUrl,
    width,
    height,
    size
  };
}

export async function optimizeForStorage(imageUrl: string): Promise<string> {
  const result = await processImage(imageUrl, {
    maxDimension: 1200,
    quality: 0.7,
    format: 'jpeg'
  });
  return result.url;
}

export async function optimizeForDisplay(imageUrl: string): Promise<string> {
  const result = await processImage(imageUrl, {
    maxDimension: 2000,
    quality: 0.8,
    format: 'jpeg'
  });
  return result.url;
}

export function calculateImageSize(dataUrl: string): number {
  const base64Length = dataUrl.substring(dataUrl.indexOf(',') + 1).length;
  return Math.round(base64Length * 0.75);
}

export async function rotateImage(
  imageUrl: string,
  degrees: number
): Promise<ProcessedImage> {
  const img = await loadImage(imageUrl);
  
  const isVertical = degrees === 90 || degrees === 270;
  const width = isVertical ? img.height : img.width;
  const height = isVertical ? img.width : img.height;
  
  const canvas: Canvas = createCanvas(width, height);
  const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
  
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  
  ctx.translate(width / 2, height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  
  const processedUrl = canvas.toDataURL('image/jpeg', 0.8);
  
  return {
    url: processedUrl,
    width,
    height,
    size: calculateImageSize(processedUrl)
  };
} 