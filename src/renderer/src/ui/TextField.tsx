import { useId, type InputHTMLAttributes } from 'react';
import styles from './TextField.module.css';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'> {
  label: string;
  error?: string | undefined;
  hint?: string;
}

export function TextField({ label, error, hint, id, ...input }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div>
      <label className={`${styles.field} ${error ? styles.invalid : ''}`}>
        <input
          {...input}
          id={inputId}
          className={styles.input}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
        />
        <span className={styles.label}>{label}</span>
      </label>
      {message && (
        <p id={messageId} className={error ? styles.error : styles.hint}>
          {message}
        </p>
      )}
    </div>
  );
}
