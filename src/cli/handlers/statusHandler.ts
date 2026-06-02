import type QuartzSyncer from "main";
import { CliData, CliFlags, RegisterFn } from "../types";
import { formatCliOutput, cliSuccess, cliError } from "../formatOutput";
import {
	checkPreFlight,
	filterDeletedBlobs,
	getErrorMessage,
	initPublishStatus,
	parseVerboseFlags,
} from "../handlerUtils";

const COMMAND = "quartz-syncer:status";

const FLAGS: CliFlags = {
	format: {
		value: "<json|text>",
		description: "Output format (default: text)",
	},
};

export function createStatusHandler(
	register: RegisterFn,
	plugin: QuartzSyncer,
): void {
	register(
		COMMAND,
		"Show the publish status of all marked notes",
		FLAGS,
		async (params: CliData): Promise<string> => {
			try {
				const preFlightError = checkPreFlight(plugin, params, COMMAND);

				if (preFlightError) return preFlightError;

				const startTime = Date.now();

				const { status } = await initPublishStatus(plugin);
				const filteredDeletedBlobs = filterDeletedBlobs(status);

				const data = {
					unpublished: status.unpublishedNotes.map((f) =>
						f.getPath(),
					),
					changed: status.changedNotes.map((f) => f.getPath()),
					published: status.publishedNotes.map((f) => f.getPath()),
					deletedNotes: status.deletedNotePaths.map((p) => p.path),
					deletedBlobs: filteredDeletedBlobs.map((p) => p.path),
					summary: {
						unpublished: status.unpublishedNotes.length,
						changed: status.changedNotes.length,
						published: status.publishedNotes.length,
						deletedNotes: status.deletedNotePaths.length,
						deletedBlobs: filteredDeletedBlobs.length,
					},
				};

				const { includeVerbose } = parseVerboseFlags(params);
				const messageLines: string[] = [];

				const appendSection = (
					label: string,
					paths: string[],
				): void => {
					messageLines.push(label);

					if (!includeVerbose || paths.length === 0) {
						return;
					}
					messageLines.push(...paths.map((path) => `\t${path}`));
				};

				const deletedPaths = [
					...data.deletedNotes,
					...data.deletedBlobs,
				];

				appendSection(
					`Unpublished: ${data.summary.unpublished}`,
					data.unpublished,
				);

				appendSection(
					`Changed:     ${data.summary.changed}`,
					data.changed,
				);

				appendSection(
					`Published:   ${data.summary.published}`,
					data.published,
				);

				appendSection(
					`Deleted:     ${
						data.summary.deletedNotes + data.summary.deletedBlobs
					}`,
					deletedPaths,
				);

				const message = messageLines.join("\n");

				return formatCliOutput(
					params,
					cliSuccess(COMMAND, message, data, Date.now() - startTime),
				);
			} catch (error) {
				return formatCliOutput(
					params,
					cliError(COMMAND, getErrorMessage(error)),
				);
			}
		},
	);
}
