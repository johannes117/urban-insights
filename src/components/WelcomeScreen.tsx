import { ChatInput } from "./ChatInput"

const SUGGESTIONS = [
  "Population distribution across LGAs",
  "Compare median income by region",
  "Top 10 LGAs by population",
  "SEIFA disadvantage index",
]

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

interface WelcomeScreenProps {
  onSendMessage: (message: string) => void
  isLoading: boolean
  selectedLGA: string | null
  onLGAChange: (lga: string | null) => void
}

export function WelcomeScreen({
  onSendMessage,
  isLoading,
  selectedLGA,
  onLGAChange,
}: WelcomeScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6">
      <h1 className="mb-8 text-4xl font-light text-gray-900">
        {getTimeBasedGreeting()}
      </h1>

      <div className="w-full max-w-2xl">
        <ChatInput
          onSendMessage={onSendMessage}
          isLoading={isLoading}
          selectedLGA={selectedLGA}
          onLGAChange={onLGAChange}
          showLGASelector={true}
        />
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSendMessage(suggestion)}
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}
