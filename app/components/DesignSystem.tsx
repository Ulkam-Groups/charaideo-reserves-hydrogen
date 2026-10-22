import type {ButtonHTMLAttributes, HTMLAttributes, PropsWithChildren} from 'react';

type ContainerSize = 'narrow' | 'standard' | 'wide' | 'max';
type ButtonVariant = 'primary' | 'secondary' | 'tertiary';
type StatusTone = 'neutral' | 'success' | 'warning' | 'critical' | 'info';

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function Container({
  size = 'standard',
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {size?: ContainerSize}) {
  return (
    <div
      className={classes(
        'ds-container',
        size !== 'standard' && `ds-container--${size}`,
        className,
      )}
      {...props}
    />
  );
}

export function Section({className, ...props}: HTMLAttributes<HTMLElement>) {
  return <section className={classes('ds-section', className)} {...props} />;
}

export function Card({
  interactive = false,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {interactive?: boolean}) {
  return (
    <article
      className={classes('ds-card', interactive && 'ds-card--interactive', className)}
      {...props}
    />
  );
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {variant?: ButtonVariant}) {
  return (
    <button
      type={type}
      className={classes('ds-button', `ds-button--${variant}`, className)}
      {...props}
    />
  );
}

export function Field({className, ...props}: HTMLAttributes<HTMLDivElement>) {
  return <div className={classes('ds-field', className)} {...props} />;
}

export function FieldMessage({
  error = false,
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & {error?: boolean}) {
  return (
    <p
      className={classes(
        'ds-field-message',
        error && 'ds-field-message--error',
        className,
      )}
      {...props}
    />
  );
}

export function StatusBanner({
  tone = 'neutral',
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement> & {tone?: StatusTone}>) {
  return (
    <div
      className={classes(
        'ds-status',
        tone !== 'neutral' && `ds-status--${tone}`,
        className,
      )}
      role={tone === 'critical' ? 'alert' : 'status'}
      {...props}
    >
      {children}
    </div>
  );
}
