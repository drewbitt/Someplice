import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Editor from './Editor.svelte';
import '../../../../app.css';

test('editor expands only the caret line and preserves selection', async () => {
	const screen = await render(Editor, { value: '', highlight: (value) => value });
	const editor = screen.getByRole('textbox', { name: 'Daily intentions' });
	await editor.fill('1) read 2\n3 ');
	await expect.element(editor).toHaveValue('1) read 2\n3) ');
	const input = editor.element() as HTMLTextAreaElement;
	expect(input.selectionStart).toBe(input.value.length);
	expect(input.selectionEnd).toBe(input.value.length);
});

test('editor does not rewrite its overlay during composition and mirrors scrolling', async () => {
	const screen = await render(Editor, { value: 'original', highlight: (value) => value });
	const editor = screen.getByRole('textbox', { name: 'Daily intentions' });
	const input = editor.element() as HTMLTextAreaElement;
	const pre = input.previousElementSibling as HTMLElement;
	input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
	await screen.rerender({ value: 'composing' });
	expect(pre.textContent).toBe('original');
	input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
	await expect.poll(() => pre.textContent).toBe('composing');
	await editor.fill(Array.from({ length: 30 }, (_, i) => `1) line ${i}`).join('\n'));
	input.scrollTop = 120;
	input.dispatchEvent(new Event('scroll'));
	expect(pre.scrollTop).toBe(input.scrollTop);
	expect(input.scrollTop).toBeGreaterThan(0);
});
