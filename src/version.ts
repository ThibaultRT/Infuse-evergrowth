import packageInfo from '../package.json';

export const APP_VERSION = packageInfo.version.replace(/\.0$/, '');

export function applyVersionTag(): void {
  const tag = document.querySelector<HTMLElement>('.version-tag');
  if (tag) tag.textContent = APP_VERSION;
}
