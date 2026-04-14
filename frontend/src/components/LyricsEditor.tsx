'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Sparkles,
  RefreshCw,
  PenLine,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Trash2,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParsedSection {
  id: string;
  type: string;
  label: string;
  content: string;
}

interface LyricsEditorProps {
  lyrics: string;
  onUpdate: (lyrics: string) => void;
  onGenerateSection: (sectionLabel: string) => void;
  onRewriteSection: (sectionLabel: string, instruction: string) => void;
  isGenerating?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SECTION_TYPES = ['Verse', 'Hook', 'Bridge', 'Intro', 'Outro', 'Pre-Hook', 'Ad-lib'] as const;

const SECTION_COLORS: Record<string, string> = {
  verse: 'border-violet-500 bg-violet-500/5',
  hook: 'border-amber-500 bg-amber-500/5',
  chorus: 'border-amber-500 bg-amber-500/5',
  bridge: 'border-cyan-500 bg-cyan-500/5',
  intro: 'border-zinc-500 bg-zinc-500/5',
  outro: 'border-zinc-500 bg-zinc-500/5',
  'pre-hook': 'border-rose-500 bg-rose-500/5',
  'ad-lib': 'border-emerald-500 bg-emerald-500/5',
};

const SECTION_BADGE_COLORS: Record<string, string> = {
  verse: 'bg-violet-500/20 text-violet-300 ring-violet-500/30',
  hook: 'bg-amber-500/20 text-amber-300 ring-amber-500/30',
  chorus: 'bg-amber-500/20 text-amber-300 ring-amber-500/30',
  bridge: 'bg-cyan-500/20 text-cyan-300 ring-cyan-500/30',
  intro: 'bg-zinc-500/20 text-zinc-300 ring-zinc-500/30',
  outro: 'bg-zinc-500/20 text-zinc-300 ring-zinc-500/30',
  'pre-hook': 'bg-rose-500/20 text-rose-300 ring-rose-500/30',
  'ad-lib': 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseLyrics(raw: string): ParsedSection[] {
  if (!raw || !raw.trim()) return [];

  const lines = raw.split('\n');
  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;
  let counter = 0;

  for (const line of lines) {
    const headerMatch = line.match(/^\[(.+?)\]$/);
    if (headerMatch) {
      if (current) {
        current.content = current.content.trimEnd();
        sections.push(current);
      }
      counter++;
      const label = headerMatch[1];
      const type = label.toLowerCase().replace(/\s*\d+$/, '');
      current = {
        id: `section-${counter}`,
        type,
        label,
        content: '',
      };
    } else {
      if (!current) {
        counter++;
        current = {
          id: `section-${counter}`,
          type: 'verse',
          label: 'Verse',
          content: '',
        };
      }
      current.content += (current.content ? '\n' : '') + line;
    }
  }

  if (current) {
    current.content = current.content.trimEnd();
    sections.push(current);
  }

  return sections;
}

function sectionsToLyrics(sections: ParsedSection[]): string {
  return sections
    .map((s) => `[${s.label}]\n${s.content}`)
    .join('\n\n');
}

function getSectionColor(type: string): string {
  return SECTION_COLORS[type] || SECTION_COLORS['verse'];
}

function getBadgeColor(type: string): string {
  return SECTION_BADGE_COLORS[type] || SECTION_BADGE_COLORS['verse'];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LyricsEditor({
  lyrics,
  onUpdate,
  onGenerateSection,
  onRewriteSection,
  isGenerating = false,
}: LyricsEditorProps) {
  const [rewriteTarget, setRewriteTarget] = useState<string | null>(null);
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  const [addingSectionType, setAddingSectionType] = useState<string | null>(null);

  const sections = useMemo(() => parseLyrics(lyrics), [lyrics]);

  const updateSection = useCallback(
    (sectionId: string, newContent: string) => {
      const updated = sections.map((s) =>
        s.id === sectionId ? { ...s, content: newContent } : s
      );
      onUpdate(sectionsToLyrics(updated));
    },
    [sections, onUpdate]
  );

  const removeSection = useCallback(
    (sectionId: string) => {
      const updated = sections.filter((s) => s.id !== sectionId);
      onUpdate(sectionsToLyrics(updated));
    },
    [sections, onUpdate]
  );

  const moveSection = useCallback(
    (sectionId: string, direction: 'up' | 'down') => {
      const idx = sections.findIndex((s) => s.id === sectionId);
      if (idx === -1) return;
      if (direction === 'up' && idx === 0) return;
      if (direction === 'down' && idx === sections.length - 1) return;

      const updated = [...sections];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
      onUpdate(sectionsToLyrics(updated));
    },
    [sections, onUpdate]
  );

  const addSection = useCallback(
    (type: string) => {
      const existingOfType = sections.filter(
        (s) => s.type === type.toLowerCase().replace(/\s*\d+$/, '')
      ).length;
      const label =
        existingOfType > 0 ? `${type} ${existingOfType + 1}` : type;
      const newLyrics =
        lyrics.trim() +
        `\n\n[${label}]\n`;
      onUpdate(newLyrics);
      setAddingSectionType(null);
    },
    [lyrics, sections, onUpdate]
  );

  const handleRewriteSubmit = useCallback(
    (sectionLabel: string) => {
      if (!rewriteInstruction.trim()) return;
      onRewriteSection(sectionLabel, rewriteInstruction);
      setRewriteTarget(null);
      setRewriteInstruction('');
    },
    [rewriteInstruction, onRewriteSection]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <PenLine className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
            Lyrics
          </h2>
          {sections.length > 0 && (
            <span className="text-xs text-zinc-500">
              {sections.length} section{sections.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={() => onGenerateSection('all')}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white transition-colors duration-200"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Generate All Lyrics
        </button>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {sections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <PenLine className="w-10 h-10 mb-3 text-zinc-600" />
            <p className="text-sm mb-1">No lyrics yet</p>
            <p className="text-xs text-zinc-600">
              Generate lyrics or add a section to get started
            </p>
          </div>
        )}

        {sections.map((section, idx) => (
          <div
            key={section.id}
            className={`relative rounded-lg border-l-4 ${getSectionColor(
              section.type
            )} bg-zinc-900/50 transition-all duration-200`}
          >
            {/* Section Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/50">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ring-1 ring-inset ${getBadgeColor(
                  section.type
                )}`}
              >
                {section.label}
              </span>

              <div className="flex items-center gap-1">
                {/* Move up/down */}
                <button
                  onClick={() => moveSection(section.id, 'up')}
                  disabled={idx === 0}
                  className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move up"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => moveSection(section.id, 'down')}
                  disabled={idx === sections.length - 1}
                  className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move down"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {/* Regenerate Section */}
                <button
                  onClick={() => onGenerateSection(section.label)}
                  disabled={isGenerating}
                  className="p-1 rounded text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                  title="Regenerate section"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>

                {/* AI Rewrite */}
                <button
                  onClick={() =>
                    setRewriteTarget(
                      rewriteTarget === section.id ? null : section.id
                    )
                  }
                  disabled={isGenerating}
                  className={`p-1 rounded transition-colors ${
                    rewriteTarget === section.id
                      ? 'text-violet-400 bg-violet-500/10'
                      : 'text-zinc-500 hover:text-violet-400 hover:bg-zinc-800'
                  } disabled:opacity-30`}
                  title="AI Rewrite"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>

                {/* Delete Section */}
                <button
                  onClick={() => removeSection(section.id)}
                  className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                  title="Remove section"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Rewrite Instruction Input */}
            {rewriteTarget === section.id && (
              <div className="px-3 py-2 border-b border-zinc-800/50 bg-zinc-800/30">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rewriteInstruction}
                    onChange={(e) => setRewriteInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRewriteSubmit(section.label);
                      if (e.key === 'Escape') {
                        setRewriteTarget(null);
                        setRewriteInstruction('');
                      }
                    }}
                    placeholder="e.g. Make it more aggressive, add metaphors..."
                    className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-lg px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition-colors"
                    autoFocus
                  />
                  <button
                    onClick={() => handleRewriteSubmit(section.label)}
                    disabled={!rewriteInstruction.trim() || isGenerating}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white transition-colors"
                  >
                    Rewrite
                  </button>
                  <button
                    onClick={() => {
                      setRewriteTarget(null);
                      setRewriteInstruction('');
                    }}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Lyrics Textarea */}
            <textarea
              value={section.content}
              onChange={(e) => updateSection(section.id, e.target.value)}
              rows={Math.max(3, section.content.split('\n').length)}
              className="w-full bg-transparent px-3 py-3 text-sm text-zinc-200 font-mono leading-relaxed resize-none outline-none placeholder:text-zinc-600"
              placeholder="Write lyrics here..."
              spellCheck={false}
            />
          </div>
        ))}
      </div>

      {/* Add Section */}
      <div className="px-4 py-3 border-t border-zinc-800">
        {addingSectionType === null ? (
          <button
            onClick={() => setAddingSectionType('choosing')}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-500 hover:border-violet-500/50 hover:text-violet-400 transition-colors duration-200 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Section
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            {SECTION_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => addSection(type)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-zinc-300 transition-colors duration-200"
              >
                {type}
              </button>
            ))}
            <button
              onClick={() => setAddingSectionType(null)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
