"use client";

import React, {
  useState,
  useRef,
  ChangeEvent,
  DragEvent,
  useEffect
} from "react";
import {
  FileText,
  Image,
  Download,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit,
  Moon,
  Sun,
  Save,
  X,
  Edit2,
  RotateCw,
  Crop,
  Check,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  resizeImage,
  normalizeImage,
  shouldProcessImage
} from "./ImageUtility";
import RichTextEditor from "./RichTextEditor";
import { useTheme } from "@/contexts/ThemeContext";
import { indexedDBService } from '@/utils/indexedDB';
import { toast } from 'react-hot-toast';
import ImageCropper from "./ImageCropper";
import { processImage, optimizeForStorage, optimizeForDisplay, rotateImage, calculateImageSize } from '../utils/imageProcessor';
import { storeImage, getImage, removeImage as removeStoredImage } from '../utils/imageStorage';

interface ImageItem {
  id: string;
  file: File;
  url: string;
  caption: string;
  needsProcessing?: boolean;
  rotation: number;
}

type ImageSize = 'small' | 'medium' | 'large';

interface Section {
  id: number;
  title: string;
  content: string; // HTML content
  images: ImageItem[];
  imageLayout: {
    imagesPerRow: 1 | 2 | 3;
    imageSize: ImageSize;
  };
  titleColor?: string; // Add title color option
  startOnNewPage?: boolean; // Add option to start section on new page
}

interface ReportBuilderProps {
  initialData?: {
    title: string;
    startDate: string;
    endDate: string;
    sections: Section[];
    name?: string;
    titleColor?: string; // Add title color option
  };
  reportId?: string;
  onClose: () => void;
}

const TITLE_COLORS = [
  { name: "Default", value: "#000000", preview: "#000000", isDefault: true },   // Default black
  { name: "Slate", value: "#64748b", preview: "#64748b" },     // Modern slate gray
  { name: "Sky", value: "#0ea5e9", preview: "#0ea5e9" },       // Modern sky blue
  { name: "Sage", value: "#84cc16", preview: "#84cc16" },      // Modern sage green
  { name: "Rose", value: "#f43f5e", preview: "#f43f5e" },      // Modern rose red
  { name: "Amber", value: "#f59e0b", preview: "#f59e0b" },     // Modern amber
  { name: "Violet", value: "#8b5cf6", preview: "#8b5cf6" }     // Modern violet
];

