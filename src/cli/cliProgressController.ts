import { LoadingController } from "src/models/ProgressBar";

/**
 * A LoadingController that logs progress instead of updating UI elements.
 * Used by CLI handlers where no visual progress bar is available.
 */
export class CliProgressController implements LoadingController {
	setProgress(percentage: number): void {
		console.debug(`CLI progress: ${percentage}%`);
	}

	setIndexText(indexText: string): void {
		console.debug(`CLI index: ${indexText}`);
	}

	setText(message: string): void {
		console.debug(`CLI status: ${message}`);
	}
}
