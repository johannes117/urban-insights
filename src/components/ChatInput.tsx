import { useState, useRef, useEffect } from "react"
import { ArrowUp, ChevronDown, MapPin, X } from "lucide-react"

const VICTORIAN_LGAS = [
  "City of Melbourne",
  "City of Port Phillip",
  "City of Yarra",
  "City of Greater Geelong",
  "City of Ballarat",
  "City of Greater Bendigo",
  "City of Casey",
  "City of Monash",
  "City of Boroondara",
  "City of Darebin",
]

interface ChatInputProps {
  onSendMessage: (message: string) => void
  isLoading: boolean
  placeholder?: string
  selectedLGA: string | null
  onLGAChange: (lga: string | null) => void
  showLGASelector?: boolean
}

export function ChatInput({
  onSendMessage,
  isLoading,
  placeholder = "Ask about Victorian census data...",
  selectedLGA,
  onLGAChange,
  showLGASelector = true,
}: ChatInputProps) {
  const [input, setInput] = useState("")
  const [lgaDropdownOpen, setLgaDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setLgaDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim())
      setInput("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleLGASelect = (lga: string | null) => {
    onLGAChange(lga)
    setLgaDropdownOpen(false)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-lg focus-within:ring-1 focus-within:ring-gray-300"
    >
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="min-h-[60px] w-full resize-none bg-transparent px-2 py-1 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
        disabled={isLoading}
      />

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          {showLGASelector && (
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setLgaDropdownOpen(!lgaDropdownOpen)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50 hover:border-gray-300"
              >
                <MapPin className="h-3.5 w-3.5" />
                <span>{selectedLGA || "All Victoria"}</span>
                <ChevronDown className="h-3 w-3" />
              </button>

              {lgaDropdownOpen && (
                <div className="absolute bottom-full left-0 mb-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-50">
                  <button
                    type="button"
                    onClick={() => handleLGASelect(null)}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                      !selectedLGA ? "bg-gray-50 text-gray-900" : "text-gray-600"
                    }`}
                  >
                    All Victoria
                  </button>
                  <div className="my-1 border-t border-gray-100" />
                  {VICTORIAN_LGAS.map((lga) => (
                    <button
                      key={lga}
                      type="button"
                      onClick={() => handleLGASelect(lga)}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                        selectedLGA === lga ? "bg-gray-50 text-gray-900" : "text-gray-600"
                      }`}
                    >
                      {lga}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedLGA && (
            <button
              type="button"
              onClick={() => onLGAChange(null)}
              className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
            >
              <span>{selectedLGA}</span>
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          aria-label="Send message"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}
