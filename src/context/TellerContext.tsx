
'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';

interface TellerContextType {
  dayStarted: boolean;
  openingFloat: number;
  startDay: (float: number) => void;
  endDay: () => void;
  setOpeningFloat: (float: number) => void;
}

const TellerContext = createContext<TellerContextType | undefined>(undefined);

export function TellerProvider({ children }: { children: ReactNode }) {
  const [dayStarted, setDayStarted] = useState<boolean>(false);
  const [openingFloat, setOpeningFloat] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  useEffect(() => {
    try {
      const storedDayStarted = localStorage.getItem('tellerDayStarted') === 'true';
      const storedOpeningFloat = localStorage.getItem('tellerOpeningFloat');
      
      if (storedDayStarted) {
        setDayStarted(true);
        setOpeningFloat(storedOpeningFloat ? parseFloat(storedOpeningFloat) : 0);
      }
    } catch (error) {
      console.error("Could not access localStorage", error);
    }
    setIsInitialized(true);
  }, []);
  

  const startDay = (float: number) => {
    try {
        localStorage.setItem('tellerDayStarted', 'true');
        localStorage.setItem('tellerOpeningFloat', float.toString());
    } catch (error) {
        console.error("Could not write to localStorage", error);
    }
    setOpeningFloat(float);
    setDayStarted(true);
  };

  const endDay = () => {
    try {
        localStorage.removeItem('tellerDayStarted');
        localStorage.removeItem('tellerOpeningFloat');
    } catch (error) {
        console.error("Could not write to localStorage", error);
    }
    setDayStarted(false);
    setOpeningFloat(0);
  };
  
  const value = useMemo(() => ({
    dayStarted,
    openingFloat,
    startDay,
    endDay,
    setOpeningFloat
  }), [dayStarted, openingFloat]);

  if (!isInitialized) {
      return null; // or a loading spinner
  }

  return (
    <TellerContext.Provider value={value}>
      {children}
    </TellerContext.Provider>
  );
}

export function useTeller() {
  const context = useContext(TellerContext);
  if (context === undefined) {
    throw new Error('useTeller must be used within a TellerProvider');
  }
  return context;
}
