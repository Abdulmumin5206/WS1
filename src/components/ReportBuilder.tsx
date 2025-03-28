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
  Edit2
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
  content: string; // HTML content
  images: ImageItem[];
  imageLayout: {
    imagesPerRow: 1 | 2 | 3;
  };
}

interface ReportBuilderProps {
  initialData?: {
    title: string;
    startDate: string;
    endDate: string;
    sections: Section[];
    name?: string;
  };
  reportId?: string;
  onClose: () => void;
}

const ReportBuilder: React.FC<ReportBuilderProps> = ({ initialData, reportId, onClose }) => {
  const { theme, toggleTheme } = useTheme();

  // ------------------
  // STATE
  // ------------------
  const [reportName, setReportName] = useState<string>(initialData?.name || "");
  const [reportTitle, setReportTitle] = useState<string>(initialData?.title || "Weekly Report");
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
      imageLayout: { imagesPerRow: 2 }
    }]
  );
  const [processingImage, setProcessingImage] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string>("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempName, setTempName] = useState(reportName);
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

  // Save function
  const saveReport = async (forceSave: boolean = false) => {
    if (!reportName && !forceSave) return;

    try {
      setSaveStatus({
        isSaving: true,
        message: 'Saving...',
        type: ''
      });

      const reportSize = calculateReportSize(sections);

      // If we don't have a current report ID, generate a new one
      if (!currentReportIdRef.current) {
        currentReportIdRef.current = `report_${Date.now()}`;
      }

      const currentReport = {
        id: currentReportIdRef.current,
        name: reportName,
        title: reportTitle,
        lastModified: new Date().toISOString(),
        size: reportSize,
        content: {
          name: reportName,
          title: reportTitle,
          startDate: reportStartDate,
          endDate: reportEndDate,
          sections: sections,
        },
      };

      // Save using the existing or new ID
      await indexedDBService.saveReport(currentReport);

      setSaveStatus({
        isSaving: false,
        message: 'Saved',
        type: 'success'
      });

      // Clear save message after 2 seconds
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
    }
  };

  // Update the getDefaultReportName function
  const getDefaultReportName = (startDate: string, endDate: string, baseName: string) => {
    if (!baseName.trim()) return '';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startMonth = start.toLocaleString('default', { month: 'long' });
    const endMonth = end.toLocaleString('default', { month: 'long' });
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
    setSections((prev) => [
      ...prev,
      {
        id: newId,
        title: "New Section",
        content: "<p></p>",
        images: [],
        imageLayout: { imagesPerRow: 2 }
      }
    ]);
  };

  const removeSection = (id: number) => {
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
  // Process uploaded image with size optimization
  const processUploadedImage = async (
    file: File
  ): Promise<{ url: string; needsProcessing: boolean }> => {
    const initialUrl = URL.createObjectURL(file);
    try {
      // Optimize image size during upload
      const optimizedImage = await new Promise<{ url: string; size: number }>((resolve) => {
        const img = document.createElement("img");
        img.src = initialUrl;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // If image is larger than 2000px in any dimension, reduce it proportionally
          const maxDimension = 2000;
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
          const ctx = canvas.getContext("2d");
          
          if (ctx) {
            // Use better quality settings
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Draw image with white background (for transparent PNGs)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to JPEG with 0.8 quality (good balance between size and quality)
            const optimizedUrl = canvas.toDataURL('image/jpeg', 0.8);
            
            // Calculate size of optimized image
            const base64str = optimizedUrl.split(',')[1];
            const optimizedSize = Math.round((base64str.length * 3) / 4);

            resolve({ url: optimizedUrl, size: optimizedSize });
          } else {
            // Fallback to original file if canvas is not supported
            resolve({ url: initialUrl, size: file.size });
          }
        };
        img.onerror = () => resolve({ url: initialUrl, size: file.size });
      });

      return { url: optimizedImage.url, needsProcessing: false };
    } catch (error) {
      console.error("Error processing image:", error);
      return { url: initialUrl, needsProcessing: true };
    } finally {
      URL.revokeObjectURL(initialUrl);
    }
  };

  const handleImageUpload = async (
    sectionId: number,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setProcessingImage(true);

    const processedImages: ImageItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file size before processing
      const maxSizeMB = 10;
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`File ${file.name} is too large. Maximum size is ${maxSizeMB}MB`);
        continue;
      }

      const { url, needsProcessing } = await processUploadedImage(file);
      processedImages.push({
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        file: new File([dataURLtoBlob(url)], file.name, { type: 'image/jpeg' }),
        url,
        caption: "",
        needsProcessing
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
        needsProcessing
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

  const removeImage = (sectionId: number, imageId: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              images: section.images.filter((img) => img.id !== imageId)
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
            // Detect bullet-like characters at start
            if (
              element.textContent?.trimStart().match(/^([•\-○■])/)
            ) {
              newStyle.list = "bullet";
              newStyle.isListItem = true;
              element.textContent = element.textContent.replace(
                /^(\s*[•\-○■]+)/,
                ""
              );
            }
            if (element.style.textAlign) {
              newStyle.align = element.style.textAlign;
            }
            break;
          case "ul":
            newStyle.list = "bullet";
            newNestLevel += 1;
            break;
          case "ol":
            newStyle.list = "ordered";
            newNestLevel += 1;
            break;
          case "li":
            newStyle.isListItem = true;
            if (
              element.textContent?.trimStart().match(/^([•\-○■])/)
            ) {
              newStyle.list = "bullet";
              element.textContent = element.textContent.replace(
                /^(\s*[•\-○■]+)/,
                ""
              );
            }
            newStyle.nestLevel = newNestLevel;
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

  // ------------------
  // PDF GENERATION
  // ------------------

  const generatePDF = async () => {
    if (!reportRef.current) return;

    try {
      // Simple loading toast
      const loadingToast = document.createElement("div");
      loadingToast.innerText = "Generating PDF, please wait...";
      loadingToast.className =
        "fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50";
      document.body.appendChild(loadingToast);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Unified spacing constants
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
        // Page number
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

      // ----------------
      // Title + Date
      // ----------------
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.setTextColor(40, 40, 40);
      const sanitizedTitle = sanitizeTextForPDF(reportTitle);
      pdf.text(sanitizedTitle, pdfWidth / 2, y, { align: "center" });
      y += SPACING.TITLE_AFTER;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(100, 100, 100);
      const dateText = getDateRangeText();
      pdf.text(dateText, pdfWidth / 2, y, { align: "center" });
      y += SPACING.DATE_AFTER;

      // ----------------
      // Process Sections
      // ----------------
      for (const section of sections) {
        // Section Title
        checkForNewPage(20);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(60, 60, 60);
        pdf.text(sanitizeTextForPDF(section.title), SPACING.MARGIN, y);
        y += SPACING.SECTION_TITLE_AFTER + 5;

        // Content
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.setTextColor(40, 40, 40);

        const contentItems = parseHtml(section.content);

        for (const item of contentItems) {
          // If it's an explicit line break
          if (item.text === "\n") {
            y += pdf.getFontSize() * 0.5;
            continue;
          }

          checkForNewPage(6);

          let text = sanitizeTextForPDF(item.text);

          // Remove bullet characters if it's a list
          if (item.style.isListItem) {
            text = text.replace(/^[\s\u00A0]*[•\-\*\+○■⦿⚫⚬◉◆◇◈☙➤➢➣➔➝➜➛➙➞❯❱➝➞☛☞➤→]+[\s\u00A0]*/m, "");
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
            if (item.style.list === "bullet") {
              pdf.text("•", nestIndent, y);
              xPos = nestIndent + 5;
            } else if (item.style.list === "ordered") {
              pdf.text("-", nestIndent, y);
              xPos = nestIndent + 5;
            }
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
            const totalSpacing = (imagesPerRow - 1) * imageSpacing;
            const availableWidth = pdfWidth - totalSpacing;

            let singleImageWidth: number;
            let imageHeight: number;

            if (imagesPerRow === 1) {
              // For single images, use a larger portion of the available width
              singleImageWidth = Math.min(availableWidth * 0.9, 150);
              imageHeight = 85;
            } else if (imagesPerRow === 2) {
              singleImageWidth = Math.min(availableWidth / 2 - 6, 95);
              imageHeight = 65;
            } else {
              singleImageWidth = availableWidth / 3;
              imageHeight = 45;
            }

            if (checkForNewPage(imageHeight + 15)) {}

            let xPos = SPACING.MARGIN;
            // Center single images
            if (imagesPerRow === 1) {
              xPos = (pdfWidth - singleImageWidth) / 2;
            }

            for (let i = 0; i < rowImages.length; i++) {
              const image = rowImages[i];
              try {
                await new Promise<void>((resolve) => {
                  const imgObj = document.createElement("img");
                  imgObj.src = image.url;
                  imgObj.onload = () => {
                    try {
                      const aspectRatio = imgObj.width / imgObj.height;
                      let imgWidth = singleImageWidth;
                      let imgH = imgWidth / aspectRatio;

                      if (imgH > imageHeight) {
                        imgH = imageHeight;
                        imgWidth = imgH * aspectRatio;
                      }

                      // Recalculate xPos for centered single images after aspect ratio adjustment
                      if (imagesPerRow === 1) {
                        xPos = (pdfWidth - imgWidth) / 2;
                      }

                      // Draw white background
                      pdf.setFillColor(255, 255, 255);
                      pdf.rect(xPos, y, imgWidth, imgH, "F");

                      // Add the image directly without compression
                      pdf.addImage(
                        image.url,
                        "JPEG",
                        xPos,
                        y,
                        imgWidth,
                        imgH
                      );

                      // Only increment xPos for multi-image layouts
                      if (imagesPerRow > 1) {
                        xPos += imgWidth + imageSpacing;
                      }
                    } catch (err) {
                      console.error("Error adding image to PDF:", err);
                    }
                    resolve();
                  };
                  imgObj.onerror = () => {
                    console.error("Error loading image");
                    resolve();
                  };
                });
              } catch (err) {
                console.error("Error processing image for PDF:", err);
              }
            }
            y += imageHeight + SPACING.IMAGE_GAP + 5;
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
      const sanitizedFileName = reportName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      pdf.save(`${sanitizedFileName}.pdf`);
      loadingToast.remove();
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
    }
  };

  const handleRename = async () => {
    if (!tempName.trim() || !reportId) return;
    try {
      await indexedDBService.updateReportName(reportId, tempName.trim());
      setReportName(tempName.trim());
      setIsRenaming(false);
      toast.success('Report renamed successfully');
    } catch (error) {
      console.error('Error renaming report:', error);
      toast.error('Failed to rename report. Please try again.');
    }
  };

  // ------------------
  // RENDER
  // ------------------
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
            href="#" 
            className="text-xs text-blue-100 hover:text-white underline"
            onClick={(e) => {
              e.preventDefault();
              toast.success('Thank you for your interest! Feedback feature coming soon.');
            }}
          >
            Send Feedback
          </a>
        </div>
      </div>

      {/* Name Prompt Modal */}
      {showNamePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
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
                  onChange={(e) => {
                    setUseDateInName(e.target.checked);
                    if (e.target.checked && reportName.trim() && reportStartDate && reportEndDate) {
                      // Only add date when checkbox is checked
                      setReportName(getDefaultReportName(reportStartDate, reportEndDate, reportName));
                    } else if (!e.target.checked) {
                      // Remove date from name if unchecking
                      setReportName(reportName.split('_')[0] || '');
                    }
                  }}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="useDateInName" className="text-sm text-gray-700 dark:text-gray-300">
                  Include date range in file name
                </label>
              </div>

              {useDateInName && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => {
                        setReportStartDate(e.target.value);
                        if (reportName.trim()) {
                          setReportName(getDefaultReportName(e.target.value, reportEndDate, reportName.split('_')[0] || reportName));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => {
                        setReportEndDate(e.target.value);
                        if (reportName.trim()) {
                          setReportName(getDefaultReportName(reportStartDate, e.target.value, reportName.split('_')[0] || reportName));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {useDateInName && reportStartDate && reportEndDate && reportName.trim() && (
                <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700 p-3 rounded-md">
                  <p className="font-medium mb-1">File Name Preview:</p>
                  <p className="italic">
                    {getDefaultReportName(reportStartDate, reportEndDate, reportName.split('_')[0] || reportName)}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    if (reportName.trim()) {
                      setShowNamePrompt(false);
                      setIsInitialized(true);
                      saveReport(true);
                    }
                  }}
                  disabled={!reportName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Report
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

      <main className="container mx-auto py-8 px-4 max-w-4xl">
        <div
          className="bg-white dark:bg-slate-800 shadow-sm rounded-lg p-6 mb-6"
          ref={reportRef}
        >
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                Report Builder
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400">|</span>
                {isRenaming ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRename();
                        } else if (e.key === 'Escape') {
                          setIsRenaming(false);
                          setTempName(reportName);
                        }
                      }}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-slate-800 dark:text-white"
                      autoFocus
                    />
                    <button
                      onClick={handleRename}
                      className="p-1 text-green-600 hover:text-green-700"
                      title="Save name"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setIsRenaming(false);
                        setTempName(reportName);
                      }}
                      className="p-1 text-gray-500 hover:text-gray-700"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 dark:text-gray-300">
                      {reportName}
                    </span>
                    <button
                      onClick={() => setIsRenaming(true)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Rename report"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Last saved: {lastSaved}
                </span>
                <button
                  onClick={() => saveReport()}
                  disabled={isSaving}
                  className={`p-2 rounded-full transition-colors ${
                    isSaving 
                      ? 'bg-gray-100 dark:bg-slate-700 text-gray-400' 
                      : 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800'
                  }`}
                  title="Save report"
                >
                  <Save className="h-5 w-5" />
                </button>
                {saveFeedback && (
                  <span className={`text-sm ${
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
                className="p-2 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600"
                title="Close report"
              >
                <X className="h-5 w-5" />
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600"
                title={
                  theme === "light"
                    ? "Switch to dark mode"
                    : "Switch to light mode"
                }
              >
                {theme === "light" ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </button>
            </div>
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
          </div>

          {sections.map((section) => (
            <div key={section.id} className="mb-8 pb-6 border-b border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="mb-4 relative">
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
                      fileInputRef.current.setAttribute(
                        "data-section-id",
                        section.id.toString()
                      );
                      fileInputRef.current.click();
                    }
                  }}
                >
                  <Image className="h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 mb-1">
                    Drop images here or click to upload
                  </p>
                  <p className="text-xs text-gray-400">
                    The images will appear in your report
                  </p>
                </div>
              )}

              {section.images.length > 0 && (
                <div className="pdf-hide mt-2">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-xs text-gray-500 mr-2">
                        Image layout:
                      </span>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => updateImageLayout(section.id, 1)}
                          className={`p-2 rounded ${section.imageLayout.imagesPerRow === 1
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            }`}
                          title="Single image layout"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <rect x="3" y="6" width="14" height="8" rx="1" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateImageLayout(section.id, 2)}
                          className={`p-2 rounded ${section.imageLayout.imagesPerRow === 2
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            }`}
                          title="Two image layout"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <rect x="3" y="6" width="6.5" height="8" rx="1" />
                            <rect x="10.5" y="6" width="6.5" height="8" rx="1" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateImageLayout(section.id, 3)}
                          className={`p-2 rounded ${section.imageLayout.imagesPerRow === 3
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            }`}
                          title="Three image layout"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <rect x="3" y="6" width="4" height="8" rx="1" />
                            <rect x="8" y="6" width="4" height="8" rx="1" />
                            <rect x="13" y="6" width="4" height="8" rx="1" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Image Grid */}
                  <div className={`grid gap-4 ${
                    section.imageLayout.imagesPerRow === 1 
                      ? 'grid-cols-1' 
                      : section.imageLayout.imagesPerRow === 2 
                        ? 'grid-cols-2' 
                        : 'grid-cols-3'
                  }`}>
                    {section.images.map((image) => (
                      <div key={image.id} className="relative group">
                        <img
                          src={image.url}
                          alt={image.caption || 'Report image'}
                          className="w-full h-auto rounded-lg shadow-sm"
                        />
                        {image.needsProcessing && (
                          <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded">
                            Needs processing
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
                          <div className="hidden group-hover:flex gap-2">
                            <button
                              onClick={() => removeImage(section.id, image.id)}
                              className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                              title="Remove image"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </button>
                          </div>
                        </div>
                        <div className="relative mt-2 z-10">
                          <input
                            type="text"
                            value={image.caption}
                            onChange={(e) => handleCaptionChange(section.id, image.id, e.target.value)}
                            placeholder="Add caption..."
                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-slate-800 dark:text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add more images button */}
                  <div 
                    className="mt-4 border-2 border-dashed border-gray-200 rounded-md p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50"
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
                    <Plus className="h-6 w-6 text-gray-400" />
                    <p className="text-sm text-gray-500 mt-1">Add more images</p>
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
          Save as PDF
        </button>
      </main>

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
