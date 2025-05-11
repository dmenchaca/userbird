import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Switch } from "@/components/ui/switch"
import { Moon, Sun } from "lucide-react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // useEffect only runs on the client, avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Add keyboard shortcut for toggling dark mode (Cmd+J or Ctrl+J)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        setTheme(theme === "dark" ? "light" : "dark")
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [theme, setTheme])

  if (!mounted) {
    return null
  }

  return (
    <div className="flex items-center justify-between w-full px-1">
      <div className="flex items-center gap-2">
        {theme === "dark" ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
        <span className="text-sm">Dark mode</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Ctrl+J</span>
        <Switch
          checked={theme === "dark"}
          onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        />
      </div>
    </div>
  )
} 