let settings;
const TITLE_GROUP_SEPARATOR = '/';

function render(shortcutKeys) {

  shortcutKeys = shortcutKeys || settings.shortcutKeys;
  const visibleShortcutKeys = shortcutKeys.filter(x => !x.hideOnPopup);
  const listColumnCount = settings.listColumnCount;
  const keyMaxLength = Math.max(1, ...visibleShortcutKeys.map((shortcutKey) => shortcutKey.key.length));

  const listElement = document.getElementById('shortcutKeys');
  listElement.textContent = null;
  const hasHierarchy = visibleShortcutKeys.some((shortcutKey) => {
    return (shortcutKey.group && shortcutKey.group.trim()) ||
      (shortcutKey.title && shortcutKey.title.includes(TITLE_GROUP_SEPARATOR));
  });

  if (hasHierarchy) {
    renderTreeLayout(listElement, visibleShortcutKeys, keyMaxLength, listColumnCount);
    return;
  }

  listElement.style.columnCount = listColumnCount;
  const columns = [];

  for (var i = 0; i < listColumnCount; i++) {
    const column = listElement.appendChild(document.createElement('div'));
    column.className = 'column';
    columns.push(column);
  }

  for (var i = 0, length = Math.ceil(visibleShortcutKeys.length / listColumnCount) * listColumnCount; i < length; i++) {

    columns[i % listColumnCount].appendChild(createShortcutKeyElement(visibleShortcutKeys[i], keyMaxLength));
  }
}

function renderTreeLayout(listElement, shortcutKeys, keyMaxLength, listColumnCount) {
  listElement.style.columnCount = 1;

  const tree = buildShortcutTree(shortcutKeys);

  if (tree.items.length > 0) {
    const ungroupedElement = listElement.appendChild(document.createElement('div'));
    ungroupedElement.className = 'group-content';
    ungroupedElement.style.columnCount = listColumnCount;
    tree.items.forEach((item) => {
      ungroupedElement.appendChild(createShortcutKeyElement(item.shortcutKey, keyMaxLength, item.label));
    });
  }

  // Preserve user-defined order (insertion order of Map = item order)
  tree.groups.forEach((groupNode, groupName) => {
    listElement.appendChild(createGroupElement(groupName, groupNode, keyMaxLength, 0, listColumnCount));
  });
}

function buildShortcutTree(shortcutKeys) {
  const root = { items: [], groups: new Map() };

  shortcutKeys.forEach((shortcutKey) => {
    // Prefer explicit group field
    if (shortcutKey.group && shortcutKey.group.trim()) {
      const groupName = shortcutKey.group.trim();
      if (!root.groups.has(groupName)) {
        root.groups.set(groupName, { items: [], groups: new Map() });
      }
      root.groups.get(groupName).items.push({ shortcutKey: shortcutKey, label: shortcutKey.title });
      return;
    }

    // Fall back to title splitting by '/'
    const parts = (shortcutKey.title || '')
      .split(TITLE_GROUP_SEPARATOR)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (parts.length <= 1) {
      root.items.push({ shortcutKey: shortcutKey, label: shortcutKey.title });
      return;
    }

    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const groupName = parts[i];
      if (!node.groups.has(groupName)) {
        node.groups.set(groupName, { items: [], groups: new Map() });
      }
      node = node.groups.get(groupName);
    }

    node.items.push({ shortcutKey: shortcutKey, label: parts[parts.length - 1] });
  });

  return root;
}

function createGroupElement(groupName, node, keyMaxLength, depth, listColumnCount) {
  const detailsElement = document.createElement('details');
  detailsElement.className = 'group';
  if (depth === 0) {
    detailsElement.open = true;
  }

  const summaryElement = document.createElement('summary');
  summaryElement.className = 'group-summary';
  summaryElement.textContent = groupName;
  detailsElement.appendChild(summaryElement);

  const contentElement = document.createElement('div');
  contentElement.className = 'group-content';
  // Top-level groups show items in multiple columns; nested groups stay single-column
  if (depth === 0 && listColumnCount > 1) {
    contentElement.style.columnCount = listColumnCount;
  }

  node.items.forEach((item) => {
    contentElement.appendChild(createShortcutKeyElement(item.shortcutKey, keyMaxLength, item.label));
  });

  node.groups.forEach((childNode, childGroupName) => {
    contentElement.appendChild(createGroupElement(childGroupName, childNode, keyMaxLength, depth + 1, listColumnCount));
  });

  detailsElement.appendChild(contentElement);
  return detailsElement;
}

function createShortcutKeyElement(shortcutKey, keyMaxLength, displayTitle) {

  if (!shortcutKey) {
    const emptyElement = document.createElement('div');
    emptyElement.textContent = '\u00A0';
    return emptyElement;
  }

  const keyElement = document.createElement('span');
  keyElement.className = 'key';
  keyElement.textContent = shortcutKey.key.padEnd(keyMaxLength, '\u00A0');

  const titleElement = document.createElement('span');
  titleElement.className = 'title';
  titleElement.textContent = displayTitle || shortcutKey.title;

  const shortcutKeyElement = document.createElement('div');
  shortcutKeyElement.className = 'item';
  if (displayTitle && displayTitle !== shortcutKey.title) {
    shortcutKeyElement.title = shortcutKey.title;
  }
  shortcutKeyElement.appendChild(keyElement);
  shortcutKeyElement.appendChild(titleElement);
  shortcutKeyElement.addEventListener('click', () => {
    chrome.runtime.sendMessage({target: 'background-handler', name: MessageName.CLICK_EVENT, value: shortcutKey});
    window.close();
  })

  return shortcutKeyElement;
}

function doAddCurrentPage() {
  chrome.runtime.sendMessage({target: 'background-options', name: 'add'});
  window.close();
}

function doOpenOptions() {
  chrome.runtime.openOptionsPage();
  window.close();
}

document.getElementById('add').addEventListener('click', doAddCurrentPage);
document.getElementById('options').addEventListener('click', doOpenOptions);

document.addEventListener('keydown', (e) => {
  if (e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
    if (e.key === '.') {
      e.preventDefault();
      doAddCurrentPage();
      return;
    }
    if (e.key === '/') {
      e.preventDefault();
      doOpenOptions();
      return;
    }
  }
});

document.addEventListener('keypress', (e) => {
  console.log(e);

  const message = {
    target: 'background-handler',
    name: MessageName.KEY_EVENT,
    value: {
      'charCode': e.charCode,
      'keyCode': e.keyCode,
      'altKey': e.altKey,
      'ctrlKey': e.ctrlKey,
      'metaKey': e.metaKey,
      'shiftKey': e.shiftKey
    }
  };

  chrome.runtime.sendMessage(message, (response) => {
    console.log(response);

    if (response.result == HandleResult.FINISH) {
      window.close();
    } else {
      if (settings.filterOnPopup) {
        render(response.shortcutKeys);
      }
    }
  });
});

// startup message
chrome.runtime.sendMessage({target: 'background-handler', name: MessageName.STARTUP}, (response) => {
  settings = response.settings;
  render();
});