const ReportBuilder: React.FC<ReportBuilderProps> = ({ initialData, reportId, onClose }) => {
  const { theme, toggleTheme } = useTheme();

  // ------------------
  // STATE
  // ------------------
  const [reportName, setReportName] = useState<string>(initialData?.name || "");
  const [reportTitle, setReportTitle] = useState<string>(initialData?.title || "Weekly Report");
  const [reportTitleColor, setReportTitleColor] = useState<string>(initialData?.titleColor || "#000000");
  const [reportStartDate, setReportStartDate] = useState<string>(
    initialData?.startDate || new Date().toISOString().slice(0, 10)
  );
  const [reportEndDate, setReportEndDate] = useState<string>(
    initialData?.endDate || new Date().toISOString().slice(0, 10)
  );
  const [sections, setSections] = useState<Section[]>(
    initialData?.sections || [{
      id: 1,
      title: "Summary",
      content: "",
      images: [],
      imageLayout: { imagesPerRow: 2, imageSize: 'medium' },
      titleColor: "#000000" // Default to black
    }]
  );
  const [processingImage, setProcessingImage] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string>("");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [existingReport, setExistingReport] = useState<any>(null);
  const [newReportName, setNewReportName] = useState("");
  const [showNamePrompt, setShowNamePrompt] = useState(!initialData?.name && !reportId);
  const [saveStatus, setSaveStatus] = useState<{
    isSaving: boolean;
    message: string;
    type: 'success' | 'error' | '';
  }>({
    isSaving: false,
    message: '',
    type: ''
  });
  const [isInitialized, setIsInitialized] = useState(!!initialData?.name || !!reportId);
  const [useDateInName, setUseDateInName] = useState(false);
  const [previewReportName, setPreviewReportName] = useState("");
  const [dateFieldsConfigured, setDateFieldsConfigured] = useState(false);
  const [croppingImage, setCroppingImage] = useState<{ sectionId: number; imageId: string; url: string } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const currentReportIdRef = useRef<string>(reportId || '');

  // Initialize report data
  useEffect(() => {
    const loadReport = async () => {
      if (initialData?.name) {
        setReportName(initialData.name);
        setReportTitle(initialData.title);
        setReportStartDate(initialData.startDate);
        setReportEndDate(initialData.endDate);
        setSections(initialData.sections);
        setIsInitialized(true);
        // Ensure we have a report ID for existing reports
        if (reportId) {
          currentReportIdRef.current = reportId;
        }
      } else if (reportId) {
        try {
          const report = await indexedDBService.getReport(reportId);
          if (report) {
            setReportName(report.name);
            setReportTitle(report.content.title);
            setReportStartDate(report.content.startDate);
            setReportEndDate(report.content.endDate);
            setSections(report.content.sections);
            currentReportIdRef.current = report.id;
            setIsInitialized(true);
          }
        } catch (error) {
          console.error('Error loading report:', error);
          toast.error('Failed to load report');
        }
      }
    };

    loadReport();
  }, [initialData, reportId]);

  // Calculate total report size
  const calculateReportSize = (sections: Section[]): number => {
    // Calculate size of text content
    const contentSize = new Blob([JSON.stringify({
      title: reportTitle,
      startDate: reportStartDate,
      endDate: reportEndDate,
      sections: sections.map(s => ({
        ...s,
        content: s.content,
        images: s.images.map(img => ({
          ...img,
          url: '' // Don't include the full image data in size calculation
        }))
      }))
    })]).size;

    // Calculate size of all images
    const imageSize = sections.reduce((total, section) => {
      return total + section.images.reduce((sectionTotal, img) => {
        // For data URLs, remove the prefix and calculate actual base64 size
        if (img.url.startsWith('data:')) {
          const base64 = img.url.split(',')[1];
          return sectionTotal + (base64.length * 0.75); // base64 is 4/3 times larger than actual size
        }
        return sectionTotal;
      }, 0);
    }, 0);

    return contentSize + imageSize;
  };

  // Update report name based on date checkbox
  useEffect(() => {
    if (useDateInName && reportName) {
      let baseName = reportName;
      // If the report name already contains a date pattern, extract the base name
      if (reportName.includes('_') && /_\d+/.test(reportName)) {
        baseName = reportName.split('_')[0];
      }
      const dateFormattedName = getDefaultReportName(reportStartDate, reportEndDate, baseName);
      setPreviewReportName(dateFormattedName);
    } else {
      setPreviewReportName("");
    }
  }, [useDateInName, reportName, reportStartDate, reportEndDate]);

  // Store current report name in localStorage for real-time access
  useEffect(() => {
    if (reportName) {
      localStorage.setItem('currentReportName', reportName);
    }
  }, [reportName]);

  // Save function
  const saveReport = async (forceSave: boolean = false) => {
    if (!reportName && !forceSave && !showNamePrompt) {
      setShowNamePrompt(true);
      return;
    }

    if (showNamePrompt) {
      if (!reportName.trim()) {
        toast.error("Please enter a report name");
        return;
      }
      setShowNamePrompt(false);
    }

    setIsSaving(true);
    setSaveStatus({ isSaving: true, message: "Saving report...", type: "" });

    try {
      // Compress all images before saving
      const compressedSections = await Promise.all(
        sections.map(async (section) => {
          const compressedImages = await Promise.all(
            section.images.map(async (image) => {
              try {
                // Only compress if it's a data URL
                if (image.url.startsWith('data:')) {
                  const compressedUrl = await compressImageForStorage(image.url);
                  return { ...image, url: compressedUrl };
                }
                return image;
              } catch (error) {
                console.error("Error compressing image:", error);
                return image; // Keep original if compression fails
              }
            })
          );
          return { ...section, images: compressedImages };
        })
      );

      const reportData = {
        name: reportName,
        title: reportTitle,
        startDate: reportStartDate,
        endDate: reportEndDate,
        sections: compressedSections,
        titleColor: reportTitleColor
      };

      if (!currentReportIdRef.current) {
        currentReportIdRef.current = `report_${Date.now()}`;
      }

      const finalReportName = useDateInName ? previewReportName : reportName;

      const currentReport = {
        id: currentReportIdRef.current,
        name: finalReportName,
        title: reportTitle,
        titleColor: reportTitleColor,
        lastModified: new Date().toISOString(),
        size: calculateReportSize(compressedSections),
        content: {
          name: finalReportName,
          title: reportTitle,
          titleColor: reportTitleColor,
          startDate: reportStartDate,
          endDate: reportEndDate,
          sections: compressedSections,
        },
      };

      await indexedDBService.saveReport(currentReport);

      setSaveStatus({
        isSaving: false,
        message: 'Saved',
        type: 'success'
      });

      setTimeout(() => {
        setSaveStatus(prev => ({
          ...prev,
          message: ''
        }));
      }, 2000);

    } catch (error) {
      console.error('Error saving report:', error);
      setSaveStatus({
        isSaving: false,
        message: 'Failed to save',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Compress image for storage in IndexedDB
  const compressImageForStorage = async (imageUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          reject(new Error("Canvas context not available"));
          return;
        }
        
        // Calculate dimensions for compression
        let width = img.width;
        let height = img.height;
        
        // If image is larger than 1200px in any dimension, reduce it proportionally
        const maxDimension = 1200;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw image with white background (for transparent PNGs)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with 0.7 quality for storage (good balance between size and quality)
        const compressedUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressedUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image for compression"));
      img.src = imageUrl;
    });
  };

  // Update the getDefaultReportName function
  const getDefaultReportName = (startDate: string, endDate: string, baseName: string) => {
    if (!baseName.trim()) return '';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const startMonth = start.toLocaleString('default', { month: 'short' });
    const endMonth = end.toLocaleString('default', { month: 'short' });
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    
    let dateStr = '';
    if (startMonth === endMonth && startYear === endYear) {
      dateStr = `${start.getDate()}-${end.getDate()}_${startMonth}_${startYear}`;
    } else if (startYear === endYear) {
      dateStr = `${start.getDate()}_${startMonth}-${end.getDate()}_${endMonth}_${startYear}`;
    } else {
      dateStr = `${start.getDate()}_${startMonth}_${startYear}-${end.getDate()}_${endMonth}_${endYear}`;
    }
    
    return baseName ? `${baseName}_${dateStr}` : dateStr;
  };

  // Update the useEffect for initial name prompt
  useEffect(() => {
    if (!initialData && !reportId && !reportName) {
      setShowNamePrompt(true);
    }
  }, [initialData, reportId, reportName]);

  // Auto-save effect
  useEffect(() => {
    if (!isInitialized || !reportName) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveReport();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [reportTitle, reportStartDate, reportEndDate, sections, reportName, isInitialized]);

  // ------------------
  // DATE DISPLAY
  // ------------------
  const getDateRangeText = () => {
    if (reportStartDate === reportEndDate) {
      return reportStartDate;
    }
    return `${reportStartDate} to ${reportEndDate}`;
  };

  // ------------------
  // SECTION TEXT HANDLERS
  // ------------------
  const handleContentChange = (id: number, content: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, content } : section
      )
    );
  };

  const handleTitleChange = (id: number, title: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, title } : section
      )
    );
  };

  // ------------------
  // SECTION CRUD
  // ------------------
  const addSection = () => {
    const newId = Math.max(0, ...sections.map((s) => s.id)) + 1;
    const sectionTitle = reportName || "New Section";
    
    setSections((prev) => [
      ...prev,
      {
        id: newId,
        title: sectionTitle,
        content: "<p></p>",
        images: [],
        imageLayout: { imagesPerRow: 2, imageSize: 'medium' },
        titleColor: "#000000", // Default to black
        startOnNewPage: false // Default to false
      }
    ]);
    
    // Force a state update to ensure UI is in sync
    setTimeout(() => {
      setSections(current => [...current]);
    }, 0);
  };

  const removeSection = async (id: number) => {
    const section = sections.find(s => s.id === id);
    if (section) {
      // Remove all images in the section from storage
      await Promise.all(section.images.map(img => removeStoredImage(img.id)));
    }
    setSections((prev) => prev.filter((section) => section.id !== id));
  };

  const moveSectionUp = (id: number) => {
    setSections((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      if (index <= 0) return prev;
      const newSections = [...prev];
      const temp = newSections[index];
      newSections[index] = newSections[index - 1];
      newSections[index - 1] = temp;
      return newSections;
    });
  };

  const moveSectionDown = (id: number) => {
    setSections((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      if (index === -1 || index === prev.length - 1) return prev;
      const newSections = [...prev];
      const temp = newSections[index];
      newSections[index] = newSections[index + 1];
      newSections[index + 1] = temp;
      return newSections;
    });
  };

  // ------------------
  // IMAGE HANDLING
  // ------------------

  const handleImageRotate = async (
    sectionId: number,
    imageId: string,
    direction: 'left' | 'right'
  ) => {
    const updatedSections = await Promise.all(
      sections.map(async (section) => {
        if (section.id !== sectionId) return section;

        const updatedImages = await Promise.all(
          section.images.map(async (img) => {
            if (img.id !== imageId) return img;

            const degrees = direction === 'right' ? 90 : -90;
            const rotated = await rotateImage(img.url, degrees);
            
            // Store rotated image
            await storeImage(
              img.id,
              rotated.url,
              rotated.width,
              rotated.height,
              rotated.size
            );
            
            return {
              ...img,
              url: rotated.url,
              rotation: (img.rotation + degrees) % 360,
            };
          })
        );

        return {
          ...section,
          images: updatedImages,
        };
      })
    );

    setSections(updatedSections);
  };

  // Process uploaded image with size optimization
  const processUploadedImage = async (
    file: File
  ): Promise<{ url: string; needsProcessing: boolean }> => {
    try {
      // First process for display
      const displayResult = await processImage(file, {
        maxDimension: 2000,
        quality: 0.8,
        format: 'jpeg'
      });

      // Generate unique ID for the image
      const imageId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;

      // Store optimized version
      const storageResult = await processImage(displayResult.url, {
        maxDimension: 1200,
        quality: 0.7,
        format: 'jpeg'
      });

      // Store in IndexedDB
      await storeImage(
        imageId,
        storageResult.url,
        storageResult.width,
        storageResult.height,
        storageResult.size
      );

      return {
        url: displayResult.url,
        needsProcessing: false
      };
    } catch (error) {
      console.error('Error processing image:', error);
      throw error;
    }
  };

  const handleImageUpload = async (
    sectionId: number,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessingImage(true);

    const { url, needsProcessing } = await processUploadedImage(file);
    const newImage: ImageItem = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      file,
      url,
      caption: "",
      needsProcessing,
      rotation: 0,
    };

    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, images: [...section.images, newImage] }
          : section
      )
    );
    setProcessingImage(false);
  };

  // Helper function to convert Data URL to Blob
  const dataURLtoBlob = (dataURL: string): Blob => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, sectionId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    setProcessingImage(true);

    const processedImages: ImageItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const { url, needsProcessing } = await processUploadedImage(file);
      processedImages.push({
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        file,
        url,
        caption: "",
        needsProcessing,
        rotation: 0,
      });
    }

    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, images: [...section.images, ...processedImages] }
          : section
      )
    );
    setProcessingImage(false);
  };

  const removeImage = async (sectionId: number, imageId: string) => {
    // Remove from storage
    await removeStoredImage(imageId);
    
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              images: section.images.filter((img) => img.id !== imageId),
            }
          : section
      )
    );
  };

  const handleCaptionChange = (
    sectionId: number,
    imageId: string,
    caption: string
  ) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              images: section.images.map((img) =>
                img.id === imageId ? { ...img, caption } : img
              )
            }
          : section
      )
    );
  };

  const preventDefault = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // ------------------
  // IMAGE LAYOUT
  // ------------------
  const updateImageLayout = (sectionId: number, imagesPerRow: 1 | 2 | 3) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, imageLayout: { ...section.imageLayout, imagesPerRow } }
          : section
      )
    );
  };

  const updateImageSize = (sectionId: number, size: ImageSize) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, imageLayout: { ...section.imageLayout, imageSize: size } }
          : section
      )
    );
  };

  // ------------------
  // HTML CLEANUP & PARSING
  // ------------------

  /**
   * Pre-clean raw HTML to remove unwanted tags.
   * Note: We are now preserving multiple <br> tags and newlines.
   */
  const cleanPastedHtml = (rawHtml: string): string => {
    let cleaned = rawHtml;
    // Remove leftover MS Word style comments or tags if needed
    cleaned = cleaned.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, "");
    return cleaned;
  };

  /**
   * parseHtml() - Convert the HTML string to a structured array describing
   * each text segment and its styles.
   */
  const parseHtml = (html: string): { text: string; style: any }[] => {
    const cleanedHtml = cleanPastedHtml(html);
    const div = document.createElement("div");
    div.innerHTML = cleanedHtml;

    const result: { text: string; style: any }[] = [];

    const processNode = (
      node: Node,
      currentStyle: any = {},
      nestLevel: number = 0
    ) => {
      if (node.nodeType === Node.TEXT_NODE) {
        // Push even if the text is just a newline so that vertical spacing is preserved.
        if (node.textContent != null) {
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

        // Basic inline styling checks
        if (element.style) {
          if (element.style.color) newStyle.color = element.style.color;
          if (element.style.fontSize) {
            newStyle.fontSize = parseInt(element.style.fontSize, 10);
          }
          if (element.style.lineHeight) {
            newStyle.lineHeight = parseFloat(element.style.lineHeight);
          }
        }

        // Tag-based styling
        switch (element.tagName.toLowerCase()) {
          case "b":
          case "strong":
            newStyle.isBold = true;
            break;
          case "i":
          case "em":
            newStyle.isItalic = true;
            break;
          case "u":
            newStyle.isUnderline = true;
            break;
          case "p":
          case "div":
            // Detect bullet-like or dash characters at start
            const textContentTrimmed = element.textContent?.trimStart();
            if (textContentTrimmed?.match(/^([•○■])/)) { // Existing bullet check
              newStyle.list = "bullet";
              newStyle.isListItem = true;
              element.textContent = textContentTrimmed.replace(/^(\s*[•○■]+)/, "");
            } else if (textContentTrimmed?.match(/^(\-)/)) { // New dash check
              newStyle.list = "dash";
              newStyle.isListItem = true;
              element.textContent = textContentTrimmed.replace(/^(\s*\-+)/, "");
            }
            if (element.style.textAlign) {
              newStyle.align = element.style.textAlign;
            }
            break;
          case "ul":
            newStyle.list = "bullet"; // Default for UL
            newNestLevel += 1;
            break;
          case "ol":
            newStyle.list = "ordered";
            newNestLevel += 1;
            break;
          case "li":
            newStyle.isListItem = true;
            // Use the list style inherited from parent (ul/ol) or detect standalone
            if (!newStyle.list) { // If not already set by ul/ol
                const liTextContentTrimmed = element.textContent?.trimStart();
                if (liTextContentTrimmed?.match(/^([•○■])/)) {
                    newStyle.list = "bullet";
                    element.textContent = liTextContentTrimmed.replace(/^(\s*[•○■]+)/, "");
                } else if (liTextContentTrimmed?.match(/^(\-)/)) {
                    newStyle.list = "dash";
                    element.textContent = liTextContentTrimmed.replace(/^(\s*\-+)/, "");
                } else {
                    // Default to bullet if standalone li doesn't match others
                    newStyle.list = "bullet";
                }
            }
            newStyle.nestLevel = newNestLevel; // Set nest level correctly
            break;
          case "br":
            // Explicit line break – push a newline item.
            result.push({
              text: "\n",
              style: { ...newStyle, nestLevel }
            });
            break;
          case "h1":
            newStyle.isHeading = true;
            newStyle.headingLevel = 1;
            break;
          case "h2":
            newStyle.isHeading = true;
            newStyle.headingLevel = 2;
            break;
          case "h3":
            newStyle.isHeading = true;
            newStyle.headingLevel = 3;
            break;
        }

        // Process child nodes
        for (const childNode of Array.from(element.childNodes)) {
          processNode(childNode, newStyle, newNestLevel);
        }
      }
    };

    // Process top-level children
    for (const childNode of Array.from(div.childNodes)) {
      processNode(childNode, {}, 0);
    }

    return result;
  };

  /**
   * sanitizeTextForPDF - Additional text sanitization.
   * Modified here to avoid replacing multiple newlines so vertical spacing is preserved.
   */
  const sanitizeTextForPDF = (text: string): string => {
    if (!text) return "";
    let sanitized = text
      .replace(/[%Ë]/g, "")
      .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "")
      .replace(/\r\n/g, "\n")
      // Removed the newline reduction to preserve vertical spacing:
      // .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ");
    return sanitized;
  };

  // Helper function to get rotated image data URL using canvas
  const getRotatedImage = async (
    image: ImageItem
  ): Promise<{ url: string; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement("img");
      img.src = image.url;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(new Error("Canvas context not available"));
        }

        const rad = (image.rotation * Math.PI) / 180;
        const absRad = Math.abs(rad);

        // Calculate canvas size based on rotation
        // For 90/270 degrees, swap width and height
        const isSwapped = image.rotation % 180 !== 0;
        const originalWidth = img.width;
        const originalHeight = img.height;

        const canvasWidth = isSwapped ? originalHeight : originalWidth;
        const canvasHeight = isSwapped ? originalWidth : originalHeight;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Draw white background first to handle transparency
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Translate and rotate context
        ctx.translate(canvasWidth / 2, canvasHeight / 2);
        ctx.rotate(rad);

        // Draw the image centered in the rotated context
        ctx.drawImage(
          img,
          -originalWidth / 2,
          -originalHeight / 2,
          originalWidth,
          originalHeight
        );

        // Convert to JPEG
        const rotatedUrl = canvas.toDataURL("image/jpeg", 0.8);
        resolve({ url: rotatedUrl, width: canvasWidth, height: canvasHeight });
      };
      img.onerror = (err) => {
        console.error("Error loading image for rotation:", err);
        // Fallback: return original URL and dimensions if loading fails
        resolve({ url: image.url, width: img.width || 100, height: img.height || 100 }); 
      };
    });
  };

  // Add this new function for handling image cropping
  const handleImageCrop = (sectionId: number, imageId: string, imageUrl: string) => {
    setCroppingImage({ sectionId, imageId, url: imageUrl });
  };

  const handleCropComplete = (croppedImageUrl: string) => {
    if (!croppingImage) return;

    setSections((prev) =>
      prev.map((section) =>
        section.id === croppingImage.sectionId
          ? {
              ...section,
              images: section.images.map((img) =>
                img.id === croppingImage.imageId
                  ? { ...img, url: croppedImageUrl }
                  : img
              ),
            }
          : section
      )
    );
    setCroppingImage(null);
  };

  // ------------------
  // PDF GENERATION
  // ------------------

  const generatePDF = async () => {
    if (!reportRef.current) return;

    try {
      // Show loading toast with better mobile visibility
      const loadingToast = document.createElement("div");
      loadingToast.innerText = "Generating PDF, please wait...";
      loadingToast.className = "fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm sm:text-base";
      document.body.appendChild(loadingToast);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const SPACING = {
        MARGIN: 10,
        TITLE_AFTER: 8,
        DATE_AFTER: 6,
        SECTION_TITLE_AFTER: 4,
        PARAGRAPH: 6,
        HEADING: 6,
        LIST_ITEM: 6,
        IMAGE_GAP: 3,
        SECTION_AFTER: 5
      };

      let y = SPACING.MARGIN + 5;
      let currentPage = 1;

      const addNewPage = () => {
        pdf.addPage();
        currentPage++;
        y = SPACING.MARGIN + 5;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`${currentPage}`, pdfWidth / 2, pdfHeight - 10, {
          align: "center"
        });
      };

      const checkForNewPage = (heightNeeded: number): boolean => {
        if (y + heightNeeded > pdfHeight - SPACING.MARGIN - 10) {
          addNewPage();
          return true;
        }
        return false;
      };

      // Title + Date
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      const titleColor = hexToRgb(reportTitleColor);
      pdf.setTextColor(titleColor.r, titleColor.g, titleColor.b);
      const sanitizedTitle = sanitizeTextForPDF(reportTitle);
      pdf.text(sanitizedTitle, pdfWidth / 2, y, { align: "center" });
      y += SPACING.TITLE_AFTER;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(100, 100, 100);
      const dateText = getDateRangeText();
      pdf.text(dateText, pdfWidth / 2, y, { align: "center" });
      y += SPACING.DATE_AFTER;

      // Process Sections
      for (const section of sections) {
        // Check if section should start on new page
        if (section.startOnNewPage && y > SPACING.MARGIN + 5) {
          addNewPage();
        } else {
          checkForNewPage(20);
        }
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        const sectionColor = hexToRgb(section.titleColor || reportTitleColor);
        pdf.setTextColor(sectionColor.r, sectionColor.g, sectionColor.b);
        const sanitizedSectionTitle = sanitizeTextForPDF(section.title);
        pdf.text(sanitizedSectionTitle, SPACING.MARGIN, y);
        y += SPACING.SECTION_TITLE_AFTER + 5;

        // Content
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.setTextColor(40, 40, 40);

        const contentItems = parseHtml(section.content);
        let listCounters: { [key: number]: number } = {}; // Store counters for nested ordered lists

        for (const item of contentItems) {
          // If it's an explicit line break
          if (item.text === "\n") {
            y += pdf.getFontSize() * 0.5;
            continue;
          }

          checkForNewPage(6);

          let text = sanitizeTextForPDF(item.text);

          // Reset deeper list counters when a shallower list item is encountered
          const currentNestLevel = item.style.nestLevel || 0;
          for (const level in listCounters) {
            if (parseInt(level) > currentNestLevel) {
              delete listCounters[parseInt(level)];
            }
          }

          // Increment list counter if it's an ordered list item
          if (item.style.list === "ordered" && item.style.isListItem) {
            listCounters[currentNestLevel] = (listCounters[currentNestLevel] || 0) + 1;
          }

          // Setup style
          if (item.style.isHeading) {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(12);
          } else if (item.style.isBold && item.style.isItalic) {
            pdf.setFont("helvetica", "bolditalic");
            pdf.setFontSize(item.style.fontSize || 11);
          } else if (item.style.isBold) {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(item.style.fontSize || 11);
          } else if (item.style.isItalic) {
            pdf.setFont("helvetica", "italic");
            pdf.setFontSize(item.style.fontSize || 11);
          } else {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(item.style.fontSize || 11);
          }

          // Text alignment
          let xPos = SPACING.MARGIN;
          const textOptions: any = {};
          if (item.style.align === "center") {
            xPos = pdfWidth / 2;
            textOptions.align = "center";
          } else if (item.style.align === "right") {
            xPos = pdfWidth - SPACING.MARGIN;
            textOptions.align = "right";
          }

          // If it's a list item, handle bullet or numbering
          if (item.style.isListItem) {
            const nestIndent = (item.style.nestLevel || 0) * 4 + SPACING.MARGIN;
            let listMarker = "";
            if (item.style.list === "bullet") {
              listMarker = "•";
              xPos = nestIndent + 5;
            } else if (item.style.list === "dash") { // Handle new dash list
              listMarker = "-";
              xPos = nestIndent + 5;
            } else if (item.style.list === "ordered") { // Fix ordered list numbering
              const counter = listCounters[currentNestLevel] || 1;
              listMarker = `${counter}.`;
              xPos = nestIndent + 5 + (listMarker.length * 1); // Adjust xPos based on number length
            }
            pdf.text(listMarker, nestIndent, y);
          }

          const availableWidth =
            item.style.isListItem &&
            (item.style.list === "bullet" || item.style.list === "ordered")
              ? pdfWidth - xPos - SPACING.MARGIN
              : pdfWidth - 2 * SPACING.MARGIN;

          const lines = pdf.splitTextToSize(text, availableWidth);
          pdf.text(lines[0], xPos, y, textOptions);

          if (lines.length > 1) {
            const lineSpacing = item.style.lineHeight
              ? item.style.lineHeight * pdf.getFontSize() * 0.4
              : pdf.getFontSize() * 0.5;

            for (let i = 1; i < lines.length; i++) {
              y += lineSpacing;
              checkForNewPage(lineSpacing + 5);
              pdf.text(lines[i], xPos, y, textOptions);
            }
          }

          if (item.style.isHeading) {
            y += SPACING.HEADING;
          } else if (item.style.isListItem) {
            y += SPACING.LIST_ITEM;
          } else {
            y += SPACING.PARAGRAPH;
          }
        }

        // Images in this section
        if (section.images.length > 0) {
          const imagesPerRow = section.imageLayout.imagesPerRow;
          const rows = Math.ceil(section.images.length / imagesPerRow);

          for (let row = 0; row < rows; row++) {
            const startIdx = row * imagesPerRow;
            const endIdx = Math.min(
              startIdx + imagesPerRow,
              section.images.length
            );
            const rowImages = section.images.slice(startIdx, endIdx);

            const imageSpacing = SPACING.IMAGE_GAP;
            const totalRowSpacing = (rowImages.length - 1) * imageSpacing;
            const availableWidthForRow = pdfWidth - (SPACING.MARGIN * 2);

            // Define target heights based on layout and size
            const targetRowHeight = 
              imagesPerRow === 1 
                ? section.imageLayout.imageSize === 'small' 
                  ? 80 
                  : section.imageLayout.imageSize === 'medium'
                    ? 110
                    : 140
                : imagesPerRow === 2
                  ? section.imageLayout.imageSize === 'small'
                    ? 60
                    : section.imageLayout.imageSize === 'medium'
                      ? 90
                      : 120
                  : section.imageLayout.imageSize === 'small'
                    ? 40
                    : section.imageLayout.imageSize === 'medium'
                      ? 70
                      : 100;

            // Check for page break before processing the row
            if (checkForNewPage(targetRowHeight + 20)) { /* Add buffer for captions */ }

            // Pre-calculate dimensions and gather data for the row
            const processedRowData = [];
            let maxCaptionHeight = 0;
            const maxWidthPerImage = (availableWidthForRow - totalRowSpacing) / imagesPerRow;

            // First pass: collect all rotated dimensions
            const rowImageDimensions = [];
            for (const image of rowImages) {
              try {
                const { url: rotatedUrl, width: rotatedWidth, height: rotatedHeight } = await getRotatedImage(image);
                if (!rotatedWidth || !rotatedHeight) {
                  console.error("Skipping image due to missing dimensions after rotation:", image.id);
                  continue;
                }
                rowImageDimensions.push({ rotatedUrl, rotatedWidth, rotatedHeight, aspectRatio: rotatedWidth / rotatedHeight });
              } catch (err) {
                console.error("Error getting rotated dimensions:", err);
                rowImageDimensions.push(null);
              }
            }

            // For 3-column layout, calculate the reference height
            let referenceHeight = targetRowHeight;
            if (imagesPerRow === 3) {
              // Calculate heights if each image was scaled to maxWidthPerImage
              const scaledHeights = rowImageDimensions
                .filter(dim => dim !== null)
                .map(dim => maxWidthPerImage / dim.aspectRatio);
              
              // Use the smallest height as reference
              if (scaledHeights.length > 0) {
                referenceHeight = Math.min(...scaledHeights);
                // Ensure minimum height of 40mm and maximum of 100mm
                referenceHeight = Math.max(40, Math.min(100, referenceHeight));
              }
            }

            // Second pass: process images with normalized dimensions
            for (let i = 0; i < rowImageDimensions.length; i++) {
              const dimensions = rowImageDimensions[i];
              const currentImage = rowImages[i];
              
              if (!dimensions) {
                processedRowData.push(null);
                continue;
              }

              const { rotatedUrl, aspectRatio } = dimensions;
              let finalWidth = 0;
              let finalHeight = 0;

              if (imagesPerRow === 3) {
                // Use reference height and calculate width based on aspect ratio
                finalHeight = referenceHeight;
                finalWidth = referenceHeight * aspectRatio;
                
                // If width exceeds maxWidthPerImage, scale down proportionally
                if (finalWidth > maxWidthPerImage) {
                  finalWidth = maxWidthPerImage;
                  finalHeight = maxWidthPerImage / aspectRatio;
                }
              } else {
                // For 1 and 2 column layouts, maintain existing logic
                let initialWidth = targetRowHeight * aspectRatio;
                if (initialWidth <= maxWidthPerImage) {
                  finalHeight = targetRowHeight;
                  finalWidth = initialWidth;
                } else {
                  finalWidth = maxWidthPerImage;
                  finalHeight = finalWidth / aspectRatio;
                }
              }

              // Calculate caption lines and height for this image
              let currentCaptionHeight = 0;
              let captionLines: string[] = [];
              if (currentImage && currentImage.caption && currentImage.caption.trim()) {
                pdf.setFont("helvetica", "italic");
                pdf.setFontSize(9);
                captionLines = pdf.splitTextToSize(currentImage.caption.trim(), finalWidth);
                currentCaptionHeight = (captionLines.length * 5) + 4;
                maxCaptionHeight = Math.max(maxCaptionHeight, currentCaptionHeight);
              }

              processedRowData.push({
                rotatedUrl,
                finalWidth,
                finalHeight,
                captionLines,
                captionHeight: currentCaptionHeight
              });
            }

            // Calculate total width of processed images
            const actualTotalRowWidth = processedRowData.reduce((sum, data) => {
              return sum + (data ? data.finalWidth : 0);
            }, 0) + totalRowSpacing;

            // Center the row horizontally
            let currentX = (pdfWidth - actualTotalRowWidth) / 2;

            // Draw the row (Images and Captions)
            const startY = y;
            for (const data of processedRowData) {
              if (!data) continue;

              try {
                // Draw Image
                pdf.addImage(
                  data.rotatedUrl,
                  "JPEG",
                  currentX,
                  startY,
                  data.finalWidth,
                  data.finalHeight
                );

                // Draw Caption
                if (data.captionLines.length > 0) {
                  pdf.setFont("helvetica", "italic");
                  pdf.setFontSize(9);
                  pdf.setTextColor(100, 100, 100);
                  const captionStartY = startY + data.finalHeight + 4;
                  data.captionLines.forEach((line: string, index: number) => {
                    pdf.text(
                      line,
                      currentX + data.finalWidth / 2,
                      captionStartY + (index * 5),
                      { align: "center" }
                    );
                  });
                }

                currentX += data.finalWidth + imageSpacing;

              } catch(err) {
                console.error("Error drawing image/caption in PDF:", err);
              }
            }

            // Update Y position for next row
            y = startY + targetRowHeight + maxCaptionHeight + SPACING.IMAGE_GAP;
          }
        }
        y += SPACING.SECTION_AFTER;
      }

      // Add page number to the first page
      pdf.setPage(1);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`${currentPage}`, pdfWidth / 2, pdfHeight - 10, {
        align: "center"
      });

      // Save with report name
      const finalReportName = useDateInName ? previewReportName : reportName;
      const sanitizedFileName = finalReportName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      
      // Check if we're on a mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        // For mobile devices, use a more direct download approach
        const pdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `${sanitizedFileName}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(pdfUrl);
        
        // Show success message
        loadingToast.innerText = "PDF downloaded! Check your downloads folder.";
        loadingToast.className = "fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm sm:text-base";
        setTimeout(() => {
          loadingToast.remove();
        }, 3000);
      } else {
        // For desktop, use the regular save method
        pdf.save(`${sanitizedFileName}.pdf`);
        loadingToast.remove();
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      const errorToast = document.createElement("div");
      errorToast.innerText = "Error generating PDF. Please try again.";
      errorToast.className = "fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm sm:text-base";
      document.body.appendChild(errorToast);
      setTimeout(() => {
        errorToast.remove();
      }, 3000);
    }
  };

  // Add this helper function for color conversion
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 26, g: 54, b: 93 }; // Default to deep blue if invalid hex
  };

  // Load optimized images when initializing
  useEffect(() => {
    const loadOptimizedImages = async () => {
      if (!isInitialized || !sections.length) return;

      const updatedSections = await Promise.all(
        sections.map(async (section) => {
          const optimizedImages = await Promise.all(
            section.images.map(async (img) => {
              if (img.needsProcessing) {
                try {
                  // Get dimensions from the original image
                  const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
                    const image = new window.Image();
                    image.onload = () => {
                      resolve({
                        width: image.width,
                        height: image.height
                      });
                    };
                    image.src = img.url;
                  });

                  const optimized = await optimizeForStorage(img.url);
                  const size = calculateImageSize(optimized);
                  
                  await storeImage(
                    img.id,
                    optimized,
                    dimensions.width,
                    dimensions.height,
                    size
                  );
                  
                  return { ...img, url: optimized, needsProcessing: false };
                } catch (error) {
                  console.error('Error optimizing image:', error);
                  return img;
                }
              }
              return img;
            })
          );

          return {
            ...section,
            images: optimizedImages,
          };
        })
      );

      setSections(updatedSections);
    };

    loadOptimizedImages();
  }, [isInitialized]);

  // Add this new function for PDF preview
  const generatePDFPreview = async () => {
    if (!reportRef.current) return;

    try {
      const loadingToast = document.createElement("div");
      loadingToast.innerText = "Generating PDF preview...";
      loadingToast.className = "fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50";
      document.body.appendChild(loadingToast);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true
      });

      // Reuse the same PDF generation logic from generatePDF
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const SPACING = {
        MARGIN: 10,
        TITLE_AFTER: 8,
        DATE_AFTER: 6,
        SECTION_TITLE_AFTER: 4,
        PARAGRAPH: 6,
        HEADING: 6,
        LIST_ITEM: 6,
        IMAGE_GAP: 3,
        SECTION_AFTER: 5
      };

      let y = SPACING.MARGIN + 5;
      let currentPage = 1;

      const addNewPage = () => {
        pdf.addPage();
        currentPage++;
        y = SPACING.MARGIN + 5;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`${currentPage}`, pdfWidth / 2, pdfHeight - 10, {
          align: "center"
        });
      };

      const checkForNewPage = (heightNeeded: number): boolean => {
        if (y + heightNeeded > pdfHeight - SPACING.MARGIN - 10) {
          addNewPage();
          return true;
        }
        return false;
      };

      // Title + Date
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      const titleColor = hexToRgb(reportTitleColor);
      pdf.setTextColor(titleColor.r, titleColor.g, titleColor.b);
      const sanitizedTitle = sanitizeTextForPDF(reportTitle);
      pdf.text(sanitizedTitle, pdfWidth / 2, y, { align: "center" });
      y += SPACING.TITLE_AFTER;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(100, 100, 100);
      const dateText = getDateRangeText();
      pdf.text(dateText, pdfWidth / 2, y, { align: "center" });
      y += SPACING.DATE_AFTER;

      // Process Sections
      for (const section of sections) {
        // Check if section should start on new page
        if (section.startOnNewPage && y > SPACING.MARGIN + 5) {
          addNewPage();
        } else {
          checkForNewPage(20);
        }
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        const sectionColor = hexToRgb(section.titleColor || reportTitleColor);
        pdf.setTextColor(sectionColor.r, sectionColor.g, sectionColor.b);
        const sanitizedSectionTitle = sanitizeTextForPDF(section.title);
        pdf.text(sanitizedSectionTitle, SPACING.MARGIN, y);
        y += SPACING.SECTION_TITLE_AFTER + 5;

        // Content
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.setTextColor(40, 40, 40);

        const contentItems = parseHtml(section.content);
        let listCounters: { [key: number]: number } = {};

        for (const item of contentItems) {
          if (item.text === "\n") {
            y += pdf.getFontSize() * 0.5;
            continue;
          }

          checkForNewPage(6);

          let text = sanitizeTextForPDF(item.text);

          const currentNestLevel = item.style.nestLevel || 0;
          for (const level in listCounters) {
            if (parseInt(level) > currentNestLevel) {
              delete listCounters[parseInt(level)];
            }
          }

          if (item.style.list === "ordered" && item.style.isListItem) {
            listCounters[currentNestLevel] = (listCounters[currentNestLevel] || 0) + 1;
          }

          if (item.style.isHeading) {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(12);
          } else if (item.style.isBold && item.style.isItalic) {
            pdf.setFont("helvetica", "bolditalic");
            pdf.setFontSize(item.style.fontSize || 11);
          } else if (item.style.isBold) {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(item.style.fontSize || 11);
          } else if (item.style.isItalic) {
            pdf.setFont("helvetica", "italic");
            pdf.setFontSize(item.style.fontSize || 11);
          } else {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(item.style.fontSize || 11);
          }

          let xPos = SPACING.MARGIN;
          const textOptions: any = {};
          if (item.style.align === "center") {
            xPos = pdfWidth / 2;
            textOptions.align = "center";
          } else if (item.style.align === "right") {
            xPos = pdfWidth - SPACING.MARGIN;
            textOptions.align = "right";
          }

          if (item.style.isListItem) {
            const nestIndent = (item.style.nestLevel || 0) * 4 + SPACING.MARGIN;
            let listMarker = "";
            if (item.style.list === "bullet") {
              listMarker = "•";
              xPos = nestIndent + 5;
            } else if (item.style.list === "dash") {
              listMarker = "-";
              xPos = nestIndent + 5;
            } else if (item.style.list === "ordered") {
              const counter = listCounters[currentNestLevel] || 1;
              listMarker = `${counter}.`;
              xPos = nestIndent + 5 + (listMarker.length * 1);
            }
            pdf.text(listMarker, nestIndent, y);
          }

          const availableWidth =
            item.style.isListItem &&
            (item.style.list === "bullet" || item.style.list === "ordered")
              ? pdfWidth - xPos - SPACING.MARGIN
              : pdfWidth - 2 * SPACING.MARGIN;

          const lines = pdf.splitTextToSize(text, availableWidth);
          pdf.text(lines[0], xPos, y, textOptions);

          if (lines.length > 1) {
            const lineSpacing = item.style.lineHeight
              ? item.style.lineHeight * pdf.getFontSize() * 0.4
              : pdf.getFontSize() * 0.5;

            for (let i = 1; i < lines.length; i++) {
              y += lineSpacing;
              checkForNewPage(lineSpacing + 5);
              pdf.text(lines[i], xPos, y, textOptions);
            }
          }

          if (item.style.isHeading) {
            y += SPACING.HEADING;
          } else if (item.style.isListItem) {
            y += SPACING.LIST_ITEM;
          } else {
            y += SPACING.PARAGRAPH;
          }
        }

        // Images in this section
        if (section.images.length > 0) {
          const imagesPerRow = section.imageLayout.imagesPerRow;
          const rows = Math.ceil(section.images.length / imagesPerRow);

          for (let row = 0; row < rows; row++) {
            const startIdx = row * imagesPerRow;
            const endIdx = Math.min(
              startIdx + imagesPerRow,
              section.images.length
            );
            const rowImages = section.images.slice(startIdx, endIdx);

            const imageSpacing = SPACING.IMAGE_GAP;
            const totalRowSpacing = (rowImages.length - 1) * imageSpacing;
            const availableWidthForRow = pdfWidth - (SPACING.MARGIN * 2);

            const targetRowHeight = 
              imagesPerRow === 1 ? 110 :
              imagesPerRow === 2 ? 90 :
              70;

            if (checkForNewPage(targetRowHeight + 20)) { /* Add buffer for captions */ }

            const processedRowData = [];
            let maxCaptionHeight = 0;
            const maxWidthPerImage = (availableWidthForRow - totalRowSpacing) / imagesPerRow;

            for (const image of rowImages) {
              try {
                const { url: rotatedUrl, width: rotatedWidth, height: rotatedHeight } = await getRotatedImage(image);
                if (!rotatedWidth || !rotatedHeight) {
                  console.error("Skipping image due to missing dimensions after rotation:", image.id);
                  continue;
                }

                const aspectRatio = rotatedWidth / rotatedHeight;
                let finalWidth = maxWidthPerImage;
                let finalHeight = finalWidth / aspectRatio;

                if (finalHeight > targetRowHeight) {
                  finalHeight = targetRowHeight;
                  finalWidth = finalHeight * aspectRatio;
                }

                const captionLines = image.caption
                  ? pdf.splitTextToSize(sanitizeTextForPDF(image.caption), finalWidth)
                  : [];
                const currentCaptionHeight = captionLines.length * 5;
                maxCaptionHeight = Math.max(maxCaptionHeight, currentCaptionHeight);

                processedRowData.push({
                  rotatedUrl,
                  finalWidth,
                  finalHeight,
                  captionLines,
                  captionHeight: currentCaptionHeight
                });
              } catch (err) {
                console.error("Error processing image for PDF:", err);
                processedRowData.push(null);
              }
            }

            const actualTotalRowWidth = processedRowData.reduce((sum, data) => {
              return sum + (data ? data.finalWidth : 0);
            }, 0) + totalRowSpacing;

            let currentX = (pdfWidth - actualTotalRowWidth) / 2;

            const startY = y;
            for (const data of processedRowData) {
              if (!data) continue;

              try {
                pdf.addImage(
                  data.rotatedUrl,
                  "JPEG",
                  currentX,
                  startY,
                  data.finalWidth,
                  data.finalHeight
                );

                if (data.captionLines.length > 0) {
                  pdf.setFont("helvetica", "italic");
                  pdf.setFontSize(9);
                  pdf.setTextColor(100, 100, 100);
                  const captionStartY = startY + data.finalHeight + 4;
                  data.captionLines.forEach((line: string, index: number) => {
                    pdf.text(
                      line,
                      currentX + data.finalWidth / 2,
                      captionStartY + (index * 5),
                      { align: "center" }
                    );
                  });
                }

                currentX += data.finalWidth + imageSpacing;
              } catch(err) {
                console.error("Error drawing image/caption in PDF:", err);
              }
            }

            y = startY + targetRowHeight + maxCaptionHeight + SPACING.IMAGE_GAP;
          }
        }
        y += SPACING.SECTION_AFTER;
      }

      // Add page number to the first page
      pdf.setPage(1);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`${currentPage}`, pdfWidth / 2, pdfHeight - 10, {
        align: "center"
      });

      // Instead of saving, generate a preview URL
      const pdfBlob = pdf.output('blob');
      const previewUrl = URL.createObjectURL(pdfBlob);
      setPdfPreviewUrl(previewUrl);
      setShowPDFPreview(true);
      loadingToast.remove();
    } catch (error) {
      console.error("Error generating PDF preview:", error);
      const errorToast = document.createElement("div");
      errorToast.innerText = "Error generating PDF preview. Please try again.";
      errorToast.className = "fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50";
      document.body.appendChild(errorToast);
      setTimeout(() => {
        errorToast.remove();
      }, 3000);
    }
  };

  // Add cleanup effect
  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  // ... existing code ...

  // Add this before the return statement
  useEffect(() => {
    return () => {
      // Cleanup preview URL when component unmounts
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  // ... existing code ...

  // Add this in the JSX, before the closing </div> of the main container
  {showPDFPreview && pdfPreviewUrl && (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 max-w-4xl w-full mx-4 h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            PDF Preview
          </h3>
          <button
            onClick={() => {
              setShowPDFPreview(false);
              if (pdfPreviewUrl) {
                URL.revokeObjectURL(pdfPreviewUrl);
                setPdfPreviewUrl(null);
              }
            }}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <iframe
            src={pdfPreviewUrl}
            className="w-full h-full"
            title="PDF Preview"
          />
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={() => {
              setShowPDFPreview(false);
              if (pdfPreviewUrl) {
                URL.revokeObjectURL(pdfPreviewUrl);
                setPdfPreviewUrl(null);
              }
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md"
          >
            Close
          </button>
          <button
            onClick={generatePDF}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  )}

  // ... existing code ...

  // Replace the existing Save as PDF button with this
  <div className="flex gap-3">
    <button
      onClick={generatePDFPreview}
      className="flex items-center justify-center flex-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 font-medium py-2 px-3 rounded-md transition-all duration-200 hover:scale-[1.02] shadow-sm hover:shadow-md"
    >
      <FileText className="mr-1 h-4 w-4" />
      Preview PDF
    </button>
    <button
      onClick={generatePDF}
      className="flex items-center justify-center flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-md transition-all duration-200 hover:scale-[1.02] shadow-sm hover:shadow-md"
    >
      <Download className="mr-1 h-4 w-4" />
      Save as PDF
    </button>
  </div>
  // ... existing code ...

  const handleStartOnNewPageChange = (id: number, value: boolean) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, startOnNewPage: value } : section
      )
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Beta Version Banner */}
      <div className="bg-blue-600 text-white px-4 py-2">
        <div className="container mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-yellow-400 text-blue-800 text-xs font-bold px-2 py-1 rounded">BETA</span>
            <p className="text-sm">This is a beta version running in test mode. Some features may be experimental.</p>
          </div>
          <a 
            href="mailto:abdusattorovme@gmail.com" 
            className="text-xs text-blue-100 hover:text-white underline"
          >
            Send Feedback
          </a>
        </div>
      </div>

      {/* Name Prompt Modal */}
      {showNamePrompt && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Name Your Report
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Report Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={reportName}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setReportName(newName);
                    // Update preview immediately if using date in name
                    if (useDateInName && newName) {
                      const dateFormattedName = getDefaultReportName(reportStartDate, reportEndDate, newName);
                      setPreviewReportName(dateFormattedName);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
                  placeholder="Enter report name"
                  required
                />
                {!reportName.trim() && (
                  <p className="mt-1 text-sm text-red-500">Report name is required</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useDateInName"
                  checked={useDateInName}
                  onChange={(e) => setUseDateInName(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="useDateInName" className="text-sm text-gray-700 dark:text-gray-300">
                  Include date in report name
                </label>
              </div>

              {useDateInName && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-slate-700 rounded-md">
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date Range for Filename
                    </label>
                    <div className="flex gap-3 items-center">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 dark:text-gray-400">
                          From:
                        </label>
                        <input
                          type="date"
                          value={reportStartDate}
                          onChange={(e) => setReportStartDate(e.target.value)}
                          className="border border-gray-200 dark:border-gray-600 dark:bg-slate-800 dark:text-white rounded-md p-1 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 dark:text-gray-400">
                          To:
                        </label>
                        <input
                          type="date"
                          value={reportEndDate}
                          onChange={(e) => setReportEndDate(e.target.value)}
                          className="border border-gray-200 dark:border-gray-600 dark:bg-slate-800 dark:text-white rounded-md p-1 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Preview: </span>
                    {previewReportName || 'Enter a report name'}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowNamePrompt(false);
                    onClose();
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (reportName.trim()) {
                      setShowNamePrompt(false);
                      setIsInitialized(true);
                      if (useDateInName) {
                        setDateFieldsConfigured(true);
                      }
                      
                      // Make sure we save the report immediately to lock in the name
                      saveReport(true);
                      
                      // If there are any existing sections with default names, update them
                      if (sections.length > 0) {
                        const updatedSections = sections.map(section => {
                          if (section.title === "New Section" || section.title === "Summary") {
                            return { ...section, title: reportName };
                          }
                          return section;
                        });
                        setSections(updatedSections);
                      }
                    }
                  }}
                  disabled={!reportName.trim()}
                  className={`px-4 py-2 rounded-md ${
                    reportName.trim()
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Status Indicator */}
      {saveStatus.message && (
        <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-md shadow-lg transition-opacity duration-300 ${
          saveStatus.type === 'success' ? 'bg-green-500' :
          saveStatus.type === 'error' ? 'bg-red-500' :
          'bg-blue-500'
        } text-white`}>
          {saveStatus.message}
        </div>
      )}

      {processingImage && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span>Processing image...</span>
          </div>
        </div>
      )}

      {croppingImage && (
        <ImageCropper
          imageUrl={croppingImage.url}
          onCrop={handleCropComplete}
          onCancel={() => setCroppingImage(null)}
        />
      )}

      <main className="container mx-auto py-4 sm:py-8 px-2 sm:px-4 max-w-4xl">
        <div
          className="bg-white dark:bg-slate-800 shadow-sm rounded-lg p-3 sm:p-6 mb-4 sm:mb-6"
          ref={reportRef}
        >
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                Report Builder
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400">|</span>
                {isRenaming ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      onBlur={() => {
                        saveReport();
                        setIsRenaming(false);
                      }}
                      className="w-full sm:w-auto px-2 py-1 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      placeholder="Enter report name"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm sm:text-base text-gray-700 dark:text-gray-300">{reportName}</span>
                    <button
                      onClick={() => setIsRenaming(true)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Last saved: {lastSaved}
                </span>
                <button
                  onClick={() => saveReport()}
                  disabled={isSaving}
                  className={`p-1.5 sm:p-2 rounded-full transition-all duration-200 ${
                    isSaving 
                      ? 'bg-gray-100 dark:bg-slate-700 text-gray-400' 
                      : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 hover:scale-105'
                  }`}
                  title="Save report"
                >
                  <Save className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                {saveFeedback && (
                  <span className={`text-xs sm:text-sm ${
                    saveFeedback === "Saved!" 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    {saveFeedback}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 hover:scale-105 transition-all duration-200"
                title="Close report"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <button
                onClick={toggleTheme}
                className="p-1.5 sm:p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 hover:scale-105 transition-all duration-200"
                title={
                  theme === "light"
                    ? "Switch to dark mode"
                    : "Switch to light mode"
                }
              >
                {theme === "light" ? (
                  <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </button>
            </div>
          </div>

          <div className="mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="flex-1 p-2 border border-gray-200 dark:border-gray-700 dark:bg-slate-800 rounded-md text-lg sm:text-2xl font-bold"
                placeholder="Report Title"
                style={{ 
                  color: theme === 'dark' && reportTitleColor === '#000000' ? '#ffffff' : reportTitleColor
                }}
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  Title Color:
                </label>
                <div className="flex gap-1">
                  {TITLE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setReportTitleColor(color.value)}
                      className={`relative w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 transition-all duration-200 hover:scale-110 ${
                        reportTitleColor === color.value
                          ? 'border-blue-500 shadow-lg'
                          : 'border-gray-200 dark:border-gray-600'
                      }`}
                      style={{ backgroundColor: color.preview }}
                    >
                      {color.isDefault && (
                        <span className="absolute inset-0 flex items-center justify-center text-white">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 sm:h-3 sm:w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center justify-between mt-2">
              {(!useDateInName || !dateFieldsConfigured) && (
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400">
                      Start Date:
                    </label>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="border border-gray-200 dark:border-gray-700 dark:bg-slate-800 dark:text-white rounded-md p-1 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400">
                      End Date:
                    </label>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="border border-gray-200 dark:border-gray-700 dark:bg-slate-800 dark:text-white rounded-md p-1 text-sm"
                    />
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2 sm:gap-3">
                {(!useDateInName || !dateFieldsConfigured) && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="reportDateInName"
                      checked={useDateInName}
                      onChange={(e) => {
                        setUseDateInName(e.target.checked);
                        if (!e.target.checked) {
                          setDateFieldsConfigured(false);
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="reportDateInName" className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                      Include date in filename
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {sections.map((section) => (
            <div key={section.id} className="mb-6 pb-4 sm:pb-6 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-3">
                <div className="flex-1">
                  <div className="mb-4 relative">
                    <div className="flex items-center space-x-1 pdf-hide mb-2">
                      <button
                        onClick={() => moveSectionUp(section.id)}
                        className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                        title="Move section up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => moveSectionDown(section.id)}
                        className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                        title="Move section down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      {sections.length > 1 && (
                        <button
                          onClick={() => removeSection(section.id)}
                          className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                          title="Remove section"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      <div className="flex items-center ml-2">
                        <label className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                          Start on new page:
                        </label>
                        <input
                          type="checkbox"
                          checked={section.startOnNewPage || false}
                          onChange={(e) => handleStartOnNewPageChange(section.id, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => handleTitleChange(section.id, e.target.value)}
                        className="flex-1 p-2 border border-gray-200 dark:border-gray-700 dark:bg-slate-800 rounded-md text-base sm:text-lg font-semibold"
                        placeholder="Section title..."
                        style={{ 
                          color: theme === 'dark' && (section.titleColor || reportTitleColor) === '#000000' ? '#ffffff' : (section.titleColor || reportTitleColor)
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 dark:text-gray-400">
                          Title Color:
                        </label>
                        <div className="flex gap-1">
                          {TITLE_COLORS.map((color) => (
                            <button
                              key={color.value}
                              onClick={() => {
                                setSections(prev =>
                                  prev.map(s =>
                                    s.id === section.id
                                      ? { ...s, titleColor: color.value }
                                      : s
                                  )
                                );
                              }}
                              className={`relative w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 transition-all duration-200 hover:scale-110 ${
                                (section.titleColor || reportTitleColor) === color.value
                                  ? 'border-blue-500 shadow-lg'
                                  : 'border-gray-200 dark:border-gray-600'
                              }`}
                              style={{ backgroundColor: color.preview }}
                            >
                              {color.isDefault && (
                                <span className="absolute inset-0 flex items-center justify-center text-white">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 sm:h-3 sm:w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <RichTextEditor
                      content={section.content}
                      onChange={(content) => handleContentChange(section.id, content)}
                      placeholder="Write your content here..."
                    />
                  </div>
                </div>
              </div>

              {section.images.length === 0 && (
                <div
                  className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-md p-4 sm:p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 pdf-hide mb-3 bg-white dark:bg-slate-800"
                  style={{ minHeight: "120px" }}
                  onDragOver={preventDefault}
                  onDragEnter={preventDefault}
                  onDragLeave={preventDefault}
                  onDrop={(e) => handleDrop(e, section.id)}
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.setAttribute(
                        "data-section-id",
                        section.id.toString()
                      );
                      fileInputRef.current.click();
                    }
                  }}
                >
                  <Image className="h-8 w-8 sm:h-10 sm:w-10 text-gray-300 mb-2 sm:mb-3" />
                  <p className="text-xs sm:text-sm text-gray-500 mb-1">
                    Drop images here or click to upload
                  </p>
                  <p className="text-xs text-gray-400">
                    The images will appear in your report
                  </p>
                </div>
              )}

              {section.images.length > 0 && (
                <div className="pdf-hide mt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
                    <div>
                      <span className="text-xs text-gray-500 mr-2">
                        Image layout:
                      </span>
                      <div className="flex space-x-2 mt-1 sm:mt-0">
                        <button
                          type="button"
                          onClick={() => updateImageLayout(section.id, 1)}
                          className={`p-1.5 sm:p-2 rounded ${
                            section.imageLayout.imagesPerRow === 1
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                          }`}
                          title="Single image layout"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3 sm:h-4 sm:w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M2 4a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm2 0v12h12V4H4z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateImageLayout(section.id, 2)}
                          className={`p-1.5 sm:p-2 rounded ${
                            section.imageLayout.imagesPerRow === 2
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                          }`}
                          title="Two image layout"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3 sm:h-4 sm:w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M2 4a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm2 0v12h5V4H4zm7 0v12h5V4h-5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateImageLayout(section.id, 3)}
                          className={`p-1.5 sm:p-2 rounded ${
                            section.imageLayout.imagesPerRow === 3
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                          }`}
                          title="Three image layout"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3 sm:h-4 sm:w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M2 4a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm2 0v12h3V4H4zm4 0v12h3V4H8zm4 0v12h3V4h-3z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 sm:mt-0">
                      <span className="text-xs text-gray-500 mr-2">
                        Image size:
                      </span>
                      <div className="flex space-x-2 mt-1 sm:mt-0">
                        <button
                          type="button"
                          onClick={() => updateImageSize(section.id, 'small')}
                          className={`p-1.5 sm:p-2 rounded ${
                            section.imageLayout.imageSize === 'small'
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                          }`}
                          title="Small size"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3 sm:h-4 sm:w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <rect x="6" y="6" width="8" height="8" rx="1" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateImageSize(section.id, 'medium')}
                          className={`p-1.5 sm:p-2 rounded ${
                            section.imageLayout.imageSize === 'medium'
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                          }`}
                          title="Medium size"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3 sm:h-4 sm:w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <rect x="4" y="4" width="12" height="12" rx="1" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateImageSize(section.id, 'large')}
                          className={`p-1.5 sm:p-2 rounded ${
                            section.imageLayout.imageSize === 'large'
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                          }`}
                          title="Large size"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3 sm:h-4 sm:w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <rect x="2" y="2" width="16" height="16" rx="1" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Image Grid */}
                  <div className={
                    section.imageLayout.imagesPerRow === 1 
                      ? 'flex flex-col items-center gap-3' 
                      : section.imageLayout.imagesPerRow === 2 
                        ? section.images.length === 1 
                          ? 'flex justify-center' 
                          : 'grid grid-cols-1 sm:grid-cols-2 gap-3' 
                        : section.images.length === 1 
                          ? 'flex justify-center' 
                          : section.images.length === 2 
                            ? 'flex flex-col sm:flex-row justify-center gap-3 sm:gap-6 mx-auto' 
                            : 'grid grid-cols-1 sm:grid-cols-3 gap-3'
                  }>
                    {section.images.map((image) => (
                      <div key={image.id} className={`relative group ${
                        section.imageLayout.imagesPerRow > 1 && section.images.length === 1
                          ? 'max-w-md w-full'
                          : section.imageLayout.imagesPerRow === 3 && section.images.length === 2
                            ? 'max-w-xs w-full'
                            : 'w-full'
                      }`}>
                        <div 
                          className="aspect-[4/3] flex items-center justify-center overflow-hidden bg-white rounded-lg shadow-sm w-full"
                          style={{
                            width: "100%",
                            height: section.imageLayout.imagesPerRow === 1 
                              ? section.imageLayout.imageSize === 'small' 
                                ? "240px"
                                : section.imageLayout.imageSize === 'medium'
                                  ? "320px"
                                  : "400px"
                              : section.imageLayout.imagesPerRow === 2
                                ? section.imageLayout.imageSize === 'small'
                                  ? "180px"
                                  : section.imageLayout.imageSize === 'medium'
                                    ? "240px"
                                    : "300px"
                                : section.imageLayout.imageSize === 'small'
                                  ? "140px"
                                  : section.imageLayout.imageSize === 'medium'
                                    ? "180px"
                                    : "220px"
                          }}
                        >
                          <img
                            src={image.url}
                            alt={image.caption || 'Report image'}
                            className="max-w-full max-h-full object-contain mx-auto"
                            style={{
                              transform: `rotate(${image.rotation}deg)`,
                              maxHeight: section.imageLayout.imagesPerRow === 1 
                                ? section.imageLayout.imageSize === 'small'
                                  ? "220px"
                                  : section.imageLayout.imageSize === 'medium'
                                    ? "300px"
                                    : "380px"
                                : section.imageLayout.imagesPerRow === 2
                                  ? section.imageLayout.imageSize === 'small'
                                    ? "160px"
                                    : section.imageLayout.imageSize === 'medium'
                                      ? "220px"
                                      : "280px"
                                  : section.imageLayout.imageSize === 'small'
                                    ? "120px"
                                    : section.imageLayout.imageSize === 'medium'
                                      ? "160px"
                                      : "200px"
                            }}
                          />
                        </div>
                        {image.needsProcessing && (
                          <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded">
                            Needs processing
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
                          <div className="hidden group-hover:flex gap-2">
                            <button
                              onClick={() => handleImageRotate(section.id, image.id, 'right')}
                              className="p-1.5 sm:p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-slate-700 hover:scale-105 transition-all duration-200"
                              title="Rotate"
                            >
                              <RotateCw className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                            </button>
                            <button
                              onClick={() => handleImageCrop(section.id, image.id, image.url)}
                              className="p-1.5 sm:p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-slate-700 hover:scale-105 transition-all duration-200"
                              title="Crop image"
                            >
                              <Crop className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                            </button>
                            <button
                              onClick={() => removeImage(section.id, image.id)}
                              className="p-1.5 sm:p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:scale-105 transition-all duration-200"
                              title="Remove image"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                            </button>
                          </div>
                        </div>
                        <div className="relative mt-2 z-10">
                          <input
                            type="text"
                            value={image.caption}
                            onChange={(e) => handleCaptionChange(section.id, image.id, e.target.value)}
                            placeholder="Add caption..."
                            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-200 dark:border-gray-700 dark:bg-slate-800 dark:text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add more images button */}
                  <div 
                    className="mt-4 border-2 border-dashed border-gray-200 rounded-md p-3 sm:p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.setAttribute(
                          "data-section-id",
                          section.id.toString()
                        );
                        fileInputRef.current.click();
                      }
                    }}
                  >
                    <Plus className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">Add more images</p>
                  </div>
                </div>
              )}
            </div>
          ))}
          <button
            onClick={addSection}
            className="flex items-center justify-center w-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-300 font-medium py-2 px-3 rounded-md text-sm mb-4 transition-colors"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Section
          </button>

          <div className="flex gap-3">
            <button
              onClick={generatePDFPreview}
              className="flex items-center justify-center flex-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 font-medium py-2 px-3 rounded-md transition-all duration-200 hover:scale-[1.02] shadow-sm hover:shadow-md"
            >
              <FileText className="mr-1 h-4 w-4" />
              Preview PDF
            </button>
            <button
              onClick={generatePDF}
              className="flex items-center justify-center flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-md transition-all duration-200 hover:scale-[1.02] shadow-sm hover:shadow-md"
            >
              <Download className="mr-1 h-4 w-4" />
              Save as PDF
            </button>
          </div>
        </div>
      </main>

      {/* PDF Preview Modal */}
      {showPDFPreview && pdfPreviewUrl && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 max-w-4xl w-full mx-4 h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                PDF Preview
              </h3>
              <button
                onClick={() => {
                  setShowPDFPreview(false);
                  if (pdfPreviewUrl) {
                    URL.revokeObjectURL(pdfPreviewUrl);
                    setPdfPreviewUrl(null);
                  }
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-full"
                title="PDF Preview"
              />
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPDFPreview(false);
                  if (pdfPreviewUrl) {
                    URL.revokeObjectURL(pdfPreviewUrl);
                    setPdfPreviewUrl(null);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md"
              >
                Close
              </button>
              <button
                onClick={generatePDF}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for images */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const sectionId = parseInt(
            fileInputRef.current?.getAttribute("data-section-id") || "0"
          );
          handleImageUpload(sectionId, e);
        }}
      />
    </div>
  );
};

export default ReportBuilder;

