
## Problem Statement
Fix some behavior that incorrect [DocumentEditor.tsx](file;file:///d:/personal/apitester-desktop/frontend/src/pages/editor/components/DocumentEditor.tsx) in editor

### When press Ctrl + B to text with whitespace in end
*note: it is only happen when the text selected by cursor has whitespace at the end.*
- The text displayed is become italic while the \* created only one for both side
- the \* is print as content of document for both side, but
- when i move cursor to the text, the live transform appearing another pair of \*.
- Appears that when cursor on the text, the order of \* as follow. 
	- => 'star that is content'+'star that is live transform show syntax'+'the text'+'star that is content'+'star that is live transform show syntax'
- The cursor move to start of the file.
- When i give space after 'start that is live transform show syntax' whether the text is in part of list or part of paragraph, the  entire content in list or paragraph is changed with empty list with one item.

### When press Ctrl + B to text with nonwhitespace in end
note: it is only happen when the selected text by cursor is not end with whitespace
- the selected is vanish and cursor move to top
- when there is 'star that is content'+'star that is live transform show syntax'+'the text'+'star that is content'+'star that is live transform show syntax' before the selected texts, there is addition behavior in which the rest of text after selected text become italic to the next 'start that is content'+... i talk about
- when there is 'star that is content'+'star that is live transform show syntax'+'the text'+'star that is content'+'star that is live transform show syntax' after the selected texts, there is addition behavior in which the rest of text after selected text become bold to the next 'start that is content'+... i talk about

## Acceptance Criteria

### When press Ctrl + B and Button Bold at Header
- When cursor selected texts, 
	- then render the text to bold
	- the text in content file is wrap with pairs of star, eg: **bold**
	- then the live transform is showing pairs of stars when cursor on text.
	- when text already bold by definition, then when action ctrl + b or button bold apply to the text, then un-bold the text.
- also consider fix the behavior at problem statement 



> [!NOTE] Consideration
> - This problem also apply to behavior of italic, italicbold
> - the syntax apply when button at header for format to italic, bold, italicbold is pressed then, you just use syntax star not the others, but when user manually typing the others let them apply to the behavior explained

