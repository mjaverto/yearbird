import { Disclosure } from '@headlessui/react'
import { useMemo, useState } from 'react'
import type { Category, CategoryInput, CategoryResult } from '../types/categories'
import { secondaryActionClasses } from '../styles/secondaryActions'
import { Button } from './ui/button'

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

const DEFAULT_COLOR = '#3B82F6'

interface CategoryManagerProps {
  categories: Category[]
  removedDefaults: Category[]
  onAddCategory: (input: CategoryInput) => CategoryResult
  onUpdateCategory: (id: string, input: CategoryInput) => CategoryResult
  onRemoveCategory: (id: string) => void
  onRestoreDefault: (id: string) => CategoryResult
  onResetToDefaults: () => void
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

export function CategoryManager({
  categories,
  removedDefaults,
  onAddCategory,
  onUpdateCategory,
  onRemoveCategory,
  onRestoreDefault,
  onResetToDefaults,
}: CategoryManagerProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [matchMode, setMatchMode] = useState<CategoryInput['matchMode']>('any')
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
      ),
    [categories]
  )

  const resetForm = () => {
    setName('')
    setColor(DEFAULT_COLOR)
    setKeywords([])
    setKeywordInput('')
    setMatchMode('any')
    setError(null)
    setEditingId(null)
  }

  const handleKeywordAdd = () => {
    const parsed = parseKeywordInput(keywordInput)
    if (parsed.length === 0) {
      return
    }
    setKeywords((prev) => dedupeKeywords([...prev, ...parsed]))
    setKeywordInput('')
    setError(null)
  }

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords((prev) => prev.filter((entry) => entry !== keyword))
  }

  const handleSaveCategory = () => {
    const pendingKeywords = parseKeywordInput(keywordInput)
    const nextKeywords =
      pendingKeywords.length > 0 ? dedupeKeywords([...keywords, ...pendingKeywords]) : keywords

    if (pendingKeywords.length > 0) {
      setKeywords(nextKeywords)
      setKeywordInput('')
    }

    const payload: CategoryInput = {
      label: name,
      color,
      keywords: nextKeywords,
      matchMode,
    }

    const result = editingId ? onUpdateCategory(editingId, payload) : onAddCategory(payload)

    if (result.error) {
      setError(result.error)
      return
    }

    if (result.category) {
      resetForm()
    }
  }

  const handleEditCategory = (category: Category) => {
    setName(category.label)
    setColor(category.color)
    setKeywords(category.keywords)
    setMatchMode(category.matchMode)
    setKeywordInput('')
    setError(null)
    setEditingId(category.id)
  }

  const handleRemoveCategory = (category: Category) => {
    const message = category.isDefault
      ? `Remove "${category.label}"? You can restore it later from "Removed".`
      : `Delete "${category.label}"? This cannot be undone.`

    const shouldConfirm =
      typeof window === 'undefined' || typeof window.confirm !== 'function'
        ? true
        : window.confirm(message)

    if (!shouldConfirm) {
      return
    }

    if (editingId === category.id) {
      resetForm()
    }

    onRemoveCategory(category.id)
  }

  const handleRestoreDefault = (category: Category) => {
    const result = onRestoreDefault(category.id)
    if (result.error) {
      setError(result.error)
    }
  }

  const handleResetToDefaults = () => {
    const shouldConfirm =
      typeof window === 'undefined' || typeof window.confirm !== 'function'
        ? true
        : window.confirm('Reset all categories to defaults? Your custom categories will be removed.')

    if (shouldConfirm) {
      resetForm()
      onResetToDefaults()
    }
  }

  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Categories</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Title-only matching, match priority: alphabetical.
        </p>
      </div>

      {/* Category List */}
      <div className="mt-3">
        {sortedCategories.length === 0 ? (
          <p className="text-xs text-zinc-500">No categories yet. Add one below or reset to defaults.</p>
        ) : (
          <ul className="space-y-1.5">
            {sortedCategories.map((category) => (
              <li
                key={category.id}
                className="rounded-lg border border-zinc-100 bg-white px-3 py-1.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-xs font-semibold text-zinc-800">{category.label}</span>
                      {category.isDefault ? (
                        <span className="text-[0.55rem] uppercase tracking-[0.2em] text-zinc-400">
                          Default
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[0.65rem] text-zinc-400">
                      {category.keywords.join(', ')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      plain
                      onClick={() => handleEditCategory(category)}
                      className={secondaryActionClasses}
                    >
                      Edit
                    </Button>
                    <Button
                      plain
                      onClick={() => handleRemoveCategory(category)}
                      className={secondaryActionClasses}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Removed Defaults Section */}
      {removedDefaults.length > 0 ? (
        <Disclosure>
          {({ open }) => (
            <>
              <Disclosure.Button className="mt-3 flex w-full items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700">
                <ChevronRightIcon
                  className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
                />
                Removed ({removedDefaults.length})
              </Disclosure.Button>
              <Disclosure.Panel>
                <ul className="mt-2 space-y-1.5">
                  {removedDefaults.map((category) => (
                    <li
                      key={category.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-3 py-1.5 opacity-60"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-sm"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="text-xs text-zinc-400 line-through">{category.label}</span>
                      </div>
                      <Button
                        plain
                        onClick={() => handleRestoreDefault(category)}
                        className={secondaryActionClasses}
                      >
                        Restore
                      </Button>
                    </li>
                  ))}
                </ul>
              </Disclosure.Panel>
            </>
          )}
        </Disclosure>
      ) : null}

      {/* Add/Edit Form */}
      <div className="mt-4 border-t border-zinc-100 pt-4">
        <h4 className="text-xs font-medium text-zinc-700">
          {editingId ? 'Edit category' : 'Add category'}
        </h4>

        <div className="mt-3 space-y-2.5">
          <div>
            <label className="text-xs font-medium text-zinc-600">Name</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:border-sky-400 focus:outline-none"
              placeholder="e.g., Sports"
              aria-label="Category name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError(null)
              }}
            />
          </div>

          <div className="flex items-center gap-2.5">
            <div>
              <label className="text-xs font-medium text-zinc-600">Color</label>
              <input
                type="color"
                aria-label="Category color"
                value={color}
                onChange={(event) => {
                  setColor(event.target.value)
                  setError(null)
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
                  setError(null)
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
                aria-label="Category keywords"
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
            {keywords.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {keywords.map((keyword) => (
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

          {error ? <p className="text-xs text-rose-600">{error}</p> : null}

          <div className="flex items-center gap-2">
            <Button onClick={handleSaveCategory}>
              {editingId ? 'Save category' : 'Add category'}
            </Button>
            {editingId ? (
              <Button plain onClick={resetForm} className={secondaryActionClasses}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Reset to Defaults */}
      <div className="mt-4 border-t border-zinc-100 pt-3">
        <Button plain onClick={handleResetToDefaults} className={secondaryActionClasses}>
          Reset to defaults
        </Button>
      </div>
    </div>
  )
}
