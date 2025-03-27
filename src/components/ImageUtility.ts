// Image Utility functions for processing and aligning images

/**
 * Auto-crop image to fit the specified aspect ratio
 * @param imageUrl - URL of the image to process
 * @param targetAspectRatio - Desired aspect ratio (width/height)
 * @returns Promise that resolves to the processed image URL
 */
export const autoFitImage = async (
  imageUrl: string, 
  targetAspectRatio: number = 4/3
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      // Calculate dimensions for cropping
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;
      const imgAspectRatio = imgWidth / imgHeight;
      
      let cropWidth = imgWidth;
      let cropHeight = imgHeight;
      let offsetX = 0;
      let offsetY = 0;
      
      // Determine the best cropping approach based on image dimensions and target ratio
      if (Math.abs(imgAspectRatio - targetAspectRatio) < 0.1) {
        // If the image is already close to the target ratio, just resize it
        cropWidth = imgWidth;
        cropHeight = imgHeight;
      } else if (targetAspectRatio === 1) {
        // Special handling for square aspect ratio (three-image layout)
        // For square aspect ratio, we want to ensure we get the most interesting part of the image
        const minDimension = Math.min(imgWidth, imgHeight);
        cropWidth = cropHeight = minDimension;
        
        // Center the crop by default
        offsetX = imgWidth > minDimension ? (imgWidth - minDimension) / 2 : 0;
        offsetY = imgHeight > minDimension ? (imgHeight - minDimension) / 2 : 0;
        
        // If it's likely a portrait/face image, adjust the vertical position
        if (imgHeight > imgWidth * 1.2) { // Tall image
          offsetY = Math.min(imgHeight - minDimension, imgHeight * 0.2); // Favor the top portion
        }
      } else if (imgAspectRatio > targetAspectRatio) {
        // Image is wider than target - crop width
        cropWidth = imgHeight * targetAspectRatio;
        
        // Center the crop horizontally
        offsetX = (imgWidth - cropWidth) / 2;
        
        // Detect if this appears to be a centered subject
        // If the image has a lot of empty space on sides, we might want to use intelligent cropping
        const leftEdge = detectEdgeContent(img, 'left');
        const rightEdge = detectEdgeContent(img, 'right');
        
        if (Math.abs(leftEdge - rightEdge) > 0.2) {
          // Adjust the crop window to focus on the non-empty part
          const centerOfContent = (leftEdge + rightEdge) / 2;
          const cropHalfWidth = cropWidth / 2;
          const newCenterX = imgWidth * centerOfContent;
          
          offsetX = Math.max(0, Math.min(imgWidth - cropWidth, newCenterX - cropHalfWidth));
        }
      } else if (imgAspectRatio < targetAspectRatio) {
        // Image is taller than target - crop height
        cropHeight = imgWidth / targetAspectRatio;
        
        // Center the crop vertically, but bias slightly toward the top for portrait photos
        const isFaceOrPortrait = detectFaceOrPortrait(img);
        if (isFaceOrPortrait && cropHeight < imgHeight * 0.8) {
          // If it's likely a portrait, place the crop window higher
          offsetY = (imgHeight - cropHeight) * 0.3; // Bias toward top (0.3 instead of 0.5)
        } else {
          // Otherwise center it
          offsetY = (imgHeight - cropHeight) / 2;
        }
      }
      
      // Set canvas dimensions to match target aspect ratio
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      
      // Draw cropped portion centered
      ctx.drawImage(
        img,
        offsetX, offsetY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );
      
      // Convert to high-quality JPEG
      const outputUrl = canvas.toDataURL('image/jpeg', 0.92);
      resolve(outputUrl);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageUrl;
  });
};

/**
 * Detect where content starts from edges (simplistic edge detection)
 * @param img - Image element
 * @param edge - Which edge to detect from ('left', 'right', 'top', 'bottom')
 * @returns Normalized position (0-1) where significant content is detected
 */
function detectEdgeContent(img: HTMLImageElement, edge: 'left' | 'right' | 'top' | 'bottom'): number {
  // This is a simplified implementation
  // In a production app, this would use more sophisticated image analysis
  
  // As a simple fallback, return centered position
  // A more advanced implementation would use canvas to analyze pixels
  return edge === 'left' || edge === 'top' ? 0.3 : 0.7;
}

/**
 * Detect if an image likely contains a face or portrait
 * @param img - Image element
 * @returns True if the image likely contains a portrait
 */
function detectFaceOrPortrait(img: HTMLImageElement): boolean {
  // A simplistic heuristic: if the image is tall and narrow, it's likely a portrait
  const ratio = img.naturalWidth / img.naturalHeight;
  return ratio < 0.8;
}

/**
 * Resize image to fit within maximum dimensions while preserving aspect ratio
 * @param imageUrl - URL of the image to resize
 * @param maxWidth - Maximum width
 * @param maxHeight - Maximum height
 * @returns Promise that resolves to the resized image URL
 */
export const resizeImage = async (
  imageUrl: string,
  maxWidth: number = 1200,
  maxHeight: number = 800
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      // Calculate dimensions for resizing
      let width = img.naturalWidth;
      let height = img.naturalHeight;
      
      // Maintain aspect ratio while fitting within max dimensions
      if (width > maxWidth) {
        const ratio = maxWidth / width;
        width = maxWidth;
        height = height * ratio;
      }
      
      if (height > maxHeight) {
        const ratio = maxHeight / height;
        height = maxHeight;
        width = width * ratio;
      }
      
      // Set canvas dimensions to resized dimensions
      canvas.width = width;
      canvas.height = height;
      
      // Draw resized image
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to high-quality JPEG
      const outputUrl = canvas.toDataURL('image/jpeg', 0.92);
      resolve(outputUrl);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageUrl;
  });
};

/**
 * Convert and process image for consistent quality and format
 * @param imageUrl - URL of the image to process
 * @param quality - JPEG quality (0-1)
 * @returns Promise that resolves to the processed image URL
 */
export const normalizeImage = async (
  imageUrl: string,
  quality: number = 0.92
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      // Keep original dimensions
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      
      // First fill with white background (for transparent PNGs)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Apply very subtle image enhancements
      // Slightly increase contrast and saturation
      ctx.filter = 'contrast(1.05) saturate(1.05)';
      
      // Draw the image on top
      ctx.drawImage(img, 0, 0);
      
      // Reset filter
      ctx.filter = 'none';
      
      // Convert to JPEG with consistent quality
      const outputUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(outputUrl);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageUrl;
  });
};

/**
 * Determine if an image needs processing based on its dimensions
 * @param imageUrl - URL of the image to check
 * @param targetWidth - Target width for reference
 * @param targetHeight - Target height for reference
 * @returns Promise that resolves to a boolean indicating if processing is needed
 */
export const shouldProcessImage = async (
  imageUrl: string,
  targetWidth: number = 1200,
  targetHeight: number = 800
): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      
      // Check if image is too large
      const isTooLarge = width > targetWidth * 1.5 || height > targetHeight * 1.5;
      
      // Check if aspect ratio is very different from standard (4:3 or 16:9)
      const aspectRatio = width / height;
      const isAspectRatioUnusual = 
        (aspectRatio < 1 || aspectRatio > 2.5) &&
        (Math.abs(aspectRatio - 4/3) > 0.25 && Math.abs(aspectRatio - 16/9) > 0.25);
      
      resolve(isTooLarge || isAspectRatioUnusual);
    };
    
    img.onerror = () => {
      resolve(false);
    };
    
    img.src = imageUrl;
  });
}; 