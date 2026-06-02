import type QuartzSyncerSettings from "src/models/settings";
import type { GitRemoteSettings } from "src/models/settings";
import { type MetadataCache } from "obsidian";
import { Base64 } from "js-base64";
import {
	RepositoryConnection,
	TRepositoryContent,
} from "src/repositoryConnection/RepositoryConnection";
import type { QuartzVersion } from "src/quartz/QuartzConfigTypes";
import { QuartzVersionDetector } from "src/quartz/QuartzVersionDetector";
import { QuartzConfigService } from "src/quartz/QuartzConfigService";
import { removeLeadingSlash } from "src/utils/utils";

export interface PathRewriteRule {
	from: string;
	to: string;
}

export type VaultPathRule = PathRewriteRule;

export default class QuartzSyncerSiteManager {
	settings: QuartzSyncerSettings;
	metadataCache: MetadataCache;
	baseSyncerConnection: RepositoryConnection;
	userSyncerConnection: RepositoryConnection;
	private quartzVersion: QuartzVersion | null = null;
	private configService: QuartzConfigService | null = null;

	constructor(
		metadataCache: MetadataCache,
		settings: QuartzSyncerSettings,
		gitSettingsWithSecret: GitRemoteSettings,
	) {
		this.settings = settings;
		this.metadataCache = metadataCache;

		this.baseSyncerConnection = new RepositoryConnection({
			gitSettings: {
				remoteUrl: "https://github.com/jackyzha0/quartz.git",
				branch: "v4",
				auth: { type: "none" },
			},
			contentFolder: "content",
			vaultPath: "/",
		});

		this.userSyncerConnection = new RepositoryConnection({
			gitSettings: gitSettingsWithSecret,
			contentFolder: settings.contentFolder,
			vaultPath: settings.vaultPath,
		});
	}

	/**
	 * Retrieves the content of a note from the remote repository.
	 *
	 * @param path - The path to the note file.
	 * @returns A promise that resolves to the note content as a string.
	 */
	async getNoteContent(path: string): Promise<string> {
		path = removeLeadingSlash(path);

		const response = await this.userSyncerConnection.getFile(
			`${this.settings.contentFolder}/${path}`,
		);

		if (!response) {
			return "";
		}

		const content = Base64.decode(response.content);

		return content;
	}

	/**
	 * Bulk-reads all note contents from the remote repository in a single tree walk.
	 * This avoids per-file HTTP round-trips by reading all blobs at once.
	 *
	 * @returns A Map of vault-relative path → decoded content string.
	 */
	async getAllNoteContents(): Promise<Map<string, string>> {
		const rawContents = await this.userSyncerConnection.getAllBlobContents(
			this.settings.contentFolder,
		);

		// Re-key from full repo path (e.g. "content/path/note.md") to vault-relative path ("path/note.md")
		const vaultContents = new Map<string, string>();
		const prefix = this.settings.contentFolder;

		for (const [fullPath, content] of rawContents) {
			let vaultPath = fullPath.replace(prefix, "");
			vaultPath = removeLeadingSlash(vaultPath);
			vaultContents.set(vaultPath, content);
		}

		return vaultContents;
	}

	/**
	 * Extracts note hashes from the repository content tree.
	 *
	 * @param contentTree - The repository content tree.
	 * @returns A promise that resolves to a record mapping note paths to their hashes.
	 */
	private extractHashesFromTree(
		contentTree: NonNullable<TRepositoryContent>,
		filterFn?: (path: string) => boolean,
	): Record<string, string> {
		const files = contentTree.tree ?? [];
		const hashes: Record<string, string> = {};

		for (const item of files) {
			if (
				typeof item.path !== "string" ||
				!item.path.startsWith(this.settings.contentFolder) ||
				item.type !== "blob"
			) {
				continue;
			}

			if (filterFn && !filterFn(item.path)) {
				continue;
			}

			const vaultPath = removeLeadingSlash(
				item.path.replace(this.settings.contentFolder, ""),
			);

			hashes[vaultPath] = item.oid;
		}

		return hashes;
	}

	async getNoteHashes(
		contentTree: NonNullable<TRepositoryContent>,
	): Promise<Record<string, string>> {
		return this.extractHashesFromTree(
			contentTree,
			(path) =>
				path.endsWith(".md") ||
				(this.settings.useBases && path.endsWith(".base")) ||
				(this.settings.useCanvas && path.endsWith(".canvas")),
		);
	}

	/**
	 * Extracts blob hashes from the repository content tree.
	 *
	 * @param contentTree - The repository content tree.
	 * @returns A promise that resolves to a record mapping blob paths to their hashes.
	 */
	async getBlobHashes(
		contentTree: NonNullable<TRepositoryContent>,
	): Promise<Record<string, string>> {
		return this.extractHashesFromTree(contentTree);
	}

	async getQuartzVersion(): Promise<QuartzVersion> {
		if (!this.quartzVersion) {
			this.quartzVersion =
				await QuartzVersionDetector.detectQuartzVersion(
					this.userSyncerConnection,
				);
		}

		return this.quartzVersion;
	}

	async getConfigService(): Promise<QuartzConfigService | null> {
		const version = await this.getQuartzVersion();

		if (version !== "v5-yaml" && version !== "v5-json") {
			return null;
		}

		if (!this.configService) {
			this.configService = new QuartzConfigService(
				this.userSyncerConnection,
			);
		}

		return this.configService;
	}

	isQuartzV5(): boolean {
		return (
			this.quartzVersion === "v5-yaml" || this.quartzVersion === "v5-json"
		);
	}
}
