// =============================================================================
// useFooter.tsx
// Contexto ligero para que cada página publique información contextual
// al footer global del LayoutApp.
//
// Uso desde una página:
//   const { setInfoFooter } = useFooter()
//   useEffect(() => setInfoFooter('Total: $120.00 · 3 productos'), [total])
//
// El footer escucha el mismo contexto y muestra el valor.
// =============================================================================

import { createContext, useContext, useState, useCallback } from 'react'

interface ContextoFooter {
  infoContextual: string | null
  setInfoFooter: (info: string | null) => void
}

const ContextoFooterCtx = createContext<ContextoFooter>({
  infoContextual: null,
  setInfoFooter: () => {},
})

export function ProveedorFooter({ children }: { children: React.ReactNode }) {
  const [infoContextual, setInfoContextual] = useState<string | null>(null)

  const setInfoFooter = useCallback((info: string | null) => {
    setInfoContextual(info)
  }, [])

  return (
    <ContextoFooterCtx.Provider value={{ infoContextual, setInfoFooter }}>
      {children}
    </ContextoFooterCtx.Provider>
  )
}

export function useFooter() {
  return useContext(ContextoFooterCtx)
}
