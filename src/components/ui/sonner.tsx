"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        className: "group toast group-[.toaster]:bg-white group-[.toaster]:text-zinc-950 group-[.toaster]:border-zinc-200 group-[.toaster]:shadow-xl group-[.toaster]:rounded-2xl group-[.toaster]:px-6 group-[.toaster]:py-4 group-[.toaster]:flex group-[.toaster]:items-center group-[.toaster]:font-bold",
        descriptionClassName: "group-[.toast]:text-zinc-500",
        actionButtonClassName: "group-[.toast]:bg-zinc-950 group-[.toast]:text-zinc-50",
        cancelButtonClassName: "group-[.toast]:bg-zinc-100 group-[.toast]:text-zinc-900",
      }}
      icons={{
        success: <CircleCheckIcon className="size-5 text-emerald-600 stroke-[2.5] shrink-0" />,
        info: <InfoIcon className="size-5 text-zinc-900 stroke-[2.5] shrink-0" />,
        warning: <TriangleAlertIcon className="size-5 text-amber-600 stroke-[2.5] shrink-0" />,
        error: <OctagonXIcon className="size-5 text-red-600 stroke-[2.5] shrink-0" />,
        loading: <Loader2Icon className="size-5 text-zinc-950 animate-spin stroke-[2.5] shrink-0" />,
      }}
      {...props}
    />
  )
}

export { Toaster }
