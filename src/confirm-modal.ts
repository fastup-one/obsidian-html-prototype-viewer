import { App, Modal } from "obsidian";

export interface ConfirmOptions {
	title: string;
	/** Rendered into the modal body before the buttons. */
	body: (el: HTMLElement) => void;
	confirmText: string;
	cancelText: string;
}

/**
 * Confirmation for decisions that change privileges. Cancel is the default:
 * it takes the focus, Enter always cancels wherever the focus is, and Escape
 * closes without confirming. Confirming takes an explicit click or tap (or
 * Space on the focused confirm button).
 */
export class ConfirmModal extends Modal {
	private confirmed = false;

	constructor(
		app: App,
		private readonly options: ConfirmOptions,
		private readonly onConfirm: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("hpv-confirm-modal");
		this.titleEl.setText(this.options.title);
		this.options.body(this.contentEl);

		// Cancel comes first: Obsidian focuses the first button once the modal is shown.
		const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
		const cancel = buttons.createEl("button", { cls: "mod-cta", text: this.options.cancelText });
		const confirm = buttons.createEl("button", { cls: "mod-warning", text: this.options.confirmText });
		confirm.addEventListener("click", () => {
			this.confirmed = true;
			this.close();
		});
		cancel.addEventListener("click", () => this.close());
		this.scope.register([], "Enter", () => {
			this.close();
			return false;
		});
		cancel.focus();
	}

	onClose(): void {
		this.contentEl.empty();
		if (this.confirmed) this.onConfirm();
	}
}
