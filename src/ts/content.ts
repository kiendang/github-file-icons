import domLoaded from 'dom-loaded';
import select from 'select-dom';
import mobile from 'is-mobile';
import { observe } from 'selector-observer';
import { getIconClass, type ColorMode } from 'atom-file-icons';

import { StorageKey } from './background';
import '../css/icons.css';

let colorsDisabled = false;
let darkMode = false;
let siteDarkMode = false;

const enum Host {
  GitHub = 'github',
  GitLab = 'gitlab',
  Others = 'others',
}

const fonts = [
  { name: 'FontAwesome', path: 'fonts/fontawesome.woff2' },
  { name: 'Mfizz', path: 'fonts/mfixx.woff2' },
  { name: 'Devicons', path: 'fonts/devopicons.woff2' },
  { name: 'file-icons', path: 'fonts/file-icons.woff2' },
  { name: 'Octicons Regular', path: 'fonts/octicons.woff2' },
];

const isGithubPage = () => /.*github.*/.test(window.location.hostname);

const isGithubTreeViewPage = () => {
  if (!isGithubPage()) return false;

  return !!document.querySelector('#repos-file-tree');
};

const isGithubFilesPage = () => {
  if (!isGithubPage()) return false;

  const pathname = window.location.pathname;
  const filesPageUrlPattern = new RegExp(/^\/.+\/.+\/pull\/\d+\/files$/);
  return pathname.match(filesPageUrlPattern) ? true : false;
};

const getSelector = (hostname: string) => {
  switch (true) {
    case /.*github.*/.test(hostname):
      // if it is a github pull request files page
      if (isGithubFilesPage()) {
        return {
          filenameSelector:
            'ul.ActionList>li[id^=file-tree-item-diff-][role=treeitem]>a>span:nth-child(2)',
          iconSelector:
            'ul.ActionList>li[id^=file-tree-item-diff-][role=treeitem]>a>span:first-child',
          host: Host.GitHub,
        };
      }

      if (isGithubTreeViewPage()) {
        return {
          filenameSelector:
            'div.PRIVATE_TreeView-item-content > span.PRIVATE_TreeView-item-content-text > span',
          iconSelector:
            'div.PRIVATE_TreeView-item-content > div.PRIVATE_TreeView-item-visual',
          host: Host.GitHub,
        };
      }

      return {
        filenameSelector:
          'tr.js-navigation-item > td.content > span, .files-list > a.list-item, div.js-navigation-item > div[role="rowheader"] > span',
        iconSelector:
          'tr.js-navigation-item > td.icon, .files-list > a.list-item, div.js-navigation-item > div[role="gridcell"]:first-child',
        host: Host.GitHub,
      };
    case /.*gitlab.*/.test(hostname):
      return {
        filenameSelector: 'tr.tree-item > td.tree-item-file-name > a > span',
        iconSelector: 'tr.tree-item > td.tree-item-file-name > i',
        host: Host.GitLab,
      };
    default:
      return {
        filenameSelector: 'tr > td.name > a',
        iconSelector: 'tr > td.name > span',
        host: Host.Others,
      };
  }
};

const { filenameSelector, iconSelector, host } = getSelector(
  window.location.hostname,
);
const isMobile = mobile();
const isGitHub = host === Host.GitHub;

const loadFonts = () => {
  fonts.forEach((font) => {
    const fontFace = new FontFace(
      font.name,
      `url("${chrome.runtime.getURL(font.path)}") format("woff2")`,
      {
        style: 'normal',
        weight: 'normal',
      },
    );

    fontFace
      .load()
      .then((loadedFontFace) => document.fonts.add(loadedFontFace));
  });
};

const getGitHubMobileFilename = (filenameDom: HTMLElement) =>
  Array.from(filenameDom.childNodes)
    .filter((node) => node.nodeType === node.TEXT_NODE)
    .map((node) => node.nodeValue?.trim() || '')
    .join('');

const replaceIcon = ({
  iconDom,
  filenameDom,
}: {
  iconDom: HTMLElement | null;
  filenameDom: HTMLElement;
}) => {
  const filename =
    isGitHub && isMobile
      ? getGitHubMobileFilename(filenameDom)
      : filenameDom.textContent?.trim() ?? '';

  if (iconDom && iconDom.classList.contains('octicon-file-directory')) {
    return;
  }

  const getIconColorMode = (): ColorMode => {
    if (colorsDisabled) {
      return 'mono';
    }

    if (siteDarkMode) {
      return 'dark';
    }

    return 'light';
  };

  const className = getIconClass(filename, {
    colorMode: getIconColorMode(),
    skipFallback: true,
  });

  if (!className) {
    return;
  }

  const darkClassName = darkMode ? 'dark' : '';

  if (className) {
    const icon = document.createElement('span');

    if (isGitHub) {
      icon.className = `icon octicon-file ${className} ${darkClassName}`;
    } else {
      icon.className = `${className} ${darkClassName}`;
      icon.style.marginRight = '3px';
    }

    if (iconDom?.parentNode) {
      iconDom.parentNode.replaceChild(icon, iconDom as HTMLElement);
    }
  }
};

const update = () => {
  const filenameDoms = select.all(filenameSelector);
  const iconDoms = select.all(iconSelector);

  for (let i = 0; i < filenameDoms.length; i += 1) {
    replaceIcon({
      iconDom: iconDoms[i],
      filenameDom: filenameDoms[i],
    });
  }
};

const replaceGithubFileIcons = (
  triggerSelector: string,
  fileSelector: string,
  iconSelector = '.octicon-file',
) => {
  observe(triggerSelector, {
    add(element) {
      const filenameDom = select(fileSelector, element);
      if (filenameDom) {
        const iconDom = select(iconSelector, element);
        if (iconDom) {
          replaceIcon({ iconDom, filenameDom });
        }
      }
    },
  });
};

const init = async () => {
  loadFonts();

  await domLoaded;

  if (isGitHub) {
    siteDarkMode =
      document.querySelector('html')?.getAttribute('data-color-mode') ===
      'dark';

    if (isGithubFilesPage()) {
      replaceGithubFileIcons(
        'ul.ActionList > li[id^=file-tree-item-diff-][role=treeitem]',
        'a > span:nth-child(2)',
      );
    } else {
      replaceGithubFileIcons(
        '.js-navigation-container > .js-navigation-item',
        'div[role="rowheader"] > span',
      );

      replaceGithubFileIcons(
        '.PRIVATE_TreeView-item-content:has(span.PRIVATE_TreeView-item-content-text > span:not([class]))',
        'span.PRIVATE_TreeView-item-content-text',
      );

      replaceGithubFileIcons(
        '.react-directory-filename-column',
        '.react-directory-truncate',
        'svg:not(.icon-directory)',
      );
    }
  } else {
    update();
    document.addEventListener('pjax:end', update);
  }
};

chrome.storage.sync.get(
  [StorageKey.ColorsDisabled, StorageKey.DarkMode],
  (result) => {
    colorsDisabled =
      result.colorsDisabled === undefined
        ? colorsDisabled
        : result.colorsDisabled;

    darkMode = result.darkMode === undefined ? darkMode : result.darkMode;

    init();
  },
);

chrome.runtime.onMessage.addListener(function (request) {
  if (request.message === 'file-icon-extension-page-update') {
    // reinitialize after page update
    init();
  }
});
