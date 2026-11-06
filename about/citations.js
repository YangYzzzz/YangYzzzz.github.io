// The HTML contains a verified reading for each record, including genuine zeroes.
const authorId = '2370441971'
const apiRoot = 'https://api.semanticscholar.org/graph/v1/'
const cacheKey = 'about:semantic-scholar:' + authorId
const refreshInterval = 15 * 60 * 1000
const numberFormat = new Intl.NumberFormat('en-US')
const stampFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC'
})

let readings = {}
try {
  const saved = JSON.parse(localStorage.getItem(cacheKey))
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) readings = saved
} catch {
  // The static reading and in-memory updates also work without local storage.
}

function valid(reading) {
  return Number.isSafeInteger(reading?.count) && reading.count >= 0 &&
    Number.isSafeInteger(reading.at) && reading.at > 0 && reading.at <= Date.now()
}

function render() {
  let paperCountsChanged = false
  for (const el of document.querySelectorAll('[data-citation-id]')) {
    const id = el.dataset.citationId
    const reading = readings[id]
    if (!valid(reading) || reading.at < Date.parse(el.dataset.checked)) continue
    const count = numberFormat.format(reading.count)
    const stamp = stampFormat.format(reading.at) + ' UTC'
    el.dataset.checked = new Date(reading.at).toISOString()
    el.title = 'Semantic Scholar · Checked ' + stamp
    if (id === 'author') {
      el.textContent = count + (reading.count === 1 ? ' citation' : ' citations')
      const checked = document.getElementById('citation-time')
      checked.dateTime = el.dataset.checked
      checked.textContent = stamp
    } else if (Number(el.dataset.count) !== reading.count) {
      el.dataset.count = String(reading.count)
      el.textContent = 'Cited by ' + count
      paperCountsChanged = true
    }
  }
  if (paperCountsChanged) document.getElementById('publications')?.dispatchEvent(new Event('citationcountschange'))
}

async function fetchRecord(path) {
  const response = await fetch(apiRoot + path, {
    credentials: 'omit', signal: AbortSignal.timeout(10000)
  })
  if (!response.ok) throw new Error('Semantic Scholar returned ' + response.status, { cause: response.status })
  return response.json()
}

let lastAttempt = 0
let updating = false
async function refresh() {
  if (document.hidden || !document.querySelector('[data-citation-id="author"]') || updating) return
  const lastSuccess = valid(readings.author) ? readings.author.at : 0
  if (Date.now() - Math.max(lastSuccess, lastAttempt) < refreshInterval) return
  lastAttempt = Date.now()
  updating = true
  try {
    const author = await fetchRecord('author/' + authorId + '?fields=citationCount,papers.citationCount')
    if (author.authorId !== authorId || !Array.isArray(author.papers)) return
    const now = Date.now()
    if (Number.isSafeInteger(author.citationCount) && author.citationCount >= 0) readings.author = { count: author.citationCount, at: now }
    const indexed = new Set()
    for (const paper of author.papers) {
      if (!Number.isSafeInteger(paper.citationCount) || paper.citationCount < 0) continue
      indexed.add(paper.paperId)
      readings[paper.paperId] = { count: paper.citationCount, at: now }
    }
    render()

    // Some team reports have a paper record but are missing from this author profile.
    for (const link of document.querySelectorAll('.paper-citations')) {
      const id = link.dataset.citationId
      if (indexed.has(id)) continue
      await new Promise(resolve => setTimeout(resolve, 1200))
      if (!link.isConnected || document.hidden) break
      const title = link.closest('.paper').querySelector('.paper-title a').textContent
      const query = new URLSearchParams({ query: title, fields: 'title,externalIds,citationCount' })
      let matches
      try {
        matches = await fetchRecord('paper/search/match?' + query)
      } catch (error) {
        if (error.cause === 429) break
        continue
      }
      const paper = matches.data?.find(record => record.paperId === id)
      if (!Number.isSafeInteger(paper?.citationCount) || paper.citationCount < 0) continue
      readings[id] = { count: paper.citationCount, at: Date.now() }
      render()
    }
  } catch {
    // A timeout or rate limit leaves the last successful count and its timestamp visible.
  } finally {
    updating = false
    try { localStorage.setItem(cacheKey, JSON.stringify(readings)) } catch { /* Storage is optional. */ }
  }
}

let timer
function onPage() {
  clearInterval(timer)
  if (!document.querySelector('[data-citation-id="author"]')) return
  render()
  refresh()
  timer = setInterval(refresh, 60 * 1000)
}

// Butterfly can replace the About page without reloading the document.
document.addEventListener('pjax:complete', onPage)
document.addEventListener('visibilitychange', refresh)
onPage()
