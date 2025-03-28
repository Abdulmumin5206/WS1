"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Indent,
  Outdent
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange, placeholder }) => {
  const { theme } = useTheme();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        defaultAlignment: "left",
        alignments: ["left", "center", "right"]
      })
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[100px] p-2"
      },
      // Automatically insert plain text on paste so that formatting (including bullets) is removed.
      handlePaste: (view, event) => {
        event.preventDefault();
        const plainText = event.clipboardData?.getData("text/plain") || "";
        // Optionally, you could further process plainText here (e.g., remove unwanted characters).
        view.dispatch(
          view.state.tr.insertText(plainText, view.state.selection.from, view.state.selection.to)
        );
        return true;
      }
    }
  });

  if (!editor) return null;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md relative">
      <div className="border-b border-gray-200 dark:border-gray-700 p-2 flex flex-wrap gap-2 bg-gray-50 dark:bg-slate-800">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded ${editor.isActive("bold") 
            ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300" 
            : "hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-gray-300"}`}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded ${editor.isActive("italic") 
            ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300" 
            : "hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-gray-300"}`}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2 rounded ${editor.isActive("underline") 
            ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300" 
            : "hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-gray-300"}`}
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={`p-2 rounded ${editor.isActive({ textAlign: "left" }) 
            ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300" 
            : "hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-gray-300"}`}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={`p-2 rounded ${editor.isActive({ textAlign: "center" }) 
            ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300" 
            : "hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-gray-300"}`}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={`p-2 rounded ${editor.isActive({ textAlign: "right" }) 
            ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300" 
            : "hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-gray-300"}`}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded ${editor.isActive("bulletList") 
            ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300" 
            : "hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-gray-300"}`}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded ${editor.isActive("orderedList") 
            ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300" 
            : "hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-gray-300"}`}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          onClick={() => editor.chain().focus().sinkListItem("listItem").run()}
          disabled={!(editor?.isActive("bulletList") || editor?.isActive("orderedList"))}
          className={`p-2 rounded ${
            !(editor?.isActive("bulletList") || editor?.isActive("orderedList"))
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-gray-100 dark:hover:bg-slate-700"
          } dark:text-gray-300`}
          title="Indent (Create Subbullet)"
        >
          <Indent className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().liftListItem("listItem").run()}
          disabled={!(editor?.isActive("bulletList") || editor?.isActive("orderedList"))}
          className={`p-2 rounded ${
            !(editor?.isActive("bulletList") || editor?.isActive("orderedList"))
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-gray-100 dark:hover:bg-slate-700"
          } dark:text-gray-300`}
          title="Outdent"
        >
          <Outdent className="h-4 w-4" />
        </button>
      </div>
      <EditorContent editor={editor} className={theme === "dark" ? "dark-editor" : ""} />
    </div>
  );
};

export default RichTextEditor;
