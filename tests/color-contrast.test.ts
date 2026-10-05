import { expect, test } from '@playwright/test';
import { readableTextColor } from '../src/lib/utils';

test('goal text contrasts with light and dark fills', async ({ page }) => {
	const light = 'hsl(212.452 71.736% 80.365%)';
	const dark = 'navy';
	await page.setContent(`
		<span style="background-color: ${light}; color: ${readableTextColor(light)}">Light goal</span>
		<span style="background-color: ${dark}; color: ${readableTextColor(dark)}">Dark goal</span>
	`);
	await expect(page.getByText('Light goal')).toHaveCSS('color', 'rgb(0, 0, 0)');
	await expect(page.getByText('Dark goal')).toHaveCSS('color', 'rgb(255, 255, 255)');
});
