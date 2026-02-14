"use client"

import {
  CheckCircle,
  Info,
  Loader2,
  AlertCircle,
  AlertTriangle,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-white group-[.toaster]:text-zinc-950 group-[.toaster]:border-zinc-200 group-[.toaster]:shadow-xl group-[.toaster]:rounded-2xl group-[.toaster]:px-6 group-[.toaster]:py-4 group-[.toaster]:flex group-[.toaster]:items-center group-[.toaster]:font-bold",
          description: "group-[.toast]:text-zinc-500",
          actionButton: "group-[.toast]:bg-zinc-950 group-[.toast]:text-zinc-50",
          cancelButton: "group-[.toast]:bg-zinc-100 group-[.toast]:text-zinc-900",
        },
      }}
      icons={{
        success: <CheckCircle className="size-5 text-emerald-600 stroke-[2.5] shrink-0" />,
        info: <Info className="size-5 text-zinc-900 stroke-[2.5] shrink-0" />,
        warning: <AlertTriangle className="size-5 text-amber-600 stroke-[2.5] shrink-0" />,
        error: <AlertCircle className="size-5 text-red-600 stroke-[2.5] shrink-0" />,
        loading: <Loader2 className="size-5 text-zinc-950 animate-spin stroke-[2.5] shrink-0" />,
      }}
      {...props}
    />
  )
}

export { Toaster }
