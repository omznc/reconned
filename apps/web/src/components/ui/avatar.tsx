"use client"

import * as React from "react"
import { Avatar as FacehashAvatar, AvatarImage as FacehashAvatarImage, AvatarFallback as FacehashAvatarFallback } from "facehash"

import { cn } from "@/lib/utils"

function Avatar({ className, ...props }: React.ComponentProps<typeof FacehashAvatar>) {
  return <FacehashAvatar className={cn("relative flex shrink-0 overflow-hidden rounded-md bg-foreground", className)} {...props} />
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof FacehashAvatarImage>) {
  return <FacehashAvatarImage className={cn("aspect-square size-full", className)} {...props} />
}

function AvatarFallback({ className, ...props }: React.ComponentProps<typeof FacehashAvatarFallback>) {
  return <FacehashAvatarFallback className={cn("flex size-full items-center justify-center rounded-md dark:invert-0 invert", className)} {...props} />
}

export { Avatar, AvatarImage, AvatarFallback }
