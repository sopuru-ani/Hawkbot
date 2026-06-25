import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-gray-50 p-8">
      <h1 className="text-3xl font-bold text-gray-900">Hawkbot</h1>
      <p className="text-gray-600">
        React + TypeScript + Tailwind CSS v4
      </p>
      <button
        type="button"
        onClick={() => setCount((c) => c + 1)}
        className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
      >
        Count is {count}
      </button>
    </div>
  )
}

export default App
