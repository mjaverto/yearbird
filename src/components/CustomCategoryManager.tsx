import { useMemo, useState } from 'react'
import type { CustomCategoryInput, CustomCategoryResult } from '../services/customCategories'
import type { CustomCategory } from '../types/categories'
import type { CustomCategoryId } from '../types/calendar'
import { secondaryActionClasses } from '../styles/secondaryActions'
import { Button } from './ui/button'

const DEFAULT_CUSTOM_COLOR = '#3B82F6'

interface CustomCategoryManagerProps {
  customCategories: CustomCategory[]
  onAddCustomCategory: (input: CustomCategoryInput) => CustomCategoryResult
  onUpdateCustomCategory: (id: CustomCategoryId, input: CustomCategoryInput) => CustomCategoryResult
  onRemoveCustomCategory: (id: CustomCategoryId) => void
}

const parseKeywordInput = (value: string) =>
  value
    .split(/[,\n]+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean)

const dedupeKeywords = (keywords: string[]) => {
  const seen = new Set<string>()
  return keywords.filter((keyword) => {
    const normalized = keyword.toLowerCase()
    if (seen.has(normalized)) {
      return false
    }
    seen.add(normalized)
    return true
  })
}

export function CustomCategoryManager({
  customCategories,
  onAddCustomCategory,
  onUpdateCustomCategory,
  onRemoveCustomCategory,
}: CustomCategoryManagerProps) {
  const [customName, setCustomName] = useState('')
  const [customColor, setCustomColor] = useState(DEFAULT_CUSTOM_COLOR)
  const [customKeywords, setCustomKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [matchMode, setMatchMode] = useState<CustomCategoryInput['matchMode']>('any')
  const [customError, setCustomError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<CustomCategoryId | null>(null)

  const sortedCustomCategories = useMemo(
    () =>
      [...customCategories].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
      ),
    [customCategories]
  )

  const resetCustomForm = () => {
    setCustomName('')
    setCustomColor(DEFAULT_CUSTOM_COLOR)
    setCustomKeywords([])
    setKeywordInput('')
    setMatchMode('any')
    setCustomError(null)
    setEditingId(null)
  }

  const handleKeywordAdd = () => {
    const parsed = parseKeywordInput(keywordInput)
    if (parsed.length === 0) {
      return
    }
    setCustomKeywords((prev) => dedupeKeywords([...prev, ...parsed]))
    setKeywordInput('')
    setCustomError(null)
  }

  const handleRemoveKeyword = (keyword: string) => {
    setCustomKeywords((prev) => prev.filter((entry) => entry !== keyword))
  }

  const handleSaveCustomCategory = () => {
    const pendingKeywords = parseKeywordInput(keywordInput)
    const nextKeywords =
      pendingKeywords.length > 0
        ? dedupeKeywords([...customKeywords, ...pendingKeywords])
        : customKeywords

    if (pendingKeywords.length > 0) {
      setCustomKeywords(nextKeywords)
      setKeywordInput('')
    }

    const payload: CustomCategoryInput = {
      label: customName,
      color: customColor,
      keywords: nextKeywords,
      matchMode,
    }

    const result = editingId
      ? onUpdateCustomCategory(editingId, payload)
      : onAddCustomCategory(payload)

    if (result.error) {
      setCustomError(result.error)
      return
    }

    if (result.category) {
      resetCustomForm()
    }
  }

  const handleEditCategory = (category: CustomCategory) => {
    setCustomName(category.label)
    setCustomColor(category.color)
    setCustomKeywords(category.keywords)
    setMatchMode(category.matchMode)
    setKeywordInput('')
    setCustomError(null)
    setEditingId(category.id)
  }

  const handleDeleteCategory = (category: CustomCategory) => {
    const shouldConfirm =
      typeof window === 'undefined' || typeof window.confirm !== 'function'
        ? true
        : window.confirm(`Delete "${category.label}"? This cannot be undone.`)

    if (!shouldConfirm) {
      return
    }

    if (editingId === category.id) {
      resetCustomForm()
    }

    onRemoveCustomCategory(category.id)
  }

  return (
    <div className="mt-5 border-t border-zinc-100 pt-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Custom categories</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Create your own filter types. Matches event titles only.
        </p>
      </div>

      <div className="mt-3 space-y-2.5">
        <div>
          <label className="text-xs font-medium text-zinc-600">Name</label>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:border-sky-400 focus:outline-none"
            placeholder="e.g., Birthdays at home"
            aria-label="Custom category name"
            value={customName}
            onChange={(event) => {
              setCustomName(event.target.value)
              setCustomError(null)
            }}
          />
        </div>

        <div className="flex items-center gap-2.5">
          <div>
            <label className="text-xs font-medium text-zinc-600">Color</label>
            <input
              type="color"
              aria-label="Custom category color"
              value={customColor}
              onChange={(event) => {
                setCustomColor(event.target.value)
                setCustomError(null)
              }}
              className="mt-1 h-8 w-11 cursor-pointer rounded-md border border-zinc-200 bg-white p-1"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-zinc-600">Match type</label>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:border-sky-400 focus:outline-none"
              value={matchMode}
              onChange={(event) => {
                setMatchMode(event.target.value === 'all' ? 'all' : 'any')
                setCustomError(null)
              }}
            >
              <option value="any">Any word (OR)</option>
              <option value="all">All words (AND)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-600">Contains words</label>
          <div className="mt-1 flex gap-2">
            <input
              className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:border-sky-400 focus:outline-none"
              placeholder="Add keyword, press Enter (comma separated)"
              aria-label="Custom category keywords"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleKeywordAdd()
                }
              }}
            />
            <Button onClick={handleKeywordAdd} plain className={secondaryActionClasses}>
              Add
            </Button>
          </div>
          {customKeywords.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {customKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600"
                >
                  {keyword}
                  <button
                    type="button"
                    className="text-zinc-400 hover:text-zinc-700"
                    aria-label={`Remove ${keyword}`}
                    onClick={() => handleRemoveKeyword(keyword)}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <p className="text-[0.65rem] uppercase tracking-[0.3em] text-zinc-400">
          Title-only matching
        </p>
        <p className="text-[0.65rem] uppercase tracking-[0.3em] text-zinc-400">
          Match priority: alphabetical
        </p>

        {customError ? <p className="text-xs text-rose-600">{customError}</p> : null}

        <div className="flex items-center gap-2">
          <Button onClick={handleSaveCustomCategory}>
            {editingId ? 'Save category' : 'Add category'}
          </Button>
          {editingId ? (
            <Button plain onClick={resetCustomForm} className={secondaryActionClasses}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        {sortedCustomCategories.length === 0 ? (
          <p className="text-xs text-zinc-500">No custom categories yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {sortedCustomCategories.map((category) => (
              <li
                key={category.id}
                className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-1.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-xs font-semibold text-zinc-800">{category.label}</span>
                    </div>
                    <p className="mt-1 text-[0.65rem] uppercase tracking-[0.3em] text-zinc-400">
                      {category.matchMode === 'all' ? 'All words' : 'Any word'}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {category.keywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="rounded-full bg-white px-2 py-0.5 text-[11px] text-zinc-600"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      plain
                      onClick={() => handleEditCategory(category)}
                      className={secondaryActionClasses}
                    >
                      Edit
                    </Button>
                    <Button
                      plain
                      onClick={() => handleDeleteCategory(category)}
                      className="text-rose-600 hover:text-rose-700"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
