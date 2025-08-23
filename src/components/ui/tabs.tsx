"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex items-end justify-start gap-3 border-b border-gray-300 bg-transparent p-0",
        className
      )}
      {...props}
    />
  )
)
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-t-xl border border-gray-300 bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 shadow-sm hover:bg-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        "data-[state=inactive]:border-b-gray-300",
        "data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:border-orange-700 data-[state=active]:border-b-white data-[state=active]:shadow",
        className
      )}
      {...props}
    />
  )
)
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  )
)
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
