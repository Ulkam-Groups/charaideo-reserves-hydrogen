// Some Windows CI/sandbox environments cannot resolve the OS user, which tsx
// uses only to name its temporary directory. Linux already provides geteuid.
if (process.platform === 'win32' && !process.geteuid) {
  process.geteuid = () => 0;
}
