import { Modal } from "./Modal";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = false
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="button button-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`button ${danger ? "button-danger" : "button-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="modal-message">{message}</p>
    </Modal>
  );
}
