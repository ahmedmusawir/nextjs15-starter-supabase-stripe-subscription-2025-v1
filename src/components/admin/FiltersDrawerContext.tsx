"use client";
import React from "react";

type FiltersDrawerContextType = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const FiltersDrawerContext = React.createContext<FiltersDrawerContextType | null>(null);

export function FiltersDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const value = React.useMemo(() => ({ open, setOpen }), [open]);
  return <FiltersDrawerContext.Provider value={value}>{children}</FiltersDrawerContext.Provider>;
}

export function useFiltersDrawer(): FiltersDrawerContextType {
  const ctx = React.useContext(FiltersDrawerContext);
  if (!ctx) return { open: false, setOpen: () => {} };
  return ctx;
}
