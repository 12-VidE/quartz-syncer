import type QuartzSyncer from "main";
import { CliData, CliFlags, RegisterFn } from "../types";
import { formatCliOutput, cliSuccess, cliError } from "../formatOutput";
import {
	buildVerboseMessage,
	checkPreFlight,
	createConnection,
	getErrorMessage,
	parseVerboseFlags,
} from "../handlerUtils";
import { RepositoryConnection } from "src/repositoryConnection/RepositoryConnection";
import {
	UPSTREAM_REPO_URL,
	UPSTREAM_BRANCH,
	UPSTREAM_AUTH,
} from "src/quartz/QuartzUpgradeService";

const COMMAND = "quartz-syncer:upgrade";

const FLAGS: CliFlags = {
	force: {
		description: "Apply upgrade (required)",
	},
	"dry-run": {
		description: "Check for updates without applying",
	},
	format: {
		value: "<json|text>",
		description: "Output format (default: text)",
	},
};

export function createUpgradeHandler(
	register: RegisterFn,
	plugin: QuartzSyncer,
): void {
	register(
		COMMAND,
		"Upgrade the Quartz repository from upstream",
		FLAGS,
		async (params: CliData): Promise<string> => {
			try {
				const preFlightError = checkPreFlight(plugin, params, COMMAND);

				if (preFlightError) return preFlightError;

				const gitSettings = plugin.getGitSettingsWithSecret();

				const connection = createConnection(plugin);

				const dryRun = params["dry-run"] === "true";
				const { includeVerbose } = parseVerboseFlags(params);

				if (dryRun) {
					const lastUpstream =
						plugin.settings.lastUpstreamCommitSha || null;

					const upstreamHead =
						await RepositoryConnection.fetchRemoteHeadCommit(
							UPSTREAM_REPO_URL,
							UPSTREAM_AUTH,
							UPSTREAM_BRANCH,
							gitSettings.corsProxyUrl,
						);

					if (upstreamHead === null) {
						return formatCliOutput(
							params,
							cliError(
								COMMAND,
								"Could not check upstream. The remote may be unreachable.",
							),
						);
					}

					const hasUpdate = upstreamHead !== lastUpstream;

					const baseMessage = hasUpdate
						? "Upstream updates available."
						: "Already up to date.";

					const shaLines = [
						`Recorded SHA: ${lastUpstream ?? "none"}`,
						`Upstream HEAD: ${upstreamHead}`,
					];

					const message = includeVerbose
						? buildVerboseMessage(
								includeVerbose,
								[
									{
										label: baseMessage,
										items: [
											`Upstream: ${UPSTREAM_REPO_URL}#${UPSTREAM_BRANCH}`,
											...shaLines,
										],
									},
								],
								baseMessage,
							).replace(/\n\t/g, "\n")
						: baseMessage;

					return formatCliOutput(
						params,
						cliSuccess(COMMAND, message, {
							lastUpstreamCommitSha: lastUpstream ?? null,
							upstreamHead,
							hasUpdate,
						}),
					);
				}

				const force = params.force === "true";

				if (!force) {
					return formatCliOutput(
						params,
						cliError(COMMAND, "Upgrade requires the 'force' flag."),
					);
				}

				const result = await connection.upgradeFromUpstream(
					UPSTREAM_REPO_URL,
					UPSTREAM_BRANCH,
				);

				if (
					result.oid &&
					plugin.settings.lastUpstreamCommitSha !== result.oid
				) {
					plugin.settings.lastUpstreamCommitSha = result.oid;
					await plugin.saveSettings();
				}

				const baseMessage = result.alreadyMerged
					? "Already up to date."
					: `Upgraded to ${result.oid}.`;

				const message = includeVerbose
					? buildVerboseMessage(
							includeVerbose,
							[
								{
									label: baseMessage,
									items: [
										`Upstream SHA: ${result.oid}`,
										`Recorded SHA: ${
											plugin.settings
												.lastUpstreamCommitSha || "none"
										}`,
									],
								},
							],
							baseMessage,
						).replace(/\n\t/g, "\n")
					: baseMessage;

				return formatCliOutput(
					params,
					cliSuccess(COMMAND, message, result),
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
