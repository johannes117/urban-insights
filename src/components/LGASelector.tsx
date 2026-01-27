import { useState } from "react"

type LGASelectorProps = {
  lgaList: string[]
  onSelect: (lga: string) => void
}

export default function LGASelector({ lgaList, onSelect }: LGASelectorProps) {
  const [selectedLGA, setSelectedLGA] = useState("")

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const lga = event.target.value
    setSelectedLGA(lga)
    onSelect(lga)
  }

  return (
    <div className="my-2">
      <label htmlFor="lga-select" className="font-semibold mr-2">
        Select LGA:
      </label>
      <select
        id="lga-select"
        value={selectedLGA}
        onChange={handleChange}
        className="border border-gray-300 rounded p-1"
      >
        <option value="">--Choose LGA--</option>
        {lgaList.map((lga) => (
          <option key={lga} value={lga}>
            {lga}
          </option>
        ))}
      </select>
    </div>
  )
}
