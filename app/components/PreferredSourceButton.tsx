export function PreferredSourceButton({
  theme = 'light',
}: {
  theme?: 'light' | 'dark';
}) {
  return (
    <div
      {...{
        'google-add-preferred-source-btn': '',
        'data-theme': theme,
      }}
    />
  );
}
