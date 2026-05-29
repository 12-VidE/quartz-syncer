<script lang="ts">
	import { getIcon } from "obsidian";
	let { name = "book-heart" }: { name?: string } = $props(); //Lucide icon name. See https://lucide.dev/icons
</script>

{@html getIcon(name)?.outerHTML}
