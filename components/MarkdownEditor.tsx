import { TG } from '@/constants/theme';
import {
    Bold,
    Code,
    Heading1,
    Heading2,
    Heading3,
    Italic,
    Link,
    List,
    ListOrdered,
    Minus,
    Quote,
    Strikethrough,
} from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';

type Selection = { start: number; end: number };

interface MarkdownEditorProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  minHeight?: number;
}

type ToolItem = {
  icon: React.ReactNode;
  label: string;
  action: 'wrap' | 'prefix' | 'insert';
  before?: string;
  after?: string;
  prefix?: string;
  insert?: string;
};

const TOOLS: ToolItem[] = [
  { icon: <Bold size={16} color={TG.textPrimary} />, label: 'Bold', action: 'wrap', before: '**', after: '**' },
  { icon: <Italic size={16} color={TG.textPrimary} />, label: 'Italic', action: 'wrap', before: '_', after: '_' },
  { icon: <Strikethrough size={16} color={TG.textPrimary} />, label: 'Strike', action: 'wrap', before: '~~', after: '~~' },
  { icon: <Code size={16} color={TG.textPrimary} />, label: 'Code', action: 'wrap', before: '`', after: '`' },
  { icon: <Heading1 size={16} color={TG.textPrimary} />, label: 'H1', action: 'prefix', prefix: '# ' },
  { icon: <Heading2 size={16} color={TG.textPrimary} />, label: 'H2', action: 'prefix', prefix: '## ' },
  { icon: <Heading3 size={16} color={TG.textPrimary} />, label: 'H3', action: 'prefix', prefix: '### ' },
  { icon: <Quote size={16} color={TG.textPrimary} />, label: 'Quote', action: 'prefix', prefix: '> ' },
  { icon: <List size={16} color={TG.textPrimary} />, label: 'Bullet', action: 'prefix', prefix: '- ' },
  { icon: <ListOrdered size={16} color={TG.textPrimary} />, label: 'Numbered', action: 'prefix', prefix: '1. ' },
  { icon: <Link size={16} color={TG.textPrimary} />, label: 'Link', action: 'insert', insert: '[text](url)' },
  { icon: <Minus size={16} color={TG.textPrimary} />, label: 'Divider', action: 'insert', insert: '\n---\n' },
];

