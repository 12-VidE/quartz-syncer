<script lang="ts" module>
	// retain module scoped expansion state for each tree node
	export const _expansionState: Record<string, boolean> = {
		/* treeNodeId: expanded <boolean> */
	};
</script>

<!-- TreeView with checkbox https://svelte.dev/playground/eca6f6392e294247b4f379fde3069274?version=5.34.3 -->

<script lang="ts">
	import type TreeNodeModel from "src/models/TreeNode";
	import Icon from "src/ui/Icon.svelte";
	import TreeNode from "src/ui/TreeView/TreeNode.svelte";

	let {
		tree,
		readOnly = false,
		enableShowDiff = false,
		ontoggle,
		onshowdiff,
	}: {
		tree: TreeNodeModel;
		readOnly?: boolean;
		enableShowDiff?: boolean;
		ontoggle?: (_data: { node: TreeNodeModel }) => void;
		onshowdiff?: (_data: { node: TreeNodeModel }) => void;
	} = $props();

	let isRoot = $derived(tree.isRoot);
	let path = $derived(tree.path);

	let expanded = $state(false);

	$effect.pre(() => {
		// Sync initial expansion state when the node path changes.
		expanded = _expansionState[path] || false;
	});

	/**
	 * Toggle the expansion state of the current node.
	 * This function updates the expanded state and toggles the arrow icon.
	 * It is called when the user clicks on the node's name or the arrow icon.
	 */
	const toggleExpansion = () => {
		expanded = _expansionState[path] = !expanded;
	};

	let arrowDown = $derived(expanded);

	/**
	 * Toggle the check state of the current node.
	 * This function updates the node's checked state and emits a 'toggle' event
	 * to notify the parent component to rebuild the entire tree's state.
	 */
	const toggleCheck = () => {
		tree.checked = !tree.checked;

		ontoggle?.({
			node: tree,
		});
	};

	/**
	 * Dispatch a 'toggle' event when the checkbox is clicked.
	 * This is used to update the tree's state in the parent component.
	 *
	 * @param node - The TreeNode that was toggled.
	 */
	const dispatchChecked = (node: TreeNodeModel) => {
		ontoggle?.({ node });
	};

	/**
	 * Show the diff for the current node.
	 * This function dispatches a 'showDiff' event with the current node.
	 *
	 * @param e - The MouseEvent that triggered the function.
	 */
	const showDiff = (e: MouseEvent) => {
		e.stopPropagation();
		onshowdiff?.({ node: tree });
	};

	/**
	 * Dispatch a 'showDiff' event with the current node.
	 * This is used to notify the parent component to show the diff for the node.
	 *
	 * @param node - The TreeNode for which to show the diff.
	 */
	const dispatchShowDiff = (node: TreeNodeModel) => {
		onshowdiff?.({ node });
	};
</script>

<ul class:isRoot>
	<li>
		{#if tree.children}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span>
				<span onclick={toggleExpansion} class="arrow" class:arrowDown>
					<Icon name="chevron-right" />
				</span>
				{#if !isRoot}
					<Icon name="folder" />
					{#if !readOnly}
						<input
							type="checkbox"
							data-label={tree.name}
							checked={tree.checked}
							indeterminate={tree.indeterminate}
							onclick={toggleCheck}
						/>
					{/if}
					<span onclick={toggleExpansion}>{tree.name}</span>
				{:else}
					{#if !readOnly}
						<input
							type="checkbox"
							data-label={tree.name}
							checked={tree.checked}
							indeterminate={tree.indeterminate}
							onclick={toggleCheck}
						/>
					{/if}

					<span class="root-header" onclick={toggleExpansion}
						>{tree.name}</span
					>
				{/if}
			</span>
			{#if expanded}
				{#each tree.children as child}
					<TreeNode
						ontoggle={(data) => dispatchChecked(data.node)}
						onshowdiff={(data) => dispatchShowDiff(data.node)}
						{enableShowDiff}
						{readOnly}
						tree={child}
					/>
				{/each}
			{/if}
		{:else if !isRoot}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span>
				<span class="no-arrow"></span>
				<Icon name="file" />
				{#if !readOnly}
					<input
						type="checkbox"
						data-label={tree.name}
						checked={tree.checked}
						indeterminate={tree.indeterminate}
						onclick={toggleCheck}
					/>
				{/if}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<span onclick={toggleExpansion}>{tree.name}</span>
				{#if tree.fileType === "base"}
					<span
						class="quartz-syncer-file-badge quartz-syncer-badge-base"
						>BASE</span
					>
				{/if}
				{#if tree.fileType === "canvas"}
					<span
						class="quartz-syncer-file-badge quartz-syncer-badge-canvas"
						>CANVAS</span
					>
				{/if}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				{#if enableShowDiff}
					<span
						title="Show changes"
						class="quartz-syncer-icon-diff"
						onclick={showDiff}
					>
						<Icon name="file-diff" />
					</span>
				{/if}
			</span>
		{/if}
	</li>
</ul>
