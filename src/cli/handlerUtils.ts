import type { CliData } from "./types";
import { formatCliOutput, cliError } from "./formatOutput";
import { validatePreFlight } from "./validators";
import Publisher from "src/publisher/Publisher";
import PublishStatusManager, {
	PublishStatus,
} from "src/publisher/PublishStatusManager";
import QuartzSyncerSiteManager from "src/repositoryConnection/QuartzSyncerSiteManager";
import { RepositoryConnection } from "src/repositoryConnection/RepositoryConnection";
import { CliProgressController } from "./cliProgressController";
import type QuartzSyncer from "main";

/**
 * Pluralize a word based on count.
 */
export function pluralize(
	count: number,
	singular: string,
	plural?: string,
): string {
	return count === 1 ? singular : (plural ?? `${singular}s`);
}

/**
 * Parse verbose flags from CLI params.
 */
export function parseVerboseFlags(params: CliData): {
	verbose: boolean;
	includeVerbose: boolean;
} {
	const verbose = params.verbose === "true";

	return { verbose, includeVerbose: verbose && params.format !== "json" };
}

/**
 * Extract a string parameter with a default value.
 */
export function getStringParam(
	params: CliData,
	key: string,
	defaultValue = "",
): string {
	const value = params[key];

	return typeof value === "string" ? value : defaultValue;
}

/**
 * Parse a raw string value into the expected type.
 * Returns null if the value cannot be parsed as the expected type.
 */
export function parseConfigValue(
	expectedType: "string" | "boolean",
	raw: string,
): string | boolean | null {
	if (expectedType === "string") return raw;

	if (raw === "true") return true;

	if (raw === "false") return false;

	return null;
}

/**
 * Extract error message from unknown error.
 */
export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Wrap a CLI handler with standard pre-flight validation and error handling.
 */
export function wrapHandler(
	command: string,
	handler: (params: CliData) => Promise<string>,
): (params: CliData) => Promise<string> {
	return async (params: CliData) => {
		try {
			return await handler(params);
		} catch (error) {
			return formatCliOutput(
				params,
				cliError(command, getErrorMessage(error)),
			);
		}
	};
}

/**
 * Validate pre-flight conditions and return error string if failed.
 */
export function checkPreFlight(
	plugin: QuartzSyncer,
	params: CliData,
	command: string,
): string | null {
	const validationError = validatePreFlight(plugin);

	if (validationError) {
		return formatCliOutput(params, cliError(command, validationError));
	}

	return null;
}

/**
 * Create Publisher, SiteManager, and StatusManager from plugin.
 */
export function createPublishStack(plugin: QuartzSyncer) {
	const siteManager = new QuartzSyncerSiteManager(
		plugin.app.metadataCache,
		plugin.settings,
		plugin.getGitSettingsWithSecret(),
	);

	const publisher = new Publisher(
		plugin.app,
		plugin,
		plugin.app.vault,
		plugin.app.metadataCache,
		plugin.settings,
		plugin.datastore,
		plugin.extendedCache,
	);

	const statusManager = new PublishStatusManager(siteManager, publisher);

	return { siteManager, publisher, statusManager };
}

/**
 * Initialize full publish status (used by status, sync, publish, delete handlers).
 */
export async function initPublishStatus(plugin: QuartzSyncer) {
	const stack = createPublishStack(plugin);
	const controller = new CliProgressController();
	const status = await stack.statusManager.getPublishStatus(controller);

	return { ...stack, status, controller };
}

/**
 * Create a RepositoryConnection from plugin settings.
 */
export function createConnection(plugin: QuartzSyncer): RepositoryConnection {
	const gitSettings = plugin.getGitSettingsWithSecret();

	return new RepositoryConnection({
		gitSettings,
		contentFolder: plugin.settings.contentFolder,
		vaultPath: plugin.settings.vaultPath,
	});
}

/**
 * Filter deleted blob paths that don't overlap with note paths.
 */
export function filterDeletedBlobs(
	status: PublishStatus,
): PublishStatus["deletedBlobPaths"] {
	const notePaths = new Set([
		...status.unpublishedNotes.map((f) => f.getPath()),
		...status.changedNotes.map((f) => f.getPath()),
		...status.publishedNotes.map((f) => f.getPath()),
		...status.deletedNotePaths.map((p) => p.path),
	]);

	return status.deletedBlobPaths.filter((p) => !notePaths.has(p.path));
}

/**
 * Build verbose output message from sections.
 */
export function buildVerboseMessage(
	includeVerbose: boolean,
	sections: Array<{ label: string; items: string[] }>,
	fallback: string,
): string {
	if (!includeVerbose) return fallback;
	const lines: string[] = [];

	for (const { label, items } of sections) {
		if (items.length > 0) {
			lines.push(label);
			lines.push(...items.map((item) => `\t${item}`));
		}
	}

	return lines.length > 0 ? lines.join("\n") : fallback;
}
