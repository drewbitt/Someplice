import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import '../../../app.css';
import GoalColorPalette from './GoalColorPalette.svelte';
import { colors } from './colors';

const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('#lib/trpc/client.js', () => ({ trpc: () => ({ goals: { list: { query: api.list } } }) }));
beforeEach(() => {
	api.list.mockReset().mockResolvedValue([]);
});

test.each([
	['navy', [0, 0, 204, 255]],
	['hsl(200 50% 40%)', [71, 153, 194, 255]]
])('lightens %s without changing its hue or saturation', async (color, expected) => {
	const screen = await render(GoalColorPalette, { goalColor: color });
	const button = screen.getByRole('button', { name: 'Choose goal color' }).element();
	const context = document.createElement('canvas').getContext('2d')!;
	context.fillStyle = getComputedStyle(button).backgroundColor;
	context.fillRect(0, 0, 1, 1);
	expect([...context.getImageData(0, 0, 1, 1).data]).toEqual(expected);
});

test('a failed color request can be retried and colors work with the keyboard', async () => {
	api.list
		.mockRejectedValueOnce(new Error('offline'))
		.mockResolvedValueOnce([{ color: colors[0] }]);
	const screen = await render(GoalColorPalette, { goalColor: 'navy' });
	const opener = screen.getByRole('button', { name: 'Choose goal color' });
	await userEvent.type(opener, ' ');
	await expect
		.element(screen.getByRole('alert'))
		.toMatchTextContent(/Could not load goal colors\./);
	await screen.getByRole('button', { name: 'Retry' }).click();
	const option = screen.getByRole('button', { name: `Use ${colors[1]}`, exact: true });
	await expect.element(option).toBeVisible();
	await expect
		.element(screen.getByRole('button', { name: `Use ${colors[0]}`, exact: true }))
		.not.toBeInTheDocument();
	await userEvent.type(option, '{Enter}');
	await expect.element(screen.getByText('Choose Goal Color', { exact: true })).not.toBeVisible();
	expect(api.list).toHaveBeenCalledTimes(2);
	expect(screen.container.querySelector('span')?.style.backgroundColor).not.toBe('navy');
});

test('reopening the palette refreshes colors used by other goals', async () => {
	const screen = await render(GoalColorPalette, { goalColor: 'navy' });
	const opener = screen.getByRole('button', { name: 'Choose goal color' });
	await opener.click();
	await screen.getByRole('button', { name: `Use ${colors[0]}`, exact: true }).click();
	api.list.mockResolvedValueOnce([{ color: colors[1] }]);
	await opener.click();
	await expect
		.element(screen.getByRole('button', { name: `Use ${colors[0]}`, exact: true }))
		.toBeVisible();
	await expect
		.element(screen.getByRole('button', { name: `Use ${colors[1]}`, exact: true }))
		.not.toBeInTheDocument();
	expect(api.list).toHaveBeenCalledTimes(2);
});

test('editing a color keeps the goal’s original color available while excluding other goals', async () => {
	api.list.mockResolvedValue([
		{ id: 1, color: colors[0] },
		{ id: 2, color: colors[1] }
	]);
	const screen = await render(GoalColorPalette, { goalColor: colors[0], goalId: 1 });
	const trigger = screen.getByRole('button', { name: 'Choose goal color' });
	await trigger.click();
	await expect.element(screen.getByRole('dialog', { name: 'Choose Goal Color' })).toBeVisible();
	await screen.getByRole('button', { name: `Use ${colors[2]}`, exact: true }).click();
	await trigger.click();
	await expect
		.element(screen.getByRole('button', { name: `Use ${colors[0]}`, exact: true }))
		.toBeVisible();
	await expect
		.element(screen.getByRole('button', { name: `Use ${colors[1]}`, exact: true }))
		.not.toBeInTheDocument();
});