export default function MarkdownEditor({ value, onChangeText, placeholder, minHeight = 200 }: MarkdownEditorProps) {
  const inputRef = useRef<TextInput>(null);
  const [sel, setSel] = useState<Selection>({ start: 0, end: 0 });
  const [preview, setPreview] = useState(false);

  const applyTool = useCallback(
    (tool: ToolItem) => {
      const { start, end } = sel;
      const selected = value.slice(start, end);
      let newText = value;
      let cursorPos = end;

      if (tool.action === 'wrap') {
        const before = tool.before!;
        const after = tool.after!;
        if (selected) {
          // Wrap selection
          newText = value.slice(0, start) + before + selected + after + value.slice(end);
          cursorPos = end + before.length + after.length;
        } else {
          // Insert placeholder
          const ph = tool.label.toLowerCase();
          newText = value.slice(0, start) + before + ph + after + value.slice(end);
          cursorPos = start + before.length + ph.length;
        }
      } else if (tool.action === 'prefix') {
        const prefix = tool.prefix!;
        // Find beginning of current line
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const linePrefix = value.slice(lineStart, lineStart + prefix.length);
        if (linePrefix === prefix) {
          // Toggle off: remove prefix
          newText = value.slice(0, lineStart) + value.slice(lineStart + prefix.length);
          cursorPos = Math.max(start - prefix.length, lineStart);
        } else {
          newText = value.slice(0, lineStart) + prefix + value.slice(lineStart);
          cursorPos = start + prefix.length;
        }
      } else if (tool.action === 'insert') {
        const ins = tool.insert!;
        newText = value.slice(0, start) + ins + value.slice(end);
        cursorPos = start + ins.length;
      }

      onChangeText(newText);
      // Refocus and set cursor after state update
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.setNativeProps({ selection: { start: cursorPos, end: cursorPos } });
      }, 50);
    },
    [value, sel, onChangeText],
  );

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolScroll} keyboardShouldPersistTaps="always">
          {TOOLS.map((tool) => (
            <TouchableOpacity key={tool.label} style={styles.toolBtn} onPress={() => applyTool(tool)} activeOpacity={0.6}>
              {tool.icon}
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={[styles.previewToggle, preview && styles.previewToggleActive]} onPress={() => setPreview((p) => !p)}>
          <Text style={[styles.previewToggleText, preview && styles.previewToggleTextActive]}>
            {preview ? 'Edit' : 'Preview'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Editor / Preview */}
      {preview ? (
        <ScrollView style={[styles.previewArea, { minHeight }]} contentContainerStyle={styles.previewContent}>
          {value.trim() ? (
            <Markdown style={mdStyles}>{value}</Markdown>
          ) : (
            <Text style={styles.previewEmpty}>Nothing to preview</Text>
          )}
        </ScrollView>
      ) : (
        <TextInput
          ref={inputRef}
          style={[styles.input, { minHeight }]}
          value={value}
          onChangeText={onChangeText}
          onSelectionChange={(e) => setSel(e.nativeEvent.selection)}
          placeholder={placeholder ?? 'Write markdown content...'}
          placeholderTextColor={TG.textHint}
          multiline
          textAlignVertical="top"
          autoCapitalize="sentences"
          autoCorrect
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: TG.separator,
    borderRadius: 12,
    backgroundColor: TG.bgSecondary,
    overflow: 'hidden',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.bg,
    borderBottomWidth: 1,
    borderBottomColor: TG.separatorLight,
    paddingRight: 4,
  },
  toolScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    gap: 2,
  },
  toolBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewToggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: TG.bgSecondary,
    marginLeft: 4,
  },
  previewToggleActive: {
    backgroundColor: TG.accent,
  },
  previewToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: TG.textSecondary,
  },
  previewToggleTextActive: {
    color: TG.textWhite,
  },
  input: {
    padding: 12,
    fontSize: 14,
    color: TG.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
  },
  previewArea: {
    backgroundColor: TG.bg,
  },
  previewContent: {
    padding: 12,
  },
  previewEmpty: {
    color: TG.textHint,
    fontSize: 14,
    fontStyle: 'italic',
  },
});

const mdStyles = StyleSheet.create({
  body: { color: TG.textPrimary, fontSize: 15, lineHeight: 22 },
  heading1: { fontSize: 22, fontWeight: '800', color: TG.textPrimary, marginBottom: 8, marginTop: 12 },
  heading2: { fontSize: 19, fontWeight: '700', color: TG.textPrimary, marginBottom: 6, marginTop: 10 },
  heading3: { fontSize: 16, fontWeight: '700', color: TG.textPrimary, marginBottom: 4, marginTop: 8 },
  strong: { fontWeight: '700' },
  em: { fontStyle: 'italic' },
  blockquote: { borderLeftWidth: 3, borderLeftColor: TG.accent, paddingLeft: 12, marginVertical: 8, backgroundColor: TG.accentLight, borderRadius: 4, padding: 8 },
  code_inline: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: TG.bgSecondary, paddingHorizontal: 4, borderRadius: 4, fontSize: 13, color: TG.red },
  fence: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: TG.bgSecondary, padding: 12, borderRadius: 8, fontSize: 13, marginVertical: 8 },
  link: { color: TG.accent, textDecorationLine: 'underline' },
  hr: { backgroundColor: TG.separator, height: 1, marginVertical: 12 },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { flexDirection: 'row', marginVertical: 2 },
  paragraph: { marginVertical: 4 },
  strikethrough: { textDecorationLine: 'line-through' },
});
