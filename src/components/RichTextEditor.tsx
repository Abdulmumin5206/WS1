"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Indent, Outdent, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange, placeholder }) => {
  const { theme } = useTheme();
  const [showPasteOptions, setShowPasteOptions] = useState(false);
  const [pastePosition, setPastePosition] = useState({ x: 0, y: 0 });
  const [pasteData, setPasteData] = useState({ 
    text: '', 
    html: '' 
  });
  const [showIndentHint, setShowIndentHint] = useState(false);
  
  const pasteOptionsRef = useRef<HTMLDivElement>(null);
  const indentHintRef = useRef<HTMLDivElement>(null);
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        defaultAlignment: 'left',
        alignments: ['left', 'center', 'right'],
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[100px] p-2',
      },
      handlePaste: (view, event) => {
        // Prevent default paste behavior
        event.preventDefault();
        
        // Get text and HTML content from clipboard
        const text = event.clipboardData?.getData('text/plain') || '';
        const html = event.clipboardData?.getData('text/html') || '';
        
        if (text.trim()) {
          // Store both formats
          setPasteData({
            text,
            html: html || text
          });
          
          // Get the position for the paste options popup
          const editorBounds = view.dom.getBoundingClientRect();
          const { left, top } = view.coordsAtPos(view.state.selection.from);
          
          setPastePosition({
            x: Math.min(left - editorBounds.left, editorBounds.width - 200),
            y: top - editorBounds.top + 20
          });
          
          // Show paste options
          setShowPasteOptions(true);
          return true;
        }
        
        return false;
      },
    },
  });
  
  // Close paste options when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pasteOptionsRef.current && !pasteOptionsRef.current.contains(event.target as Node)) {
        setShowPasteOptions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handlePasteOption = (asPlainText: boolean) => {
    if (editor) {
      if (asPlainText) {
        // Insert as plain text only
        editor.chain().focus().insertContent(pasteData.text).run();
      } else {
        // Try to paste with formatting preserved
        try {
          // Use HTML content if available, otherwise fallback to plain text
          editor.commands.insertContent(pasteData.html || pasteData.text);
        } catch (error) {
          // Fallback to plain text if HTML insertion fails
          editor.chain().focus().insertContent(pasteData.text).run();
        }
      }
    }
    
    // Reset state
    setShowPasteOptions(false);
    setPasteData({ text: '', html: '' });
  };

  // Add a function to handle indentation (subbullet)
  const handleIndent = () => {
    if (editor) {
      if (editor.isActive('bulletList') || editor.isActive('orderedList')) {
        editor.chain().focus().sinkListItem('listItem').run();
      }
    }
  };
  
  // Add a function to handle outdentation
  const handleOutdent = () => {
    if (editor) {
      if (editor.isActive('bulletList') || editor.isActive('orderedList')) {
        editor.chain().focus().liftListItem('listItem').run();
      }
    }
  };

  // Add useEffect to detect when a list is created
  useEffect(() => {
    if (editor) {
      // Check if user has already seen the hint
      const hasSeenHint = localStorage.getItem('hasSeenIndentHint') === 'true';
      
      // Watch for changes in the editor state
      const updateHandler = ({ editor: editorInstance }: { editor: any }) => {
        // Show hint if a bullet or ordered list is active and hint hasn't been shown before
        if ((editorInstance.isActive('bulletList') || editorInstance.isActive('orderedList')) && !hasSeenHint && !showIndentHint) {
          setShowIndentHint(true);
          // Mark as seen in localStorage
          localStorage.setItem('hasSeenIndentHint', 'true');
          
          // Auto-hide the hint after 10 seconds
          setTimeout(() => {
            setShowIndentHint(false);
          }, 10000);
        }
      };
      
      // Add the event listener
      editor.on('update', updateHandler);
      
      return () => {
        // Remove the event listener
        editor.off('update', updateHandler);
      };
    }
  }, [editor, showIndentHint]);
  
  // Add a click outside handler for the indent hint
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (indentHintRef.current && !indentHintRef.current.contains(event.target as Node)) {
        setShowIndentHint(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md relative">
      <div className="border-b border-gray-200 dark:border-gray-700 p-2 flex flex-wrap gap-2 bg-gray-50 dark:bg-slate-800">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded ${editor.isActive('bold') 
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' 
            : 'hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-gray-300'}`}
          title="Bold"
        >
          <Bold className="h-4 w-4" suppressHydrationWarning />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded ${editor.isActive('italic') 
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' 
            : 'hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-gray-300'}`}
          title="Italic"
        >
          <Italic className="h-4 w-4" suppressHydrationWarning />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2 rounded ${editor.isActive('underline') 
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' 
            : 'hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-gray-300'}`}
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" suppressHydrationWarning />
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-2 rounded ${editor.isActive({ textAlign: 'left' }) 
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' 
            : 'hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-gray-300'}`}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" suppressHydrationWarning />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-2 rounded ${editor.isActive({ textAlign: 'center' }) 
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' 
            : 'hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-gray-300'}`}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" suppressHydrationWarning />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-2 rounded ${editor.isActive({ textAlign: 'right' }) 
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' 
            : 'hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-gray-300'}`}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" suppressHydrationWarning />
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded ${editor.isActive('bulletList') 
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' 
            : 'hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-gray-300'}`}
          title="Bullet List"
        >
          <List className="h-4 w-4" suppressHydrationWarning />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded ${editor.isActive('orderedList') 
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' 
            : 'hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-gray-300'}`}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" suppressHydrationWarning />
        </button>
        
        {/* Add new indent/outdent buttons */}
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          onClick={handleIndent}
          disabled={!(editor?.isActive('bulletList') || editor?.isActive('orderedList'))}
          className={`p-2 rounded ${
            !(editor?.isActive('bulletList') || editor?.isActive('orderedList'))
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-gray-100 dark:hover:bg-slate-700'
          } dark:text-gray-300`}
          title="Indent (Create Subbullet)"
        >
          <Indent className="h-4 w-4" suppressHydrationWarning />
        </button>
        <button
          onClick={handleOutdent}
          disabled={!(editor?.isActive('bulletList') || editor?.isActive('orderedList'))}
          className={`p-2 rounded ${
            !(editor?.isActive('bulletList') || editor?.isActive('orderedList'))
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-gray-100 dark:hover:bg-slate-700'
          } dark:text-gray-300`}
          title="Outdent"
        >
          <Outdent className="h-4 w-4" suppressHydrationWarning />
        </button>
      </div>
      <EditorContent editor={editor} className={`${theme === 'dark' ? 'dark-editor' : ''}`} />
      
      {showPasteOptions && (
        <div 
          ref={pasteOptionsRef}
          className="absolute bg-white dark:bg-slate-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 p-2 z-10"
          style={{ top: `${pastePosition.y}px`, left: `${pastePosition.x}px` }}
        >
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Paste Options:</div>
          <div className="flex flex-col space-y-1">
            <button 
              className="px-3 py-1 text-sm text-left rounded hover:bg-blue-50 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-300"
              onClick={() => handlePasteOption(false)}
            >
              Paste as is
            </button>
            <button 
              className="px-3 py-1 text-sm text-left rounded hover:bg-blue-50 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-300"
              onClick={() => handlePasteOption(true)}
            >
              Paste as plain text
            </button>
          </div>
        </div>
      )}
      
      {showIndentHint && (
        <div 
          ref={indentHintRef}
          className="absolute top-12 right-6 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-blue-300 dark:border-blue-800 p-3 z-10 max-w-xs"
          style={{ animation: 'fadeIn 0.3s' }}
        >
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-bold text-blue-600 dark:text-blue-400">Create Nested Lists</h4>
            <button 
              onClick={() => setShowIndentHint(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" suppressHydrationWarning />
            </button>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
            Use the new indent/outdent buttons <Indent className="h-3 w-3 inline-block mx-1" /> <Outdent className="h-3 w-3 inline-block mx-1" /> to create nested bullet points.
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">Pro tip:</span> You can also use <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Tab</kbd> and <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Shift+Tab</kbd> keys.
          </p>
        </div>
      )}
    </div>
  );
};

export default RichTextEditor; 