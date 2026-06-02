<script lang="ts">
	import { untrack } from "svelte";
	import type TreeNode from "src/models/TreeNode";
	import Node from "src/ui/TreeView/TreeNode.svelte";

	let {
		tree,
		readOnly = false,
		enableShowDiff = false,
		showDiff,
	}: {
		tree: TreeNode;
		readOnly?: boolean;
		enableShowDiff?: boolean;
		showDiff: (_path: string) => void;
	} = $props();

	let treeMap: Record<string, TreeNode> = {};

	/**
	 * Initialize the treeMap with the parent-child relationships.
	 * This is used to quickly find the parent of a node when rebuilding the tree.
	 *
	 * @param node - The root node of the tree.
	 */
	function initTreeMap(node: TreeNode) {
		if (node.children) {
			for (const child of node.children) {
				treeMap[child.path] = node;
				initTreeMap(child);
			}
		}
	}

	$effect(() => {
		// Re-run when the tree reference changes (e.g. publishStatus loaded).
		// Use untrack for the body to avoid infinite loops from in-place mutations.
		const t = tree;
		untrack(() => {
			treeMap = {};
			initTreeMap(t);
			rebuildTree({ node: t }, false);
		});
	});

	/**
	 * Rebuild the children of a node based on its checked state.
	 * If checkAsParent is true, the children will inherit the parent's checked state.
	 * If false, the children will only be updated based on their own checked state.
	 *
	 * @param node - The node whose children are to be rebuilt.
	 * @param checkAsParent - Whether to set the children's checked state based on the parent's checked state.
	 */
	function rebuildChildren(node: TreeNode, checkAsParent = true) {
		if (node.children) {
			for (const child of node.children) {
				if (checkAsParent) child.checked = !!node.checked;
				rebuildChildren(child, checkAsParent);
			}

			node.indeterminate =
				node.children.some((c) => c.indeterminate) ||
				(node.children.some((c) => !!c.checked) &&
					node.children.some((c) => !c.checked));
		}
	}

	/**
	 * Rebuild the tree state based on the toggled node.
	 * This function updates the checked and indeterminate states of the parent nodes
	 * based on the state of their children.
	 *
	 * @param data - The event data containing the toggled node.
	 * @param checkAsParent - Whether to set the children's checked state based on the parent's checked state.
	 */
	function rebuildTree(data: { node: TreeNode }, checkAsParent = true) {
		const node = data.node;
		let parent = treeMap[node.path];
		rebuildChildren(node, checkAsParent);

		while (parent) {
			const allCheck = parent?.children?.every((c) => !!c.checked);

			if (allCheck) {
				parent.indeterminate = false;
				parent.checked = true;
			} else {
				const haveCheckedOrIndetermine = parent?.children?.some(
					(c) => !!c.checked || c.indeterminate,
				);

				if (haveCheckedOrIndetermine) {
					parent.indeterminate = true;
				} else {
					parent.indeterminate = false;
				}
				parent.checked = false;
			}

			parent = treeMap[parent.path];
		}
	}
</script>

<div>
	<Node
		{tree}
		{readOnly}
		{enableShowDiff}
		ontoggle={rebuildTree}
		onshowdiff={(data) => showDiff(data.node.path)}
	/>
</div>
