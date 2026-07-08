# Branding — Baila Más!

Referencia visual y técnica extraída del flyer oficial.

---

## Identidad

| Campo | Valor |
|---|---|
| **Nombre** | Baila Más! |
| **Ubicación** | Monte Grande |
| **Contacto** | 1126010215 |
| **Tagline** | Elegí tu forma de bailar |

---

## Paleta de colores

### Fondos

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#0d0a1a` | Fondo principal (deep purple-black) |
| `--bg-mid` | `#110d22` | Fondo alternativo / secciones |
| `--surface` | `rgba(200,0,255,0.05)` | Superficie de cards |
| `--border` | `rgba(200,0,255,0.18)` | Bordes de cards |

### Acentos de marca

| Token | Hex | Uso |
|---|---|---|
| `--magenta` | `#c800ff` | Acento primario, borders activos, glow |
| `--magenta-dim` | `#8b00b3` | Variante apagada del magenta |
| `--orange` | `#ff9900` | Acento secundario, gradientes |
| `--orange-dim` | `#c97800` | Variante apagada del naranja |
| `--yellow` | `#ffe000` | Highlight, gradiente salsa |

### Texto

| Token | Hex | Uso |
|---|---|---|
| `--text-primary` | `#f0eeff` | Texto principal |
| `--text-secondary` | `#8877bb` | Texto auxiliar, labels, metadatos |

### Estado

| Token | Hex | Uso |
|---|---|---|
| `--live` | `#00e676` | Indicador "clase en curso" |

---

## Tipografía

| Rol | Fuente | Peso | Uso |
|---|---|---|---|
| Display / Brand | **Bebas Neue** | Regular | Logo, títulos grandes, badges, countdown, CTAs |
| Body / UI | **Outfit** | 300/400/700/900 | Subtítulos, descripciones, labels |
| Sistema | **Inter** | 400/600 | Textos de apoyo, metadatos |

---

## Gradientes por tipo de clase

| Clase | Gradiente | Glow |
|---|---|---|
| `salsa` | `#ff5500 → #ff9900 → #ffe000` | naranja `rgba(255,153,0,0.25)` |
| `bachata` | `#c800ff → #ff9900` | magenta `rgba(200,0,255,0.3)` |
| *(default)* | `#2a0050 → #8b00b3 → #6600aa` | púrpura `rgba(139,0,179,0.25)` |

---

## Efectos visuales

- **Background:** triple radial-gradient con magenta (arriba-izq) y naranja (abajo-der)
- **Cards:** glassmorphism con `backdrop-filter: blur(8px)` + borde neón vía `::before`
- **Hover:** `translateY(-6px)` + `box-shadow` con el glow del tipo de clase
- **Countdown digits:** `drop-shadow` neón del gradiente correspondiente
- **Línea decorativa header:** gradiente `transparent → magenta → orange → transparent`
- **Live indicator:** dot pulsante con `box-shadow` en `#00e676`

---

## Assets

| Archivo | Descripción |
|---|---|
| `Branding.png` | Flyer oficial — paleta, tipografía y estética de referencia |

---

## Implementación de referencia

El branding está aplicado en `index.html` — sección `<style>` → bloque `:root`.
