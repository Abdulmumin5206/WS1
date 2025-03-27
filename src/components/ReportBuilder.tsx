"use client";

import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { FileText, Image, Download, Plus, Trash2, ArrowUp, ArrowDown, Crop, Edit, Moon, Sun } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ImageCropper from './ImageCropper';
import { autoFitImage, resizeImage, normalizeImage, shouldProcessImage } from './ImageUtility';
import RichTextEditor from './RichTextEditor';
import { useTheme } from '@/contexts/ThemeContext';

interface ImageItem {
  id: string;
  file: File;
  url: string;
  caption: string;
  needsProcessing?: boolean;
}

interface Section {
  id: number;
  title: string;
  content: string;
  images: ImageItem[];
  imageLayout: {
    imagesPerRow: 1 | 2 | 3;
  };
}

const ReportBuilder: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [reportTitle, setReportTitle] = useState<string>('Weekly Report');
  const [reportStartDate, setReportStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reportEndDate, setReportEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [sections, setSections] = useState<Section[]>([
    { id: 1, title: 'Summary', content: '', images: [], imageLayout: { imagesPerRow: 2 } }
  ]);
  const [activeCropImage, setActiveCropImage] = useState<{ sectionId: number, imageId: string, url: string } | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  
  // Add a helper to get formatted date text for display
  const getDateRangeText = () => {
    if (reportStartDate === reportEndDate) {
      return reportStartDate;
    }
    return `${reportStartDate} to ${reportEndDate}`;
  };
  
  // Handle text changes in sections
  const handleContentChange = (id: number, content: string) => {
    setSections(sections.map((section: Section) => 
      section.id === id ? { ...section, content } : section
    ));
  };
  
  // Handle section title changes
  const handleTitleChange = (id: number, title: string) => {
    setSections(sections.map((section: Section) => 
      section.id === id ? { ...section, title } : section
    ));
  };
  
  // Add a new section
  const addSection = () => {
    const newId = Math.max(0, ...sections.map((s: Section) => s.id)) + 1;
    setSections([...sections, { 
      id: newId, 
      title: 'New Section', 
      content: '<p></p>', // Initialize with empty paragraph for rich text
      images: [],
      imageLayout: { imagesPerRow: 2 }
    }]);
  };
  
  // Remove a section
  const removeSection = (id: number) => {
    setSections(sections.filter((section: Section) => section.id !== id));
  };

  // Process uploaded image to ensure proper alignment and quality
  const processUploadedImage = async (file: File): Promise<{ url: string, needsProcessing: boolean }> => {
    // Create initial URL for the file
    const initialUrl = URL.createObjectURL(file);
    
    try {
      // Check if the image needs processing
      const needsProc = await shouldProcessImage(initialUrl);
      
      // Always resize large images to reasonable dimensions first
      const resizedUrl = await resizeImage(initialUrl);
      
      // Get the section ID from the file input reference
      const sectionId = parseInt(fileInputRef.current?.getAttribute('data-section-id') || '0');
      const section = sections.find(s => s.id === sectionId);
      
      // Determine the target aspect ratio based on the layout
      let targetAspectRatio = 4/3; // Default
      if (section?.imageLayout.imagesPerRow === 1) {
        targetAspectRatio = 16/9;
      } else if (section?.imageLayout.imagesPerRow === 3) {
        targetAspectRatio = 1;
      }
      
      // Always auto-crop to the target aspect ratio
      const croppedUrl = await autoFitImage(resizedUrl, targetAspectRatio);
      
      // Finally normalize for consistent quality
      const normalizedUrl = await normalizeImage(croppedUrl);
      
      return { url: normalizedUrl, needsProcessing: false };
    } catch (error) {
      console.error('Error processing image:', error);
      return { url: initialUrl, needsProcessing: true };
    }
  };
  
  // Handle image upload for a specific section
  const handleImageUpload = async (sectionId: number, e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setProcessingImage(true);
    
    const processedImages: ImageItem[] = [];
    
    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const { url, needsProcessing } = await processUploadedImage(file);
      
      processedImages.push({
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        file,
        url,
        caption: '',
        needsProcessing
      });
    }
    
    setSections(sections.map((section: Section) => 
      section.id === sectionId 
        ? { ...section, images: [...section.images, ...processedImages] } 
        : section
    ));
    
    setProcessingImage(false);
  };
  
  // Handle drag and drop for images
  const handleDrop = async (e: DragEvent<HTMLDivElement>, sectionId: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    setProcessingImage(true);
    
    const processedImages: ImageItem[] = [];
    
    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const { url, needsProcessing } = await processUploadedImage(file);
      
      processedImages.push({
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        file,
        url,
        caption: '',
        needsProcessing
      });
    }
    
    setSections(sections.map((section: Section) => 
      section.id === sectionId 
        ? { ...section, images: [...section.images, ...processedImages] } 
        : section
    ));
    
    setProcessingImage(false);
  };
  
  // Remove an image
  const removeImage = (sectionId: number, imageId: string) => {
    setSections(sections.map((section: Section) => 
      section.id === sectionId 
        ? { 
            ...section, 
            images: section.images.filter(img => img.id !== imageId) 
          } 
        : section
    ));
  };
  
  // Handle image caption change
  const handleCaptionChange = (sectionId: number, imageId: string, caption: string) => {
    setSections(sections.map((section: Section) => 
      section.id === sectionId 
        ? { 
            ...section, 
            images: section.images.map(img => 
              img.id === imageId ? { ...img, caption } : img
            ) 
          } 
        : section
    ));
  };
  
  // Start cropping an image
  const startCropImage = (sectionId: number, imageId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    
    const image = section.images.find(img => img.id === imageId);
    if (!image) return;
    
    setActiveCropImage({
      sectionId,
      imageId,
      url: image.url
    });
  };
  
  // Complete cropping and update image
  const completeCrop = (croppedImageUrl: string) => {
    if (!activeCropImage) return;
    
    const { sectionId, imageId } = activeCropImage;
    
    setSections(sections.map((section: Section) => 
      section.id === sectionId 
        ? { 
            ...section, 
            images: section.images.map(img => 
              img.id === imageId 
                ? { ...img, url: croppedImageUrl, needsProcessing: false } 
                : img
            ) 
          } 
        : section
    ));
    
    setActiveCropImage(null);
  };
  
  // Cancel cropping
  const cancelCrop = () => {
    setActiveCropImage(null);
  };
  
  // Auto-fit selected image to the right aspect ratio
  const autoFitSelectedImage = async (sectionId: number, imageId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    
    const image = section.images.find(img => img.id === imageId);
    if (!image) return;
    
    try {
      setProcessingImage(true);
      
      // Determine the target aspect ratio based on the layout
      let targetAspectRatio = 4/3; // Default
      if (section.imageLayout.imagesPerRow === 1) {
        targetAspectRatio = 16/9;
      } else if (section.imageLayout.imagesPerRow === 3) {
        targetAspectRatio = 1;
      }
      
      // Process the image
      const processedUrl = await autoFitImage(image.url, targetAspectRatio);
      
      // Update the image
      setSections(sections.map((sec: Section) => 
        sec.id === sectionId 
          ? { 
              ...sec, 
              images: sec.images.map(img => 
                img.id === imageId 
                  ? { ...img, url: processedUrl, needsProcessing: false } 
                  : img
              ) 
            } 
          : sec
      ));
      
    } catch (error) {
      console.error('Error auto-fitting image:', error);
    } finally {
      setProcessingImage(false);
    }
  };
  
  // Prevent default for drag events
  const preventDefault = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  // Move section up
  const moveSectionUp = (id: number) => {
    const sectionIndex = sections.findIndex(section => section.id === id);
    if (sectionIndex <= 0) return; // Can't move first section up
    
    const newSections = [...sections];
    const temp = newSections[sectionIndex];
    newSections[sectionIndex] = newSections[sectionIndex - 1];
    newSections[sectionIndex - 1] = temp;
    
    setSections(newSections);
  };
  
  // Move section down
  const moveSectionDown = (id: number) => {
    const sectionIndex = sections.findIndex(section => section.id === id);
    if (sectionIndex === -1 || sectionIndex === sections.length - 1) return; // Can't move last section down
    
    const newSections = [...sections];
    const temp = newSections[sectionIndex];
    newSections[sectionIndex] = newSections[sectionIndex + 1];
    newSections[sectionIndex + 1] = temp;
    
    setSections(newSections);
  };
  
  // Add function to update image layout
  const updateImageLayout = (sectionId: number, imagesPerRow: 1 | 2 | 3) => {
    setSections(sections.map((section: Section) => 
      section.id === sectionId 
        ? { ...section, imageLayout: { ...section.imageLayout, imagesPerRow } } 
        : section
    ));
  };
  
  // Replace the htmlToPlainText function with a proper HTML parsing function
  const parseHtml = (html: string): { text: string; style: any }[] => {
    const div = document.createElement('div');
    div.innerHTML = html;
    
    const result: { text: string; style: any }[] = [];
    
    // Track nesting level for lists
    let nestingLevel = 0;
    
    const processNode = (node: Node, currentStyle: any = {}, nestLevel: number = 0) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent && node.textContent.trim()) {
          result.push({
            text: node.textContent,
            style: { ...currentStyle, nestLevel }
          });
        }
        return;
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const newStyle = { ...currentStyle };
        let newNestLevel = nestLevel;
        
        // Capture more style attributes from the element for better rendering
        if (element.style) {
          // Check for margin/padding
          if (element.style.marginTop) newStyle.marginTop = parseInt(element.style.marginTop);
          if (element.style.marginBottom) newStyle.marginBottom = parseInt(element.style.marginBottom);
          if (element.style.paddingLeft) newStyle.indent = parseInt(element.style.paddingLeft);
          
          // Check for text color and size
          if (element.style.color) newStyle.color = element.style.color;
          if (element.style.fontSize) newStyle.fontSize = parseInt(element.style.fontSize);
          
          // Check for line height
          if (element.style.lineHeight) newStyle.lineHeight = parseFloat(element.style.lineHeight);
        }
        
        // Process formatting
        switch (element.tagName.toLowerCase()) {
          case 'b':
          case 'strong':
            newStyle.isBold = true;
            break;
          case 'i':
          case 'em':
            newStyle.isItalic = true;
            break;
          case 'u':
            newStyle.isUnderline = true;
            break;
          case 'p':
            // Check for TipTap's text align attribute
            if (element.getAttribute('data-text-align')) {
              newStyle.align = element.getAttribute('data-text-align');
            } else if (element.style.textAlign) {
              newStyle.align = element.style.textAlign;
            }
            
            // Add an empty line before paragraphs (except the first one)
            // But reduce the vertical spacing
            if (element.previousElementSibling) {
              // Add a less aggressive line break - with minimal spacing
              result.push({ text: '\n', style: { reducedSpacing: true } });
            }
            break;
          case 'br':
            // Handle explicit line breaks
            result.push({ text: '\n', style: {} });
            break;
          case 'ul':
            newStyle.list = 'bullet';
            // Increase nesting level for this ul
            newNestLevel += 1;
            break;
          case 'ol':
            newStyle.list = 'ordered';
            // Increase nesting level for this ol
            newNestLevel += 1;
            break;
          case 'li':
            newStyle.isListItem = true;
            // Set the nesting level for the list item
            newStyle.nestLevel = newNestLevel;
            
            if (newStyle.list === 'ordered' && element.parentElement) {
              const startIndex = parseInt(element.parentElement.getAttribute('start') || '1', 10);
              const index = Array.from(element.parentElement.children).indexOf(element);
              newStyle.listIndex = startIndex + index;
            }
            break;
          case 'h1':
            newStyle.isHeading = true;
            newStyle.headingLevel = 1;
            break;
          case 'h2':
            newStyle.isHeading = true;
            newStyle.headingLevel = 2;
            break;
          case 'h3':
            newStyle.isHeading = true;
            newStyle.headingLevel = 3;
            break;
          case 'div':
            // Preserve div styles that might contain formatting
            if (element.className && element.className.includes('content')) {
              // This might be a content div with specific styling
              if (element.style.padding) newStyle.padding = parseInt(element.style.padding);
            }
            break;
        }
        
        // Process all child nodes with the updated style
        for (const childNode of Array.from(node.childNodes)) {
          processNode(childNode, newStyle, newNestLevel);
        }
        
        // Add extra spacing after paragraphs and list items
        if (['p', 'li', 'h1', 'h2', 'h3', 'div'].includes(element.tagName.toLowerCase()) && element.nextElementSibling) {
          let spacingStyle = {};
          
          if (element.tagName.toLowerCase().startsWith('h')) {
            spacingStyle = { extraSpacing: true };
          } else if (element.tagName.toLowerCase() === 'li') {
            // Reduce spacing between list items
            spacingStyle = { reducedSpacing: true, nestLevel: newNestLevel };
          } else if (element.tagName.toLowerCase() === 'p') {
            // Standard paragraph spacing
            spacingStyle = { reducedSpacing: element.nextElementSibling.tagName.toLowerCase() === 'p' };
          }
          
          result.push({ text: '\n', style: spacingStyle });
        }
      }
    };
    
    for (const childNode of Array.from(div.childNodes)) {
      processNode(childNode, {}, 0);
    }
    
    return result;
  };
  
  // Add a more robust helper function to sanitize text before adding to PDF
  const sanitizeTextForPDF = (text: string): string => {
    if (!text) return '';
    
    // Remove all non-printable characters
    let sanitized = text
      // Replace specific problematic characters
      .replace(/[%Ë]/g, '') 
      // Remove other potentially problematic characters - anything outside standard printable range
      .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '')
      // Clean whitespace
      .replace(/\s+/g, ' ')
      .trim();
    
    // Apply additional fixes for bullet point characters if needed
    sanitized = sanitized
      .replace(/•/g, '-') // Replace bullets with hyphens if somehow they ended up in content
      .replace(/○/g, '-')
      .replace(/■/g, '-');
    
    return sanitized;
  };
  
  // Update the generatePDF function
  const generatePDF = async () => {
    if (!reportRef.current) return;
    
    try {
      // Display loading message
      const loadingToast = document.createElement('div');
      loadingToast.innerText = 'Generating PDF, please wait...';
      loadingToast.className = 'fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      document.body.appendChild(loadingToast);
      
      // Initialize PDF with a custom format
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      // PDF dimensions
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Increase horizontal margins for better spacing
      const margin = 15; // Increased from 10 to 15 to match content container
      const contentWidth = pdfWidth - (margin * 2);
      
      // For images, allow them to take up more width
      const imgWidth = Math.min(contentWidth, 120);
      
      // Starting position
      let y = margin + 8;
      let currentPage = 1;
      
      // Helper to add a new page
      const addNewPage = () => {
        pdf.addPage();
        currentPage++;
        y = margin + 8;
        
        // Add page number centered at bottom
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`${currentPage}`, pdfWidth / 2, pdfHeight - margin, { align: 'center' });
      };
      
      // Helper to check if we need a new page
      const checkForNewPage = (heightNeeded: number): boolean => {
        if (y + heightNeeded > pdfHeight - margin - 10) {
          addNewPage();
          return true;
        }
        return false;
      };
      
      // Title and date with modern styling
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(22); // Increased from 18 to match content container
      pdf.setTextColor(40, 40, 40);
      
      // Center the title
      const sanitizedTitle = sanitizeTextForPDF(reportTitle);
      const titleWidth = pdf.getStringUnitWidth(sanitizedTitle) * 22 / pdf.internal.scaleFactor;
      pdf.text(sanitizedTitle, pdfWidth / 2, y + 10, { align: 'center' });
      y += 17;
      
      // Add date with more subtle styling
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11); // Increased from 10 to match content container
      pdf.setTextColor(100, 100, 100);
      const dateText = getDateRangeText();
      pdf.text(dateText, pdfWidth / 2, y, { align: 'center' });
      y += 20; // Increased spacing after date heading
      
      // Process sections
      for (const section of sections) {
        // Check if we need a new page for the section
        checkForNewPage(25);
        
        // Add section title - more modern, left-aligned
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16); // Increased from 14 to match content container
        pdf.setTextColor(60, 60, 60);
        pdf.text(sanitizeTextForPDF(section.title), margin, y);
        y += 12;
        
        // Add section content with better readability
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(40, 40, 40);
        
        // Parse HTML content to preserve formatting
        const contentItems = parseHtml(section.content);
        
        let currentX = margin;
        let listItemIndex = 0;
        let isInList = false;
        let currentListType = '';
        let lastItemWasList = false;
        
        // Process and render each content item with its style
        for (const item of contentItems) {
          // Check if we need a new page
          checkForNewPage(6);
          
          // Special handling for line breaks
          if (item.text === '\n') {
            // Handle different types of line breaks with appropriate spacing
            if (item.style.extraSpacing) {
              y += 6; // For headings
            } else if (item.style.reducedSpacing) {
              y += 2.5; // For paragraph breaks - increased slightly
            } else {
              y += 3.5; // Default line break spacing - increased
            }
            continue;
          }
          
          // Handle list items
          if (item.style.isListItem) {
            lastItemWasList = true;
            // Reset X position for list items
            const nestLevel = item.style.nestLevel || 0;
            
            // Calculate indentation based on nesting level
            const baseIndent = margin + 5;
            const nestIndent = nestLevel * 8; // Increased from 6 to 8 for better nesting appearance
            
            // Track the list state and type
            if (currentListType !== item.style.list) {
              currentListType = item.style.list;
              listItemIndex = 1;
              
              // Add extra spacing before a new list starts (if not already in a list)
              if (!isInList) {
                y += 2; // Add a small gap before starting a new list
                isInList = true;
              }
            }
            
            if (item.style.list === 'bullet') {
              // Position for bullet point
              const bulletX = margin + nestIndent;
              
              // Set consistent font for bullet
              pdf.setFont('helvetica', 'normal');
              pdf.setTextColor(0, 0, 0);
              pdf.setFontSize(11);
              
              // Draw bullet point
              pdf.text("•", bulletX, y);
              
              // Set text position with proper spacing (8mm after bullet)
              currentX = bulletX + 8;
            } else if (item.style.list === 'ordered') {
              // Position for number
              const numberX = margin + nestIndent;
              
              // Determine prefix format based on nesting level
              let prefix;
              if (nestLevel === 0) {
                // Top level - 1. 2. 3.
                prefix = `${listItemIndex}.`;
              } else if (nestLevel === 1) {
                // Second level - a) b) c)
                prefix = `${String.fromCharCode(96 + listItemIndex)})`;
              } else {
                // Third level - i. ii. iii.
                prefix = `${romanize(listItemIndex)}.`;
              }
              
              // Draw the number/prefix
              pdf.setFont('helvetica', 'normal');
              pdf.setTextColor(0, 0, 0);
              pdf.setFontSize(11);
              pdf.text(prefix, numberX, y);
              
              // Update for next ordered item
              listItemIndex++;
              
              // Set text position with proper spacing (depends on prefix length)
              const prefixWidth = pdf.getStringUnitWidth(prefix) * pdf.getFontSize() / pdf.internal.scaleFactor;
              currentX = numberX + prefixWidth + 2; // Add 2mm spacing after prefix
            }
            
            // Restore original styling for the actual text content
            if (item.style.isBold) {
              pdf.setFont('helvetica', 'bold');
            } else {
              pdf.setFont('helvetica', 'normal');
            }
            
            if (item.style.isHeading) {
              const headingSizes: Record<number, number> = { 1: 16, 2: 14, 3: 12 };
              const level = item.style.headingLevel || 1;
              pdf.setFontSize(headingSizes[level] || 11);
            } else if (item.style.fontSize) {
              pdf.setFontSize(Math.min(Math.max(item.style.fontSize, 8), 20));
            } else {
              pdf.setFontSize(11);
            }
            
            if (item.style.isItalic && item.style.isBold) {
              pdf.setFont('helvetica', 'bolditalic');
            } else if (item.style.isItalic) {
              pdf.setFont('helvetica', 'italic');
            }
            
            // Process and draw the text content
            const text = item.text === '\n' ? ' ' : sanitizeTextForPDF(item.text);
            
            // Calculate available width for text
            const availableWidth = contentWidth - (currentX - margin);
            
            // Split text to fit within available width
            const lines = pdf.splitTextToSize(text, availableWidth);
            
            // Setup alignment options (list items are typically left-aligned)
            const textOptions: any = {};
            
            // Draw the first line aligned with the bullet/number
            if (lines.length > 0) {
              pdf.text(lines[0], currentX, y, textOptions);
              
              // If there are more lines, draw them with proper spacing
              if (lines.length > 1) {
                const lineSpacing = item.style.lineHeight 
                  ? (item.style.lineHeight * pdf.getFontSize() / 2.5) // Match content container line height
                  : (pdf.getFontSize() * 0.55); // Increased for better readability
                
                for (let i = 1; i < lines.length; i++) {
                  y += lineSpacing;
                  pdf.text(lines[i], currentX, y, textOptions);
                }
              }
              
              // Add spacing after the list item
              const lineSpacing = item.style.lineHeight 
                ? (item.style.lineHeight * pdf.getFontSize() / 2.5) // Match content container line height
                : (pdf.getFontSize() * 0.55); // Increased from 0.45
              
              y += lineSpacing * 1.2; // Better spacing for list items
            }
            
            // Skip regular text drawing since we've handled it here
            continue;
          } else {
            // Reset for non-list content
            if (lastItemWasList) {
              // Add extra spacing after the end of a list
              y += 4;
              isInList = false;
              lastItemWasList = false;
            }
            
            currentX = item.style.indent ? margin + (item.style.indent / 5) : margin;
            currentListType = '';
          }
          
          // Handle text alignment
          let xPos = currentX;
          if (item.style.align === 'center') {
            xPos = pdfWidth / 2;
          } else if (item.style.align === 'right') {
            xPos = pdfWidth - margin;
          }
          
          // Apply margin/padding spacing
          if (item.style.marginTop) {
            y += item.style.marginTop / 3.5; // Better conversion from px to mm
          }
          
          // Process the text with proper sanitization
          const text = item.text === '\n' ? ' ' : sanitizeTextForPDF(item.text);
          
          // Calculate available width for text
          const availableWidth = contentWidth - (currentX - margin);
          
          // Split text to fit the available width
          const lines = pdf.splitTextToSize(text, availableWidth);
          
          // Setup alignment options
          const textOptions: any = {};
          if (item.style.align === 'center') {
            textOptions.align = 'center';
          } else if (item.style.align === 'right') {
            textOptions.align = 'right';
          }
          
          // Draw the first line at the same Y position as the bullet
          if (lines.length > 0) {
            pdf.text(lines[0], currentX, y, textOptions);
            
            // If there are more lines, draw them with proper spacing
            if (lines.length > 1) {
              const lineSpacing = item.style.lineHeight 
                ? (item.style.lineHeight * pdf.getFontSize() / 2.5) // Match content container line height
                : (pdf.getFontSize() * 0.55); // Better line spacing that matches content
              
              for (let i = 1; i < lines.length; i++) {
                y += lineSpacing;
                pdf.text(lines[i], currentX, y, textOptions);
              }
            }
            
            // Increment Y position after the text based on line count
            if (lines.length === 1) {
              y += pdf.getFontSize() * 0.55; // Increase spacing after single line items
            }
            
            // Skip the standard text drawing
            continue;
          }
          
          // Add underline if needed (draw immediately after the text)
          if (item.style.isUnderline && text.trim()) {
            const textWidth = pdf.getStringUnitWidth(text) * pdf.getFontSize() / pdf.internal.scaleFactor;
            let underlineX = xPos;
            
            if (item.style.align === 'center') {
              underlineX = (pdfWidth / 2) - (textWidth / 2);
            } else if (item.style.align === 'right') {
              underlineX = pdfWidth - margin - textWidth;
            }
            
            pdf.line(underlineX, y + 1, underlineX + textWidth, y + 1);
          }
          
          // Calculate line spacing based on style or use default
          const lineSpacing = item.style.lineHeight 
            ? (item.style.lineHeight * pdf.getFontSize() / 2.5) // Match content container line height
            : (pdf.getFontSize() * 0.55); // Increased for better readability
          
          // Increase y position based on number of lines and line spacing
          y += lineSpacing * Math.max(1, lines.length);
          
          // Apply margin bottom spacing
          if (item.style.marginBottom) {
            y += item.style.marginBottom / 4; // Better conversion from px to mm
          }
        }
        
        // Add spacing after content
        y += 7;
        
        // Process images if any
        if (section.images.length > 0) {
          // Handle multirow image layouts in PDF
          const imagesPerRow = section.imageLayout.imagesPerRow;
          const rows = Math.ceil(section.images.length / imagesPerRow);
          
          for (let row = 0; row < rows; row++) {
            const startIdx = row * imagesPerRow;
            const endIdx = Math.min(startIdx + imagesPerRow, section.images.length);
            const rowImages = section.images.slice(startIdx, endIdx);
            
            // Calculate image width based on images per row
            const imageSpacing = 5; // Increased from 4 for better spacing between images
            const totalSpacing = (imagesPerRow - 1) * imageSpacing;
            const availableWidth = contentWidth - totalSpacing;
            
            // Adjust sizing based on image layout
            let singleImageWidth;
            let imageHeight;
            
            if (imagesPerRow === 1) {
              // For single image layout - center and make larger but not full width
              singleImageWidth = Math.min(availableWidth * 0.85, 130); // Increased width for single images
              imageHeight = 75; // Increased height for single image
            } else if (imagesPerRow === 2) {
              // For two image layout - make each image narrower to prevent overlap
              singleImageWidth = Math.min(availableWidth / 2 - 6, 95); // Adjusted width for two images
              imageHeight = 65; // Increased height for two-image layout
            } else {
              // For three image layout
              singleImageWidth = availableWidth / 3;
              imageHeight = 45; // Increased from 40
            }
            
            // Special handling for different layouts
            let xPositions: number[] = [];
            let xPos: number;
            
            if (imagesPerRow === 2) {
              // For two images, calculate exact positions to prevent overlap
              const totalWidth = 2 * singleImageWidth;
              const remainingSpace = contentWidth - totalWidth;
              const gapBetween = Math.max(remainingSpace * 0.5, 12); // Use 50% of remaining space for gap, minimum 12mm
              
              // Calculate the left edge of the first image - distribute remaining space evenly
              const leftStart = margin + (contentWidth - totalWidth - gapBetween) / 2;
              
              // Store positions for both images
              xPositions = [
                leftStart,
                leftStart + singleImageWidth + gapBetween
              ];
              
              // Set initial position to the first image
              xPos = xPositions[0];
            } else if (rowImages.length < imagesPerRow && imagesPerRow > 1) {
              // Center the row for other layouts
              const actualTotalWidth = (rowImages.length * singleImageWidth) + ((rowImages.length - 1) * imageSpacing);
              xPos = margin + (contentWidth - actualTotalWidth) / 2;
            } else {
              xPos = margin;
            }
            
            // Check if we need a new page for the image row
            if (checkForNewPage(imageHeight + 15)) {
              // We already added a new page in the check
              // Reset x position for the new page
              if (imagesPerRow === 2) {
                // For two images, use our pre-calculated positions
                xPos = xPositions[0]; // Start with the first image position
              } else if (rowImages.length < imagesPerRow && imagesPerRow > 1) {
                // Center the row for other layouts
                const actualTotalWidth = (rowImages.length * singleImageWidth) + ((rowImages.length - 1) * imageSpacing);
                xPos = margin + (contentWidth - actualTotalWidth) / 2;
              } else {
                xPos = margin;
              }
            }
            
            // Process each image in the current row
            for (const image of rowImages) {
              try {
                // Compress the image before adding to PDF
                const compressedImageUrl = await compressImage(image.url);
                
                // Add the image to PDF
                await new Promise<void>((resolve) => {
                  const imgObj = document.createElement('img');
                  imgObj.src = compressedImageUrl;
                  
                  imgObj.onload = () => {
                    try {
                      // Calculate image dimensions preserving aspect ratio
                      const aspectRatio = imgObj.width / imgObj.height;
                      let imgWidth = singleImageWidth;
                      let imgHeight = imgWidth / aspectRatio;
                      
                      // If height exceeds our target, adjust width to maintain aspect ratio
                      if (imgHeight > imageHeight) {
                        imgHeight = imageHeight;
                        imgWidth = imgHeight * aspectRatio;
                        
                        // Re-center the image horizontally if width changed
                        if (imagesPerRow === 1 || (imagesPerRow === 2 && rowImages.length === 1)) {
                          // For single image layout or a single image in a two-image row
                          xPos = (xPos === margin) ? margin + (contentWidth - imgWidth) / 2 : xPos;
                        }
                      }
                      
                      // First add a white background rectangle to ensure transparency is replaced with white
                      pdf.setFillColor(255, 255, 255);
                      pdf.rect(xPos, y, imgWidth, imgHeight, 'F');
                      
                      // Now add the image on top
                      pdf.addImage(
                        compressedImageUrl,
                        'JPEG',
                        xPos,
                        y,
                        imgWidth,
                        imgHeight
                      );
                      
                      // Add caption if it exists
                      if (image.caption) {
                        const captionY = y + imgHeight + 3.5; // Increased spacing between image and caption
                        pdf.setFont('helvetica', 'italic');
                        pdf.setFontSize(9); // Increased from 8 for better readability
                        pdf.setTextColor(100, 100, 100); // Lighter gray for captions
                        
                        // Center the caption under the image
                        pdf.text(
                          image.caption, 
                          xPos + (imgWidth / 2), 
                          captionY, 
                          { align: 'center', maxWidth: imgWidth }
                        );
                      }
                      
                      // Move position for next image with appropriate spacing
                      // For two images, use the pre-calculated positions
                      if (imagesPerRow === 2 && rowImages.length === 2) {
                        // We're positioned at the first image and need to move to the second image
                        // Use the pre-calculated position for the second image
                        xPos = xPositions[1];
                      } else {
                        // For other layouts, just add spacing
                        const nextImageSpacing = imageSpacing;
                        xPos += imgWidth + nextImageSpacing;
                      }
                      
                    } catch (err) {
                      console.error('Error adding image to PDF:', err);
                    }
                    resolve();
                  };
                  
                  imgObj.onerror = () => {
                    console.error('Error loading image');
                    resolve();
                  };
                });
              } catch (err) {
                console.error('Error compressing image:', err);
              }
            }
            
            // Move down for next row of images
            const rowHeight = imageHeight + (rowImages.some(img => img.caption) ? 10 : 0); // Increased caption space
            y += rowHeight + 8; // More space between image rows
          }
        }
        
        // Add some space after each section
        y += 7; // Consistent spacing between sections
      }
      
      // Add page number to the first page
      pdf.setPage(1);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`${currentPage}`, pdfWidth / 2, pdfHeight - margin, { align: 'center' });
      
      // Save the PDF
      pdf.save('report.pdf');
      
      // Remove loading message
      loadingToast.remove();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };
  
  // Helper to compress image
  const compressImage = async (imageUrl: string, maxWidth = 1000, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      img.src = imageUrl;
      
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let newWidth = img.width;
        let newHeight = img.height;
        
        if (newWidth > maxWidth) {
          const ratio = maxWidth / newWidth;
          newWidth = maxWidth;
          newHeight = img.height * ratio;
        }
        
        // Create a canvas to draw and compress the image
        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          
          // Return compressed image as data URL
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          // If context fails, return original (fallback)
          resolve(imageUrl);
        }
      };
      
      img.onerror = () => {
        // If loading fails, return original (fallback)
        resolve(imageUrl);
      };
    });
  };
  
  // Add helper function to convert numbers to Roman numerals
  const romanize = (num: number): string => {
    if (isNaN(num)) return "";
    const digits = String(+num).split("");
    const key = ["","C","CC","CCC","CD","D","DC","DCC","DCCC","CM",
                 "","X","XX","XXX","XL","L","LX","LXX","LXXX","XC",
                 "","I","II","III","IV","V","VI","VII","VIII","IX"];
    let roman = "";
    let i = 3;
    while (i--) {
      roman = (key[+digits.pop()! + (i * 10)] || "") + roman;
    }
    return Array(+digits.join("") + 1).join("M") + roman;
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cropper modal */}
      {activeCropImage && (
        <ImageCropper
          imageUrl={activeCropImage.url}
          aspectRatio={
            sections.find(s => s.id === activeCropImage.sectionId)?.imageLayout.imagesPerRow === 1
              ? 16/9
              : sections.find(s => s.id === activeCropImage.sectionId)?.imageLayout.imagesPerRow === 2
                ? 4/3
                : 1
          }
          onCropComplete={completeCrop}
          onCancel={cancelCrop}
        />
      )}
      
      {/* Loading overlay */}
      {processingImage && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span>Processing image...</span>
          </div>
        </div>
      )}
      
      <main className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="bg-white dark:bg-slate-800 shadow-sm rounded-lg p-6 mb-6" ref={reportRef}>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Report Builder</h1>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600"
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
          </div>
          <div className="mb-6">
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full p-2 border border-gray-200 dark:border-gray-700 dark:bg-slate-800 dark:text-white rounded-md text-2xl font-bold mb-2"
              placeholder="Report Title"
            />
            <div className="flex gap-4 items-center mt-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400">Start Date:</label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="border border-gray-200 dark:border-gray-700 dark:bg-slate-800 dark:text-white rounded-md p-1 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400">End Date:</label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="border border-gray-200 dark:border-gray-700 dark:bg-slate-800 dark:text-white rounded-md p-1 text-sm"
                />
              </div>
            </div>
          </div>
          
          {sections.map((section: Section) => (
            <div key={section.id} className="mb-8 pb-6 border-b border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="mb-4">
                    <div className="flex items-center space-x-1 pdf-hide mb-2">
                      <button
                        onClick={() => moveSectionUp(section.id)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Move section up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => moveSectionDown(section.id)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Move section down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => handleTitleChange(section.id, e.target.value)}
                      className="w-full p-2 border border-gray-200 dark:border-gray-700 dark:bg-slate-800 dark:text-white rounded-md text-lg font-semibold mb-2"
                      placeholder="Section title..."
                    />
                    <RichTextEditor
                      content={section.content}
                      onChange={(content) => handleContentChange(section.id, content)}
                      placeholder="Write your content here..."
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-1 pdf-hide">
                  {sections.length > 1 && (
                    <button
                      onClick={() => removeSection(section.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                      title="Remove section"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              
              {section.images.length === 0 && (
                <div 
                  className="border-2 border-dashed border-gray-200 rounded-md p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-white pdf-hide mb-3 bg-white"
                  style={{ minHeight: "150px" }}
                  onDragOver={preventDefault}
                  onDragEnter={preventDefault}
                  onDragLeave={preventDefault}
                  onDrop={(e) => handleDrop(e, section.id)}
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.setAttribute('data-section-id', section.id.toString());
                      fileInputRef.current.click();
                    }
                  }}
                >
                  <Image className="h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 mb-1">Drop images here or click to upload</p>
                  <p className="text-xs text-gray-400">The images will appear in your report</p>
                </div>
              )}
              
              {section.images.length > 0 && (
                <div className="pdf-hide mt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-500 mr-2">Image layout:</span>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => updateImageLayout(section.id, 1)}
                          className={`p-2 rounded ${
                            section.imageLayout.imagesPerRow === 1 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                          title="Single image layout"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <rect x="3" y="6" width="14" height="8" rx="1" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateImageLayout(section.id, 2)}
                          className={`p-2 rounded ${
                            section.imageLayout.imagesPerRow === 2 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                          title="Two images per row"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <rect x="2" y="6" width="7" height="8" rx="1" />
                            <rect x="11" y="6" width="7" height="8" rx="1" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateImageLayout(section.id, 3)}
                          className={`p-2 rounded ${
                            section.imageLayout.imagesPerRow === 3 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                          title="Three images per row"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <rect x="1" y="6" width="5" height="8" rx="1" />
                            <rect x="7.5" y="6" width="5" height="8" rx="1" />
                            <rect x="14" y="6" width="5" height="8" rx="1" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{section.images.length} image{section.images.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}
              
              {section.images.length > 0 && (
                <div className="mt-4 flex justify-center w-full">
                  <div 
                    className={`grid ${
                      section.imageLayout.imagesPerRow === 1 
                        ? 'gap-6' 
                        : section.imageLayout.imagesPerRow === 2 
                          ? 'gap-10' 
                          : 'gap-4'
                    }`}
                    style={{
                      gridTemplateColumns: 
                        section.imageLayout.imagesPerRow === 1 
                          ? '1fr' 
                          : section.imageLayout.imagesPerRow === 2 
                            ? '1fr 1fr' 
                            : 'repeat(3, minmax(0, 1fr))',
                      justifyContent: 'center',
                      alignItems: 'center',
                      maxWidth: section.imageLayout.imagesPerRow === 1 
                        ? '85%'
                        : section.imageLayout.imagesPerRow === 2 
                          ? '90%' 
                          : '98%',
                      margin: 'auto',
                      width: section.imageLayout.imagesPerRow === 3 ? '100%' : 'auto'
                    }}
                  >
                    {section.images.map((image) => (
                      <div 
                        key={image.id} 
                        className={`relative flex flex-col items-center ${
                          section.imageLayout.imagesPerRow === 1 
                            ? 'w-[95%]'
                            : section.imageLayout.imagesPerRow === 2 
                              ? 'w-[95%]' 
                              : 'w-full'
                        } group mx-auto`}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <div 
                          className="relative overflow-hidden rounded-md bg-white w-full"
                          style={{
                            aspectRatio: section.imageLayout.imagesPerRow === 1 ? '16/9' : section.imageLayout.imagesPerRow === 2 ? '4/3' : '1/1',
                            maxHeight: section.imageLayout.imagesPerRow === 1 
                              ? '450px'
                              : section.imageLayout.imagesPerRow === 2 
                                ? '300px' 
                                : '280px',
                            width: section.imageLayout.imagesPerRow === 3 ? '100%' : 'auto',
                            margin: '0 auto',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                          }}
                        >
                          <img
                            src={image.url}
                            alt={image.caption || "Report image"}
                            className={`${
                              section.imageLayout.imagesPerRow === 3
                                ? 'object-cover w-full h-full transition-transform duration-200 hover:scale-105' // For 3-image layout, fill the container with hover effect
                                : 'object-contain max-h-full max-w-full' // For 1 and 2-image layouts, contain within
                            }`}
                            style={section.imageLayout.imagesPerRow === 3 ? { objectFit: 'cover', width: '100%', height: '100%' } : {}}
                          />
                          
                          {/* Edit overlay */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black bg-opacity-40 transition-opacity pdf-hide">
                            <div className="flex gap-2">
                              <button
                                onClick={() => startCropImage(section.id, image.id)}
                                className="p-2 bg-white rounded-full hover:bg-gray-100"
                                title="Manual crop"
                              >
                                <Crop className="h-5 w-5 text-gray-700" />
                              </button>
                              
                              <button
                                onClick={() => autoFitSelectedImage(section.id, image.id)}
                                className="p-2 bg-white rounded-full hover:bg-gray-100"
                                title="Auto-fit"
                              >
                                <Edit className="h-5 w-5 text-gray-700" />
                              </button>
                            </div>
                          </div>
                          
                          {/* Indicator for images that may need adjustment */}
                          {image.needsProcessing && (
                            <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs py-1 px-2 rounded-full pdf-hide">
                              Adjust Recommended
                            </div>
                          )}
                        </div>
                        <input
                          type="text"
                          value={image.caption || ''}
                          onChange={(e) => handleCaptionChange(section.id, image.id, e.target.value)}
                          className="w-full text-center border-0 border-b border-gray-200 focus:ring-0 text-sm mt-1"
                          placeholder="Add caption..."
                        />
                        
                        <button
                          onClick={() => removeImage(section.id, image.id)}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 pdf-hide"
                          title="Remove image"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    
                    {/* Add image button integrated into the grid */}
                    <div 
                      className="relative flex flex-col items-center justify-center pdf-hide border-2 border-dashed border-gray-200 rounded-md cursor-pointer hover:bg-gray-50 justify-self-center place-self-center mx-auto bg-white"
                      style={{
                        width: section.imageLayout.imagesPerRow === 3 ? '50px' : '60px',
                        height: section.imageLayout.imagesPerRow === 3 ? '50px' : '60px',
                        borderRadius: '8px',
                        gridColumn: section.imageLayout.imagesPerRow === 1 ? '1' : 'auto'
                      }}
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.setAttribute('data-section-id', section.id.toString());
                          fileInputRef.current.click();
                        }
                      }}
                    >
                      <Plus className={`${section.imageLayout.imagesPerRow === 3 ? 'h-4 w-4' : 'h-5 w-5'} text-gray-400`} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <button 
          onClick={addSection}
          className="flex items-center justify-center w-full bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium py-2 px-3 rounded-md text-sm mb-4"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Section
        </button>
        
        <button 
          onClick={generatePDF}
          className="flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-md"
        >
          <Download className="mr-1 h-4 w-4" />
          Generate PDF
        </button>
      </main>
      
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        multiple
        onChange={(e) => {
          if (e.target && fileInputRef.current) {
            const sectionId = parseInt(fileInputRef.current.getAttribute('data-section-id') || '0');
            handleImageUpload(sectionId, e);
            e.target.value = ''; // Reset file input
          }
        }}
      />
    </div>
  );
};

export default ReportBuilder; 