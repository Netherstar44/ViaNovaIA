# CAMBIOS_ASTRA6.MD

## Mejoras de Diseño: Temática "Crystal Glass"

Se ha implementado una nueva variante de diseño para los componentes de interfaz bajo el estilo "Crystal".

### Cambios realizados:

1.  **Nuevo estilo de botón `glass`:**
    *   **Efecto Blur:** Se ha aplicado `backdrop-blur-xl` para una transparencia inmersiva.
    *   **Efecto de Reflexión:** Se añadió una capa `before` con un degradado lineal (`gradient-to-tr`) que simula la reflexión de la luz al hacer hover.
    *   **Estética:** Fondo semitransparente (`bg-white/10`) con borde fino (`border-white/20`) para dar profundidad.
    *   **Interactividad:** Transiciones suaves (`transition-all duration-300`) y micro-interacciones (`active:scale-[0.98]`) para una sensación de mayor realismo y respuesta al usuario.

2.  **Optimización:**
    *   El diseño está construido con utilidades de Tailwind CSS, lo que garantiza que sea **responsive** y compatible con navegadores modernos mediante `backdrop-filter`.
    *   Se mantiene la consistencia con el sistema de variantes existente (`buttonVariants`).

### Cómo utilizar:
Para aplicar este estilo, simplemente utiliza la propiedad `variant="glass"` en el componente `Button`:

```tsx
<Button variant="glass">Texto del botón</Button>
```
