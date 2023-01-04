<script lang="ts">
    import type { GoalBox } from '$lib/types';
	import { Box } from '@svelteuidev/core';

    export let id: GoalBox["id"];
    export let name: GoalBox["name"];
    export let description: GoalBox["description"];
</script>

<Box class="pb-1 my-2.5 mx-5">
    <span>
        {id}
    </span>
</Box>