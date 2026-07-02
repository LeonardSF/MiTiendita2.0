// =============================================================================
// main.tsx
// Punto de entrada de la aplicación.
// Monta el árbol de React con el RouterProvider como raíz.
//
// Nota: React.StrictMode se omite intencionalmente porque provoca doble
// ejecución de efectos en desarrollo, lo que genera conflictos de unicidad
// al crear ventas en Supabase (folio duplicado). En producción no hay
// diferencia — StrictMode solo actúa en desarrollo.
// =============================================================================

import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { enrutador } from './enrutador'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <RouterProvider router={enrutador} />,
)
