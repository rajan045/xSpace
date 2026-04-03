import { getNestedItemHelp } from '../data/nestedPathInfo'

type Entry = { path: string; name: string; isDir: boolean }

/** Context copy for Overview drill-down delete confirmation */
export function buildOverviewDrillDeleteContext(
  selected: Set<string>,
  drillEntries: Entry[],
  categoryName: string | undefined,
  permanent: boolean
): { aboutContains: string; aboutImpact: string; names: string[] } {
  const sel = drillEntries.filter(e => selected.has(e.path))
  const names = sel.map(e => e.name)

  if (sel.length === 0) {
    return {
      aboutContains: 'No items matched.',
      aboutImpact: '',
      names: [],
    }
  }

  if (sel.length === 1) {
    const h = getNestedItemHelp(sel[0].path, sel[0].name, sel[0].isDir, categoryName)
    const permExtra = permanent
      ? ' With permanent delete, nothing goes to Trash — there is no Put Back.'
      : ''
    return {
      aboutContains: h.contains,
      aboutImpact: `${h.impact}${permExtra}`,
      names,
    }
  }

  const folders = sel.filter(e => e.isDir).length
  const files = sel.length - folders
  const cat = categoryName ? `“${categoryName}”` : 'this location'

  return {
    aboutContains: `You selected ${sel.length} items from ${cat}: ${folders} folder${folders === 1 ? '' : 's'} and ${files} file${files === 1 ? '' : 's'}. They may include caches, documents, or app data depending on what you checked.`,
    aboutImpact: permanent
      ? 'Each item will be erased immediately. A mixed selection can include important data — only continue if you have reviewed every name and path.'
      : 'All selected items move to Trash together. You can restore them individually from Finder until Trash is emptied.',
    names,
  }
}
