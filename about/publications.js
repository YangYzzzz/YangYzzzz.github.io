const types = [
  { key: 'first', label: 'First / co-first author', short: 'First / co-first' },
  { key: 'core', label: 'Core author (non-first)', short: 'Core authors' },
  { key: 'report', label: 'Technical reports', short: 'Reports' }
]
const summaries = {
  date: 'newest first',
  citations: 'most cited first',
  type: 'grouped by type, newest first within each group'
}
const initialized = new WeakSet()

function makeList(rows) {
  const list = document.createElement('ol')
  list.className = 'papers'
  list.append(...rows.map(row => row.element))
  return list
}

function groupLink(id, label) {
  const link = document.createElement('a')
  link.href = '#' + id
  link.textContent = label
  return link
}

function initializeSort() {
  const root = document.getElementById('publications')
  if (!root || initialized.has(root)) return
  initialized.add(root)

  const groups = root.querySelector('#publication-groups')
  const jumpNav = root.querySelector('.group-nav')
  const controls = root.querySelector('.paper-sort')
  const toc = document.querySelector('#card-toc .toc')
  const rows = Array.from(groups.querySelectorAll('.paper'), element => {
    const time = element.querySelector('time')
    return {
      element, time, date: time.dateTime, shortDate: time.textContent,
      type: element.dataset.paperType, citations: element.querySelector('.paper-citations')
    }
  }).sort((a, b) => b.date.localeCompare(a.date))
  const years = [...new Set(rows.map(row => row.date.slice(0, 4)))]
  let mode = 'date'

  function rankByCitations() {
    const list = groups.querySelector('.papers')
    const ranked = [...rows].sort((a, b) =>
      Number(b.citations.dataset.count) - Number(a.citations.dataset.count) || b.date.localeCompare(a.date))
    const focused = document.activeElement
    ranked.forEach(({ element }, index) => {
      if (list.children[index] !== element) list.insertBefore(element, list.children[index])
    })
    if (list.contains(focused) && focused !== document.activeElement) focused.focus({ preventScroll: true })
  }

  function show(nextMode) {
    mode = nextMode
    const newGroups = document.createDocumentFragment()
    const jumpLinks = []
    const tocItems = []

    function addGroup(id, label, members, shortLabel = label) {
      if (!members.length) return
      const section = document.createElement('section')
      section.className = 'pub-year'
      section.setAttribute('aria-labelledby', id)
      const heading = document.createElement('h3')
      heading.id = id
      heading.textContent = label
      section.append(heading, makeList(members))
      newGroups.append(section)

      jumpLinks.push(groupLink(id, shortLabel))
      const item = document.createElement('li')
      item.className = 'toc-item toc-paper-group'
      const link = groupLink(id, label)
      link.className = 'toc-link'
      item.append(link)
      tocItems.push(item)
    }

    for (const row of rows) {
      row.time.textContent = mode === 'date' ? row.shortDate : row.shortDate + ', ' + row.date.slice(0, 4)
    }
    if (mode === 'date') {
      for (const year of years) addGroup('year-' + year, year, rows.filter(row => row.date.startsWith(year)))
    } else if (mode === 'type') {
      for (const type of types) addGroup('type-' + type.key, type.label, rows.filter(row => row.type === type.key), type.short)
    } else {
      newGroups.append(makeList(rows))
    }
    groups.replaceChildren(newGroups)
    if (mode === 'citations') rankByCitations()
    jumpNav.replaceChildren(...jumpLinks)
    jumpNav.hidden = !jumpLinks.length
    jumpNav.setAttribute('aria-label', mode === 'type' ? 'Publication types' : 'Publication years')
    toc.querySelectorAll('.toc-paper-group').forEach(item => item.remove())
    toc.firstElementChild.after(...tocItems)
    for (const button of controls.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.sort === mode))
    }
    root.querySelector('.sort-summary').textContent = rows.length + ' works, ' + summaries[mode]
    root.dispatchEvent(new Event('publicationgroupschange', { bubbles: true }))
  }

  controls.addEventListener('click', event => {
    const button = event.target.closest('button[data-sort]')
    if (button && button.dataset.sort !== mode) show(button.dataset.sort)
  })
  root.addEventListener('citationcountschange', () => {
    if (mode === 'citations') rankByCitations()
  })
  controls.hidden = false
}

document.addEventListener('pjax:complete', initializeSort)
initializeSort()
