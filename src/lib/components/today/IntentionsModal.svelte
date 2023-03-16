<script lang="ts">
	import { Box, Grid, Modal } from '@svelteuidev/core';
	import type { Goal, Intention } from '$src/lib/trpc/types';
	import { goalColorForIntention, goalOrderNumberForId } from '$src/lib/utils';
	import TextCursorInput from '~icons/lucide/text-cursor-input';
	import { onMount } from 'svelte';

	export let goals: Goal[];
	export let opened: boolean;
	export let intention: Intention;
	$: modalTitle = goalOrderNumberForId(intention.goalId, goals) + ') ' + intention.text;
	export let closeModal: () => void;

	onMount(() => {
		// Set css variable directly as a workaround for cssvariable not working in a parent div
		document.documentElement.style.setProperty(
			'--goal-color',
			goalColorForIntention(intention, goals)
		);

		const modalTitle = document.querySelector('.svelteui-Modal-title');
		if (modalTitle) {
			modalTitle.setAttribute(
				'style',
				'color: var(--goal-color); font-weight: bold; font-size: 1rem;'
			);
		}
	});
</script>

<Modal
	{opened}
	centered
	on:close={closeModal}
	withCloseButton={false}
	title={modalTitle}
	overlayOpacity={0.25}
>
	<Grid>
		<Grid.Col span={12}>
			<ul class="daisy-menu w-56 text-lg">
				<li>
					<span class="grid" style="grid-template-columns: 1rem auto;">
						<TextCursorInput class="w-6 h-6" />
						<button>Append Text</button>
					</span>
				</li>
			</ul>
		</Grid.Col>
	</Grid>
</Modal>
