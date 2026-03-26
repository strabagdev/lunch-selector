"use client";

type ConfirmSubmitButtonProps = {
  children: React.ReactNode;
  className: string;
  confirmMessage: string;
  disabled?: boolean;
};

export default function ConfirmSubmitButton({
  children,
  className,
  confirmMessage,
  disabled = false,
}: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      onClick={(event) => {
        if (disabled) {
          return;
        }

        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      className={className}
    >
      {children}
    </button>
  );
}
