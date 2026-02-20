import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';

import { colors } from '../theme.js';
import { useTextBuffer } from '../hooks/useTextBuffer.js';
import { cursorHandlers } from '../utils/input-key-handlers.js';
import { CursorText } from './CursorText.js';
import { SLASH_COMMANDS, Command } from '../utils/slash-commands.js';

interface InputProps {
  onSubmit: (value: string) => void;
  /** Value from history navigation (null = user typing fresh input) */
  historyValue?: string | null;
  /** Callback when user presses up/down arrow for history navigation */
  onHistoryNavigate?: (direction: 'up' | 'down') => void;
}

export function Input({ onSubmit, historyValue, onHistoryNavigate }: InputProps) {
  const { text, cursorPosition, actions } = useTextBuffer();

  // Suggestion state
  const [suggestions, setSuggestions] = useState<Command[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Update input buffer when history navigation changes
  useEffect(() => {
    if (historyValue === null) {
      // Returned to typing mode - clear input for fresh entry
      actions.clear();
      setShowSuggestions(false);
    } else if (historyValue !== undefined) {
      // Navigating history - show the historical message
      actions.setValue(historyValue);
      setShowSuggestions(false);
    }
  }, [historyValue]);

  // Detect slash commands
  useEffect(() => {
    const trimmed = text.trim();
    // Show suggestions if typed / and currently typing the command (no spaces yet)
    if (trimmed.startsWith('/') && !trimmed.includes(' ')) {
      const query = trimmed.toLowerCase();
      const matches = SLASH_COMMANDS.filter(cmd => cmd.label.startsWith(query));
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
      // Reset selection when list changes significantly (optional logic, keeping simple for now)
      if (matches.length > 0 && selectedIndex >= matches.length) {
         setSelectedIndex(0);
      }
    } else {
      setShowSuggestions(false);
    }
  }, [text]);

  // Handle all input
  useInput((input, key) => {
    const ctx = { text, cursorPosition };

    // Suggestions navigation: Up Arrow
    if (showSuggestions && key.upArrow) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
      return;
    }

    // Suggestions navigation: Down Arrow 
    if (showSuggestions && key.downArrow) {
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
      return;
    }

    // Suggestions selection: Tab or Enter (if suggestions visible and command incomplete)
    if (showSuggestions && (key.tab || key.return)) {
        const selected = suggestions[selectedIndex];
        if (selected) {
            // Replace current text with selected value + space
            // If value is just the command like /model, we add space? 
            // The value in SLASH_COMMANDS might be a full instruction or just prefix
            // Let's assume value replaces text.
            actions.setValue(selected.value + (selected.value.endsWith(' ') ? '' : ' '));
            setShowSuggestions(false);
            return;
        }
    }

    // Up arrow: move cursor up if not on first line, else history navigation
    if (key.upArrow) {
      const newPos = cursorHandlers.moveUp(ctx);
      if (newPos !== null) {
        actions.moveCursor(newPos);
      } else if (onHistoryNavigate) {
        onHistoryNavigate('up');
      }
      return;
    }

    // Down arrow: move cursor down if not on last line, else history navigation
    if (key.downArrow) {
      const newPos = cursorHandlers.moveDown(ctx);
      if (newPos !== null) {
        actions.moveCursor(newPos);
      } else if (onHistoryNavigate) {
        onHistoryNavigate('down');
      }
      return;
    }

    // Cursor movement - left arrow (plain, no modifiers)
    if (key.leftArrow && !key.ctrl && !key.meta) {
      actions.moveCursor(cursorHandlers.moveLeft(ctx));
      return;
    }

    // Cursor movement - right arrow (plain, no modifiers)
    if (key.rightArrow && !key.ctrl && !key.meta) {
      actions.moveCursor(cursorHandlers.moveRight(ctx));
      return;
    }

    // Ctrl+A - move to beginning of current line
    if (key.ctrl && input === 'a') {
      actions.moveCursor(cursorHandlers.moveToLineStart(ctx));
      return;
    }

    // Ctrl+E - move to end of current line
    if (key.ctrl && input === 'e') {
      actions.moveCursor(cursorHandlers.moveToLineEnd(ctx));
      return;
    }

    // Option+Left (Mac) / Ctrl+Left (Windows) / Alt+B - word backward
    if ((key.meta && key.leftArrow) || (key.ctrl && key.leftArrow) || (key.meta && input === 'b')) {
      actions.moveCursor(cursorHandlers.moveWordBackward(ctx));
      return;
    }

    // Option+Right (Mac) / Ctrl+Right (Windows) / Alt+F - word forward
    if ((key.meta && key.rightArrow) || (key.ctrl && key.rightArrow) || (key.meta && input === 'f')) {
      actions.moveCursor(cursorHandlers.moveWordForward(ctx));
      return;
    }

    // Option+Backspace (Mac) / Ctrl+Backspace (Windows) - delete word backward
    if ((key.meta || key.ctrl) && (key.backspace || key.delete)) {
      actions.deleteWordBackward();
      return;
    }

    // Handle backspace/delete - delete character before cursor
    if (key.backspace || key.delete) {
      actions.deleteBackward();
      return;
    }

    // Shift+Enter - insert newline for multi-line input
    if (key.return && key.shift) {
      actions.insert('\n');
      return;
    }

    // Handle submit (plain Enter)
    if (key.return) {
      const val = text.trim();
      if (val) {
        onSubmit(val);
        actions.clear();
      }
      return;
    }

    // Handle regular character input - insert at cursor position
    if (input && !key.ctrl && !key.meta) {
      actions.insert(input);
    }
  });

  return (
    <Box flexDirection="column" marginBottom={1} width="100%">
      {/* Suggestions Overlay */}
      {showSuggestions && suggestions.length > 0 && (
        <Box 
          flexDirection="column" 
          paddingX={1} 
          paddingY={1}
          borderStyle="single" 
          borderColor={colors.accent}
          marginBottom={0}
        >
          {suggestions.map((cmd, index) => (
            <Box key={cmd.label}>
              <Text color={index === selectedIndex ? colors.accent : colors.muted}>
                {index === selectedIndex ? '> ' : '  '}
                {cmd.label}
              </Text>
              <Text color={colors.mutedDark}> - {cmd.description}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Input Field */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={colors.mutedDark}
        borderLeft={false}
        borderRight={false}
        width="100%"
      >
        <Box paddingX={1}>
          <Text color={colors.primary} bold>
            {'> '}
          </Text>
          <CursorText text={text} cursorPosition={cursorPosition} />
        </Box>
      </Box>
    </Box>
  );
}
