import { expect, test } from '@playwright/test';
import { colors } from '../src/lib/components/goals/colors';
import { readableTextColor } from '../src/lib/utils';

test('solid goal colors have readable text in light and dark themes', async ({ page }) => {
	const fills = [...colors, 'navy', 'ivory', 'color(display-p3 0 0 0.5)', 'oklch(0.9 0 0)'];
	const results = await page.evaluate(
		(fills) => {
			const context = document.createElement('canvas').getContext('2d')!;
			const luminance = (color: string) => {
				context.fillStyle = color;
				context.fillRect(0, 0, 1, 1);
				return [...context.getImageData(0, 0, 1, 1).data]
					.slice(0, 3)
					.map((value) => value / 255)
					.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
					.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
			};
			return ['white', 'black'].flatMap((theme) => {
				document.body.style.backgroundColor = theme;
				document.body.style.color = theme === 'white' ? 'black' : 'white';
				return fills.map(({ background, foreground }) => {
					const element = document.createElement('span');
					element.style.backgroundColor = background;
					element.style.color = foreground;
					document.body.append(element);
					const computed = getComputedStyle(element);
					const bg = luminance(computed.backgroundColor);
					const fg = luminance(computed.color);
					element.remove();
					return {
						background,
						theme,
						contrast: (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05)
					};
				});
			});
		},
		fills.map((background) => ({ background, foreground: readableTextColor(background) }))
	);
	for (const { background, theme, contrast } of results) {
		expect(contrast, `${background} on ${theme}`).toBeGreaterThanOrEqual(4.5);
	}
});

test('native contrast resolves CSS variables and preserves muted descriptions', async ({
	page
}) => {
	await page.setContent(`
		<div style="--goal-color: navy; background-color: var(--goal-color)">
			<span id="title" style="color: ${readableTextColor('var(--goal-color)')}">Goal</span>
			<span id="description" style="color: color-mix(in srgb, ${readableTextColor('var(--goal-color)')} 80%, transparent)">Description</span>
		</div>
	`);
	await expect(page.locator('#title')).toHaveCSS('color', 'rgb(255, 255, 255)');
	await expect(page.locator('#description')).toHaveCSS('color', 'color(srgb 1 1 1 / 0.8)');
});
